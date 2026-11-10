import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { ListeningPosition, Playlist, Track } from '@libraryofages/kit-core';
import type { AudioEngine, RemoteCommand } from './engine/AudioEngine';
import { sourceUrl } from './engine/AudioEngine';
import { createEngine } from './engine/createEngine';
import { FADE_MS, JUMP_SECONDS, SAVE_INTERVAL_MS, SPEEDS, type PlayerApi, type PlayerContextValue, type PlayerPanel, type PlayerProviderProps, type PlayerState, type SleepTimerSetting } from './types';

const PlayerContext = createContext<PlayerContextValue | null>(null);

const INITIAL: PlayerState = {
  playlist: null, index: 0, positionSeconds: 0, durationSeconds: 0, playing: false, rate: 1,
  sleepTimer: { setting: null, endsAt: null }, blockedIndex: null, loaded: false, expanded: false, openPanel: null, fading: false,
};

/**
 * Audible-feel player logic above an `AudioEngine`: queue position, progress cadence, ±15 s,
 * speed, sleep timer with fade, voice switch keeping the place, blocked tracks, end detection.
 */
export function PlayerProvider(props: PlayerProviderProps) {
  const { theme, progressStore, resolveSource, engineFactory, voices = [], onSwitchVoice, onTrackBlocked, onPlaylistEnd, onTrackError, saveIntervalMs = SAVE_INTERVAL_MS, children } = props;
  void theme;
  const engine = useRef<AudioEngine | null>(null);
  const [state, setState] = useState<PlayerState>(INITIAL);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Engine truth, updated synchronously by engine events; React state lags by a render.
  const live = useRef({ index: 0, positionSeconds: 0, durationSeconds: 0, rate: 1, playing: false });
  const recovery = useRef({ generation: 0, attempted: new Set<string>(), pending: false, replacing: false, failed: false });
  const resolvedTracks = useRef<Track[]>([]);
  const playRequested = useRef(false);
  const endedFor = useRef<string | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cbs = useRef({ onTrackBlocked, onPlaylistEnd, onSwitchVoice, resolveSource, onTrackError });
  cbs.current = { onTrackBlocked, onPlaylistEnd, onSwitchVoice, resolveSource, onTrackError };

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

  useEffect(() => () => { recovery.current.generation++; save(); engine.current?.destroy(); engine.current = null; }, [save]);

  // --- sleep timer ------------------------------------------------------------------------
  const stopFade = useCallback(() => {
    if (fadeTimer.current) { clearInterval(fadeTimer.current); fadeTimer.current = null; }
  }, []);

  const finishSleep = useCallback(() => {
    stopFade();
    playRequested.current = false;
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
    if (recovery.current.pending) {
      recovery.current.generation++;
      recovery.current.pending = false;
      recovery.current.replacing = false;
    }
    void getEngine().skipTo(index, positionSeconds);
  }, [getEngine]);

  useEffect(() => {
    const e = getEngine();
    const offs = [
      e.on('error', ({ message }) => {
        const refresh = cbs.current.onTrackError;
        if (!refresh) return; // No recovery hook: preserve the existing engine behavior.
        const r = recovery.current;
        const surface = (error: string) => {
          r.failed = true;
          playRequested.current = false;
          void e.pause();
          setState((s) => ({ ...s, playing: false, error }));
        };
        if (r.pending) {
          // Duplicate errors from the dead source share one refresh. Errors emitted by the
          // replacement are terminal, including engines which emit rather than reject play().
          if (r.replacing) surface(message);
          return;
        }
        const s = stateRef.current;
        const { index, positionSeconds, rate } = live.current;
        const track = resolvedTracks.current[index] ?? s.playlist?.tracks[index];
        if (!track || !s.playlist) { surface(message); return; }
        const url = sourceUrl(track);
        if (r.attempted.has(url)) { surface(message); return; }
        r.attempted.add(url);
        r.pending = true;
        r.failed = false;
        const generation = r.generation;
        const playlist = s.playlist;
        const wasPlaying = live.current.playing || playRequested.current;
        playRequested.current = wasPlaying;
        void (async () => {
          try {
            const tracks = await refresh({ track, index, positionMs: Math.round(positionSeconds * 1000), message });
            if (generation !== r.generation) return;
            if (!tracks?.[index] || tracks[index].blocked) { surface(message); return; }
            const resolver = cbs.current.resolveSource;
            const resolved = resolver ? await Promise.all(tracks.map(async (t) => ({ ...t, source: await resolver(t.source) }))) : tracks;
            if (generation !== r.generation) return;
            r.attempted.add(sourceUrl(resolved[index]));
            r.replacing = true;
            resolvedTracks.current = resolved;
            // Make playlist truth available before synchronous engine events during load.
            stateRef.current = { ...stateRef.current, playlist: { ...playlist, tracks }, error: null };
            setState((p) => ({ ...p, playlist: { ...playlist, tracks }, error: null }));
            await e.load(resolved, index, positionSeconds);
            if (generation !== r.generation || r.failed) return;
            await e.setRate(rate);
            if (wasPlaying && playRequested.current) await e.play();
          } catch (error) {
            if (generation === r.generation) surface(error instanceof Error ? error.message : String(error));
          } finally {
            if (generation === r.generation) { r.pending = false; r.replacing = false; }
          }
        })();
      }),
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
        playRequested.current = false;
        setState((p) => ({ ...p, playing: false }));
        save();
        if (key && endedFor.current !== key) { endedFor.current = key; cbs.current.onPlaylistEnd?.(); }
      }),
      e.on('remote', (cmd: RemoteCommand) => {
        switch (cmd.type) {
          case 'play': playRequested.current = true; void e.play(); break;
          case 'pause': case 'stop': playRequested.current = false; void e.pause(); save(); break;
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
    const r = recovery.current;
    r.generation++; r.pending = false; r.replacing = false; r.failed = false;
    playRequested.current = false;
    await e.setup();
    const saved = start ?? (await progressStore.load(playlist.id)) ?? { trackIndex: 0, positionSeconds: 0, rate: stateRef.current.rate };
    const index = Math.max(0, Math.min(playlist.tracks.length - 1, saved.trackIndex));
    const rate = 'rate' in saved && typeof saved.rate === 'number' ? saved.rate : stateRef.current.rate;
    endedFor.current = null;
    setState((s) => ({ ...s, playlist, index, positionSeconds: saved.positionSeconds, durationSeconds: playlist.tracks[index]?.durationSeconds ?? 0, loaded: true, blockedIndex: null, rate, ...(cbs.current.onTrackError ? { error: null } : {}) }));
    const tracks = await resolveAll(playlist);
    resolvedTracks.current = tracks;
    await e.load(tracks, index, saved.positionSeconds);
    await e.setRate(rate);
    if (playlist.tracks[index]?.blocked) { setState((s) => ({ ...s, blockedIndex: index })); cbs.current.onTrackBlocked?.(index); }
  }, [getEngine, progressStore, resolveAll]);

  const play = useCallback(() => {
    const s = stateRef.current;
    const i = live.current.index;
    if (s.playlist?.tracks[i]?.blocked) { cbs.current.onTrackBlocked?.(i); return; }
    playRequested.current = true;
    void getEngine().play();
  }, [getEngine]);
  const pause = useCallback(() => { playRequested.current = false; void getEngine().pause(); save(); }, [getEngine, save]);
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
  const setExpanded = useCallback((expanded: boolean, panel?: PlayerPanel) => setState((s) => ({ ...s, expanded, openPanel: expanded ? panel ?? null : null })), []);
  const close = useCallback(async () => {
    recovery.current.generation++;
    playRequested.current = false;
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
