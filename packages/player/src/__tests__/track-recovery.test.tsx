import { useEffect } from 'react';
import { act, render } from '@testing-library/react-native';
import type { Playlist, Track } from '@libraryofages/kit-core';
import { Emitter, type AudioEngine, type EngineEventName, type EngineEvents, type EngineState } from '../engine/AudioEngine';
import { PlayerProvider, usePlayer } from '../PlayerProvider';
import type { PlayerContextValue, PlayerProviderProps } from '../types';

class FakeEngine implements AudioEngine {
  st: EngineState = { index: 0, positionSeconds: 0, durationSeconds: 100, playing: false, rate: 1 };
  emitter = new Emitter();
  load = jest.fn(async (_tracks: Track[], index: number, positionSeconds: number) => {
    this.st = { ...this.st, index, positionSeconds, playing: false };
    this.emitter.emit('progress', this.st);
  });
  play = jest.fn(async () => { this.st.playing = true; this.emitter.emit('progress', this.st); });
  pause = jest.fn(async () => { this.st.playing = false; this.emitter.emit('progress', this.st); });
  async setup() {}
  async seekTo(positionSeconds: number) { this.st.positionSeconds = positionSeconds; }
  async skipTo(index: number) { this.st.index = index; }
  async setRate(rate: number) { this.st.rate = rate; this.emitter.emit('progress', this.st); }
  async setVolume() {}
  setAutoAdvance() {}
  state() { return this.st; }
  on<E extends EngineEventName>(e: E, h: (p: EngineEvents[E]) => void) { return this.emitter.on(e, h); }
  destroy() {}
  fail(message = 'expired URL') { this.emitter.emit('error', { message }); }
}
const tracks: Track[] = [0, 1].map((index) => ({ id: String(index), index, title: `Chapter ${index}`, source: { kind: 'url', url: `https://old/${index}.mp3` }, durationSeconds: 100, backMatter: false }));
const fresh = tracks.map((t) => ({ ...t, source: { kind: 'url' as const, url: `https://new/${t.index}.mp3` } }));
const playlist: Playlist = { id: 'book', title: 'Book', tracks, finishTrackIndex: 1 };
const theme = { name: 't', colors: { background: 'white', text: 'black', muted: 'gray', accent: 'blue', surface: 'white', border: 'gray' }, fonts: { serif: 'serif', sans: 'sans' } };
let api: PlayerContextValue;
function Grab() { const p = usePlayer(); useEffect(() => { api = p; }); return null; }
async function mount(extra: Partial<PlayerProviderProps> = {}, playing = true) {
  const engine = new FakeEngine();
  const view = render(<PlayerProvider theme={theme} progressStore={{ load: async () => null, save: async () => {} }} engineFactory={() => engine} {...extra}><Grab /></PlayerProvider>);
  await act(async () => { await api.load(playlist, { trackIndex: 1, positionSeconds: 23.456 }); });
  if (playing) await act(async () => { api.play(); });
  return { engine, ...view };
}
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

test('dead URL refresh replaces tracks and resumes the same index, exact position and rate', async () => {
  const onTrackError = jest.fn(async () => fresh);
  const { engine } = await mount({ onTrackError });
  await act(async () => { api.setRate(1.5); engine.fail(); });
  await flush();
  expect(onTrackError).toHaveBeenCalledWith({ track: tracks[1], index: 1, positionMs: 23456, message: 'expired URL' });
  expect(engine.load).toHaveBeenLastCalledWith(fresh, 1, 23.456);
  expect(engine.st).toMatchObject({ playing: true, rate: 1.5, index: 1, positionSeconds: 23.456 });
  expect(api.playlist?.tracks).toEqual(fresh);
});

test('a paused listener remains paused after recovery', async () => {
  const { engine } = await mount({ onTrackError: async () => fresh }, false);
  await act(async () => { engine.fail(); }); await flush();
  expect(engine.st.playing).toBe(false);
  expect(engine.play).not.toHaveBeenCalled();
});

test('duplicate errors call the hook once, replacement failure surfaces without retry', async () => {
  let finish!: (tracks: Track[]) => void;
  const onTrackError = jest.fn(() => new Promise<Track[]>((r) => { finish = r; }));
  const { engine } = await mount({ onTrackError });
  await act(async () => { engine.fail(); engine.fail(); });
  expect(onTrackError).toHaveBeenCalledTimes(1);
  await act(async () => { finish(fresh); }); await flush();
  await act(async () => { engine.fail('replacement also dead'); });
  expect(onTrackError).toHaveBeenCalledTimes(1);
  expect(api.error).toBe('replacement also dead');
  expect(engine.st.playing).toBe(false);
});

test.each(['null', 'throw'])('a %s refresh result surfaces the error and stops', async (mode) => {
  const { engine } = await mount({ onTrackError: async () => { if (mode === 'throw') throw new Error('refresh unavailable'); return null; } });
  await act(async () => { engine.fail(); }); await flush();
  expect(api.error).toBe(mode === 'throw' ? 'refresh unavailable' : 'expired URL');
  expect(engine.load).toHaveBeenCalledTimes(1);
  expect(engine.st.playing).toBe(false);
});

test('an engine that emits an error while loading replacement does not resume or recurse', async () => {
  const onTrackError = jest.fn(async () => fresh);
  const { engine } = await mount({ onTrackError });
  engine.load.mockImplementationOnce(async () => { engine.fail('load failed'); });
  await act(async () => { engine.fail(); }); await flush();
  expect(api.error).toBe('load failed');
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(onTrackError).toHaveBeenCalledTimes(1);
});

test('loading another playlist invalidates a pending refresh', async () => {
  let finish!: (tracks: Track[]) => void;
  const { engine } = await mount({ onTrackError: () => new Promise((r) => { finish = r; }) });
  await act(async () => { engine.fail(); await api.load({ ...playlist, id: 'other' }); });
  await act(async () => { finish(fresh); }); await flush();
  expect(engine.load).toHaveBeenCalledTimes(2);
  expect(api.playlist?.id).toBe('other');
});

test('without the hook an engine error keeps legacy behavior and state shape', async () => {
  const { engine } = await mount();
  const before = api;
  await act(async () => { engine.fail(); }); await flush();
  expect(api).toBe(before);
  expect(api).not.toHaveProperty('error');
  expect(engine.load).toHaveBeenCalledTimes(1);
});


test('pause during refresh wins over the original playing state', async () => {
  let finish!: (tracks: Track[]) => void;
  const { engine } = await mount({ onTrackError: () => new Promise((r) => { finish = r; }) });
  await act(async () => { engine.fail(); api.pause(); });
  await act(async () => { finish(fresh); }); await flush();
  expect(engine.st.playing).toBe(false);
  expect(engine.play).toHaveBeenCalledTimes(1);
});

test('refreshed sources pass through the host local resolver', async () => {
  const resolveSource = jest.fn(async () => ({ kind: 'file' as const, path: 'file:///download.mp3' }));
  const { engine } = await mount({ onTrackError: async () => fresh, resolveSource });
  await act(async () => { engine.fail(); }); await flush();
  expect(resolveSource).toHaveBeenCalledTimes(4);
  expect(engine.load.mock.calls[1][0][1].source).toEqual({ kind: 'file', path: 'file:///download.mp3' });
});

test('close invalidates an in-flight refresh and a new load clears an old error', async () => {
  let finish!: (tracks: Track[]) => void;
  const { engine } = await mount({ onTrackError: () => new Promise((r) => { finish = r; }) });
  await act(async () => { engine.fail(); await api.close(); });
  await act(async () => { finish(fresh); }); await flush();
  expect(api.playlist).toBeNull();
  expect(engine.load).toHaveBeenCalledTimes(1);
});
