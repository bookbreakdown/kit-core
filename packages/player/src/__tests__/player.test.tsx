import { useEffect } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ListeningPosition, Playlist, ProgressStore, Track, TrackSource } from '@libraryofages/kit-core';
import { Emitter, type AudioEngine, type EngineEventName, type EngineEvents, type EngineState } from '../engine/AudioEngine';
import { PlayerProvider, usePlayer } from '../PlayerProvider';
import { FullPlayerSheet } from '../ui/FullPlayerSheet';
import { MiniPlayer } from '../ui/MiniPlayer';
import type { PlayerContextValue } from '../types';

/** A scriptable engine: tests drive time and endings by hand. */
class FakeEngine implements AudioEngine {
  tracks: Track[] = [];
  st: EngineState = { index: 0, positionSeconds: 0, durationSeconds: 10, playing: false, rate: 1 };
  volume = 1;
  autoAdvance = true;
  loads: Array<{ tracks: Track[]; index: number; position: number }> = [];
  readonly em = new Emitter();
  async setup() {}
  async load(tracks: Track[], index: number, position: number) { this.tracks = tracks; this.loads.push({ tracks, index, position }); this.st = { ...this.st, index, positionSeconds: position, durationSeconds: tracks[index]?.durationSeconds ?? 10 }; this.em.emit('trackChanged', { index, automatic: false }); this.emit(); }
  async play() { this.st.playing = true; this.emit(); }
  async pause() { this.st.playing = false; this.emit(); }
  async seekTo(s: number) { this.st.positionSeconds = Math.min(s, this.st.durationSeconds); this.emit(); }
  async skipTo(i: number, p = 0) { this.st.index = i; this.st.positionSeconds = p; this.st.durationSeconds = this.tracks[i]?.durationSeconds ?? 10; this.em.emit('trackChanged', { index: i, automatic: false }); this.emit(); }
  async setRate(r: number) { this.st.rate = r; this.emit(); }
  async setVolume(v: number) { this.volume = v; }
  setAutoAdvance(e: boolean) { this.autoAdvance = e; }
  state() { return { ...this.st }; }
  on<E extends EngineEventName>(e: E, h: (p: EngineEvents[E]) => void) { return this.em.on(e, h); }
  destroy() {}
  emit() { this.em.emit('progress', this.state()); }
  tick(seconds: number) { this.st.positionSeconds += seconds; this.emit(); }
  endTrack() {
    const i = this.st.index;
    this.em.emit('trackEnded', { index: i });
    if (i + 1 < this.tracks.length && this.autoAdvance) { this.st.index = i + 1; this.st.positionSeconds = 0; this.em.emit('trackChanged', { index: i + 1, automatic: true }); this.emit(); }
    else if (i + 1 >= this.tracks.length) { this.st.playing = false; this.em.emit('ended', { index: i }); this.emit(); }
  }
}

function memoryStore(initial: Record<string, ListeningPosition> = {}): ProgressStore & { saves: Array<[string, ListeningPosition]> } {
  const data = new Map(Object.entries(initial));
  const saves: Array<[string, ListeningPosition]> = [];
  return { saves, load: async (id) => data.get(id) ?? null, save: async (id, p) => { data.set(id, p); saves.push([id, p]); } };
}

const theme = { name: 't', colors: { background: 'paper', text: 'ink', muted: 'ash', accent: 'ember', surface: 'card', border: 'line' }, fonts: { serif: 'serif', sans: 'sans' } };
const track = (id: string, i: number, extra: Partial<Track> = {}): Track => ({ id, index: i, title: `Track ${id}`, source: { kind: 'url', url: `cdn://${id}.mp3` }, durationSeconds: 10, backMatter: false, ...extra });
const playlist: Playlist = { id: 'book', title: 'Book', tracks: [track('a', 0), track('b', 1), track('c', 2)], finishTrackIndex: 2 };

let api: PlayerContextValue | null = null;
function Grab() { const p = usePlayer(); useEffect(() => { api = p; }); return <Text testID="pos">{`${p.index}:${p.positionSeconds}:${p.playing ? 'playing' : 'paused'}:${p.rate}`}</Text>; }

function mount(engine: FakeEngine, extra: Partial<React.ComponentProps<typeof PlayerProvider>> = {}, store = memoryStore()) {
  const utils = render(
    <PlayerProvider theme={theme} progressStore={store} engineFactory={() => engine} {...extra}>
      <Grab />
      <MiniPlayer theme={theme} />
      <FullPlayerSheet theme={theme} />
    </PlayerProvider>,
  );
  return { ...utils, store };
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => { api = null; jest.useRealTimers(); });

test('load restores the saved position and rate; a 5 s tick saves while playing; pause saves', async () => {
  const engine = new FakeEngine();
  const store = memoryStore({ book: { trackIndex: 1, positionSeconds: 42, rate: 1.25 } });
  const { getByTestId } = mount(engine, { saveIntervalMs: 50 }, store);
  await settle();
  await act(async () => { await api!.load(playlist); });
  expect(engine.loads[0]).toMatchObject({ index: 1, position: 42 });
  expect(getByTestId('pos').props.children).toBe('1:42:paused:1.25');
  await act(async () => { api!.play(); });
  await act(async () => { engine.tick(3); });
  await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
  expect(store.saves.some(([, p]) => p.trackIndex === 1 && p.positionSeconds === 45)).toBe(true);
  const before = store.saves.length;
  await act(async () => { engine.tick(1); api!.pause(); });
  expect(store.saves.length).toBeGreaterThan(before);
  expect(store.saves[store.saves.length - 1][1]).toMatchObject({ trackIndex: 1, positionSeconds: 46, rate: 1.25 });
});

test('skipNext advances and saves; ±15 clamps and crosses into the next track; speed cycles', async () => {
  const engine = new FakeEngine();
  const { store } = mount(engine);
  await settle();
  await act(async () => { await api!.load(playlist, { trackIndex: 0, positionSeconds: 2 }); });
  await act(async () => { api!.skipNext(); });
  expect(engine.st.index).toBe(1);
  expect(store.saves[store.saves.length - 1][1].trackIndex).toBe(1);
  await act(async () => { api!.jump(-15); });
  expect(engine.st.positionSeconds).toBe(0);
  await act(async () => { api!.jump(15); });
  expect(engine.st.index).toBe(2);
  await act(async () => { api!.cycleRate(); });
  expect(engine.st.rate).toBe(1.25);
  await act(async () => { api!.cycleRate(); api!.cycleRate(); api!.cycleRate(); });
  expect(engine.st.rate).toBe(0.5);
});

test('switchPlaylist keeps the track and rewinds 15 s; resolveSource is awaited before load', async () => {
  const engine = new FakeEngine();
  const resolved: string[] = [];
  const resolveSource = async (s: TrackSource): Promise<TrackSource> => { resolved.push(s.kind === 'url' ? s.url : s.path); return { kind: 'file', path: `/local/${resolved.length}.mp3` }; };
  mount(engine, { resolveSource });
  await settle();
  await act(async () => { await api!.load(playlist, { trackIndex: 1, positionSeconds: 40 }); });
  expect(resolved).toHaveLength(3);
  expect(engine.loads[0].tracks[0].source).toEqual({ kind: 'file', path: '/local/1.mp3' });
  const other: Playlist = { ...playlist, id: 'book-voice-b', tracks: [track('c', 0), track('b', 1), track('a', 2)] };
  await act(async () => { await api!.switchPlaylist(other); });
  expect(engine.loads[1]).toMatchObject({ index: 1, position: 25 });
});

test('sleep timer: minutes → fade then stop; end-of-chapter stops at the boundary', async () => {
  const engine = new FakeEngine();
  mount(engine);
  await settle();
  await act(async () => { await api!.load(playlist, { trackIndex: 0, positionSeconds: 0 }); api!.play(); });
  await act(async () => { api!.setSleepTimer(0.1); }); // 6 s: fade starts at 1 s, stops at 6 s
  await act(async () => { await new Promise((r) => setTimeout(r, 1500)); });
  expect(engine.volume).toBeLessThan(1);
  expect(api!.fading).toBe(true);
  await act(async () => { await new Promise((r) => setTimeout(r, 5000)); });
  expect(engine.st.playing).toBe(false);
  expect(engine.volume).toBe(1);
  expect(api!.sleepTimer.setting).toBeNull();

  await act(async () => { api!.play(); api!.setSleepTimer('end-of-chapter'); });
  expect(engine.autoAdvance).toBe(false);
  await act(async () => { engine.endTrack(); });
  expect(engine.st.playing).toBe(false);
  expect(engine.st.index).toBe(1);
  expect(api!.sleepTimer.setting).toBeNull();
  expect(engine.autoAdvance).toBe(true);
}, 15000);

test('onPlaylistEnd fires once; a blocked track is refused and reported', async () => {
  const engine = new FakeEngine();
  const onPlaylistEnd = jest.fn();
  const onTrackBlocked = jest.fn();
  const blocked: Playlist = { ...playlist, tracks: [track('a', 0), track('b', 1, { blocked: true }), track('c', 2)] };
  const { getByTestId } = mount(engine, { onPlaylistEnd, onTrackBlocked });
  await settle();
  await act(async () => { await api!.load(blocked, { trackIndex: 0, positionSeconds: 0 }); api!.play(); });
  await act(async () => { api!.goTo(1); });
  expect(onTrackBlocked).toHaveBeenCalledWith(1);
  expect(engine.st.index).toBe(0);
  await act(async () => { api!.setExpanded(true); });
  expect(getByTestId('player-blocked')).toBeTruthy();
  fireEvent.press(getByTestId('player-chapters'));
  expect(getByTestId('chapter-1').props.accessibilityState).toMatchObject({ disabled: true });
  await act(async () => { api!.goTo(2); });
  expect(engine.st.index).toBe(2);
  await act(async () => { engine.endTrack(); engine.endTrack(); });
  expect(onPlaylistEnd).toHaveBeenCalledTimes(1);
});

test('the mini player shows the track and toggles playback', async () => {
  const engine = new FakeEngine();
  const { getByTestId, queryByTestId } = mount(engine);
  await settle();
  expect(queryByTestId('mini-player')).toBeNull();
  await act(async () => { await api!.load(playlist); });
  await waitFor(() => expect(getByTestId('mini-player')).toBeTruthy());
  fireEvent.press(getByTestId('mini-toggle'));
  await settle();
  expect(engine.st.playing).toBe(true);
  fireEvent.press(getByTestId('mini-expand'));
  await waitFor(() => expect(getByTestId('full-player')).toBeTruthy());
  fireEvent.press(getByTestId('player-fwd15'));
  await settle();
  // +15 from 0 s of a 10 s track crosses into the next track
  expect(engine.st.index).toBe(1);
  expect(engine.st.positionSeconds).toBe(0);
});
