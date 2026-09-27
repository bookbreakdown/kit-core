import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { ListeningPosition, Playlist, Track } from '@libraryofages/kit-core';
import type { AudioEngine, RemoteCommand } from './engine/AudioEngine';
import { createEngine } from './engine/createEngine';
import { FADE_MS, JUMP_SECONDS, SAVE_INTERVAL_MS, SPEEDS, type PlayerApi, type PlayerContextValue, type PlayerProviderProps, type PlayerState, type SleepTimerSetting } from './types';

const PlayerContext = createContext<PlayerContextValue | null>(null);

const INITIAL: PlayerState = {
  playlist: null, index: 0, positionSeconds: 0, durationSeconds: 0, playing: false, rate: 1,
  sleepTimer: { setting: null, endsAt: null }, blockedIndex: null, loaded: false, expanded: false, fading: false,
};

/**
 * Audible-feel player logic above an `AudioEngine`: queue position, progress cadence, ±15 s,
 * speed, sleep timer with fade, voice switch keeping the place, blocked tracks, end detection.
 */
export function PlayerProvider(props: PlayerProviderProps) {
  const { theme, progressStore, resolveSource, engineFactory, voices = [], onSwitchVoice, onTrackBlocked, onPlaylistEnd, saveIntervalMs = SAVE_INTERVAL_MS, children } = props;
  void theme;
  const engine = useRef<AudioEngine | null>(null);
  const [state, setState] = useState<PlayerState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Engine truth, updated synchronously by engine events; React state lags by a render.
  const live = useRef({ index: 0, positionSeconds: 0, durationSeconds: 0, rate: 1, playing: false });
  const endedFor = useRef<string | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cbs = useRef({ onTrackBlocked, onPlaylistEnd, onSwitchVoice, resolveSource });
  cbs.current = { onTrackBlocked, onPlaylistEnd, onSwitchVoice, resolveSource };

  const getEngine = useCallback((): AudioEngine => {
    if (!engine.current) engine.current = engineFactory ? engineFactory() : createEngine();
    return engine.current;
  }, [engineFactory]);

  // --- persistence ------------------------------------------------------------------------
  const save = useCallback(() => {
    const s = stateRef.current;
    if (!s.playlist || !s.loaded) return;
    const l = live.current;
    const p: ListeningPosition = { trackIndex: l.index, positionSeconds: Math.floor(l.positionSeconds), rate: l.rate };
    void progressStore.save(s.playlist.id, p);
  }, [progressStore]);

  useEffect(() => {
    const id = setInterval(() => { if (stateRef.current.playing) save(); }, saveIntervalMs);
    return () => clearInterval(id);
  }, [save, saveIntervalMs]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => { if (next !== 'active') save(); });
    return () => sub.remove();
  }, [save]);

  useEffect(() => () => { save(); engine.current?.destroy(); engine.current = null; }, [save]);

  // --- sleep timer ------------------------------------------------------------------------
  const stopFade = useCallback(() => {
    if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
  }, []);

  const finishSleep = useCallback(() => {
    stopFade();
    void getEngine().pause();
    void getEngine().setVolume(1);
    getEngine().setAutoAdvance(true);
    setState((s) => ({ ...s, sleepTimer: { setting: null, endsAt: null }, fading: false, playing: false }));
    save();
  }, [getEngine, save, stopFade]);

  const startFade = useCallback((endsAt: number) => {
    if (fadeTimer.current) return;
    setState((s) => ({ ...s, fading: true }));
    fadeTimer.current = setInterval(() => {
      const left = endsAt - Date.now();
      if (left <= 0) { finishSleep(); return; }
      void getEngine().setVolume(Math.max(0, Math.min(1, left / FADE_MS)));
    }, 250);
  }, [finishSleep, getEngine]);

  useEffect(() => {
    const id = setInterval(() => {
      const t = stateRef.current.sleepTimer;
      if (t.endsAt === null || !stateRef.current.playing) return;
      if (Date.now() >= t.endsAt - FADE_MS) startFade(t.endsAt);
    }, 250);
    return () => clearInterval(id);
  }, [startFade]);

  const setSleepTimer = useCallback((setting: SleepTimerSetting) => {
    stopFade();
    void getEngine().setVolume(1);
    getEngine().setAutoAdvance(setting !== 'end-of-chapter');
    setState((s) => ({ ...s, fading: false, sleepTimer: { setting, endsAt: typeof setting === 'number' ? Date.now() + setting * 60_000 : null } }));
  }, [getEngine, stopFade]);

  // --- engine wiring ----------------------------------------------------------------------
  const goTo = useCallback((index: number, positionSeconds = 0) => {
    const s = stateRef.current;
    if (!s.playlist) return;
    const track = s.playlist.tracks[index];
    if (!track) return;
    if (track.blocked) { setState((p) => ({ ...p, blockedIndex: index })); cbs.current.onTrackBlocked?.(index); return; }
    void getEngine().skipTo(index, positionSeconds);
  }, [getEngine]);

  useEffect(() => {
    const e = getEngine();
    const offs = [
      e.on('progress', (p) => { live.current = { ...p }; setState((s) => ({ ...s, index: p.index, positionSeconds: p.positionSeconds, durationSeconds: p.durationSeconds, playing: p.playing, rate: p.rate })); }),
      e.on('trackChanged', ({ index, automatic }) => {
        const s = stateRef.current;
        const track = s.playlist?.tracks[index];
        if (track?.blocked) {
          void e.pause();
          setState((p) => ({ ...p, blockedIndex: index, playing: false }));
          cbs.current.onTrackBlocked?.(index);
          return;
        }
        live.current = { ...live.current, index, positionSeconds: automatic ? 0 : live.current.positionSeconds };
        setState((p) => ({ ...p, index, blockedIndex: null, positionSeconds: automatic ? 0 : p.positionSeconds }));
        if (s.sleepTimer.setting === 'end-of-chapter' && automatic) finishSleep();
        save();
      }),
      e.on('trackEnded', () => {
        const s = stateRef.current;
        if (s.sleepTimer.setting === 'end-of-chapter') {
          // the engine will not advance; park on the next track's start, paused
          const next = s.index + 1;
          finishSleep();
          if (s.playlist && next < s.playlist.tracks.length) goTo(next, 0);
        }
      }),
      e.on('ended', () => {
        const s = stateRef.current;
        const key = s.playlist?.id ?? null;
        setState((p) => ({ ...p, playing: false }));
        save();
        if (key && endedFor.current !== key) { endedFor.current = key; cbs.current.onPlaylistEnd?.(); }
      }),
      e.on('remote', (cmd: RemoteCommand) => {
        switch (cmd.type) {
          case 'play': void e.play(); break;
          case 'pause': case 'stop': void e.pause(); save(); break;
          case 'next': goTo(live.current.index + 1); break;
          case 'previous': goTo(live.current.index - 1); break;
          case 'jumpForward': void e.seekTo(live.current.positionSeconds + JUMP_SECONDS); break;
          case 'jumpBackward': void e.seekTo(Math.max(0, live.current.positionSeconds - JUMP_SECONDS)); break;
          case 'seek': void e.seekTo(cmd.position); break;
          default: break;
        }
      }),
    ];
    return () => { for (const off of offs) off(); };
  }, [finishSleep, getEngine, goTo, save]);

  // --- api ------------------------------------------------------------------------------
  const resolveAll = useCallback(async (playlist: Playlist): Promise<Track[]> => {
    const r = cbs.current.resolveSource;
    if (!r) return playlist.tracks;
    return Promise.all(playlist.tracks.map(async (t) => ({ ...t, source: await r(t.source) })));
  }, []);

  const load = useCallback<PlayerApi['load']>(async (playlist, start) => {
    const e = getEngine();
    await e.setup();
    const saved = start ?? (await progressStore.load(playlist.id)) ?? { trackIndex: 0, positionSeconds: 0, rate: stateRef.current.rate };
    const index = Math.max(0, Math.min(playlist.tracks.length - 1, saved.trackIndex));
    const rate = 'rate' in saved && typeof saved.rate === 'number' ? saved.rate : stateRef.current.rate;
    endedFor.current = null;
    setState((s) => ({ ...s, playlist, index, positionSeconds: saved.positionSeconds, durationSeconds: playlist.tracks[index]?.durationSeconds ?? 0, loaded: true, blockedIndex: null, rate }));
    const tracks = await resolveAll(playlist);
    await e.load(tracks, index, saved.positionSeconds);
    await e.setRate(rate);
    if (playlist.tracks[index]?.blocked) { setState((s) => ({ ...s, blockedIndex: index })); cbs.current.onTrackBlocked?.(index); }
  }, [getEngine, progressStore, resolveAll]);

  const play = useCallback(() => {
    const s = stateRef.current;
    const i = live.current.index;
    if (s.playlist?.tracks[i]?.blocked) { cbs.current.onTrackBlocked?.(i); return; }
    void getEngine().play();
  }, [getEngine]);
  const pause = useCallback(() => { void getEngine().pause(); save(); }, [getEngine, save]);
  const toggle = useCallback(() => { if (stateRef.current.playing) pause(); else play(); }, [pause, play]);
  const seek = useCallback((seconds: number) => { void getEngine().seekTo(Math.max(0, seconds)); }, [getEngine]);
  const jump = useCallback((delta: number) => {
    const s = { ...stateRef.current, ...live.current };
    const target = s.positionSeconds + delta;
    if (delta > 0 && s.durationSeconds > 0 && target >= s.durationSeconds) {
      // past the end: the next track (or the end of the playlist)
      if (s.playlist && s.index + 1 < s.playlist.tracks.length) goTo(s.index + 1, 0);
      else void getEngine().seekTo(s.durationSeconds);
      return;
    }
    void getEngine().seekTo(Math.max(0, target));
  }, [getEngine, goTo]);
  const setRate = useCallback((rate: number) => { void getEngine().setRate(rate); save(); }, [getEngine, save]);
  const cycleRate = useCallback(() => {
    const i = SPEEDS.indexOf(live.current.rate as (typeof SPEEDS)[number]);
    setRate(SPEEDS[(i + 1) % SPEEDS.length]);
  }, [setRate]);
  const skipNext = useCallback(() => goTo(stateRef.current.index + 1), [goTo]);
  const skipPrev = useCallback(() => {
    const s = live.current;
    if (s.positionSeconds > 3) { void getEngine().seekTo(0); return; }
    goTo(Math.max(0, s.index - 1));
  }, [getEngine, goTo]);

  const switchPlaylist = useCallback<PlayerApi['switchPlaylist']>(async (next) => {
    const s = { ...stateRef.current, ...live.current };
    const currentId = s.playlist?.tracks[s.index]?.id;
    const sameTrack = currentId ? next.tracks.findIndex((t) => t.id === currentId) : -1;
    const index = sameTrack >= 0 ? sameTrack : Math.min(s.index, next.tracks.length - 1);
    const position = sameTrack >= 0 || next.tracks[index] ? Math.max(0, s.positionSeconds - JUMP_SECONDS) : 0;
    const wasPlaying = s.playing;
    await load(next, { trackIndex: Math.max(0, index), positionSeconds: position });
    if (wasPlaying) play();
  }, [load, play]);

  const switchVoice = useCallback((id: string) => { cbs.current.onSwitchVoice?.(id); }, []);
  const setExpanded = useCallback((expanded: boolean) => setState((s) => ({ ...s, expanded })), []);
  const close = useCallback(async () => {
    save();
    await getEngine().pause();
    setState({ ...INITIAL, rate: stateRef.current.rate });
  }, [getEngine, save]);
  const currentTrack = useCallback(() => stateRef.current.playlist?.tracks[stateRef.current.index] ?? null, []);

  const value = useMemo<PlayerContextValue>(() => ({
    ...state, voices, load, play, pause, toggle, seek, jump, setRate, cycleRate, skipNext, skipPrev, goTo, setSleepTimer, switchPlaylist, switchVoice, setExpanded, close, currentTrack,
  }), [state, voices, load, play, pause, toggle, seek, jump, setRate, cycleRate, skipNext, skipPrev, goTo, setSleepTimer, switchPlaylist, switchVoice, setExpanded, close, currentTrack]);

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const v = useContext(PlayerContext);
  if (!v) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return v;
}

export function usePlayerOptional(): PlayerContextValue | null { return useContext(PlayerContext); }
