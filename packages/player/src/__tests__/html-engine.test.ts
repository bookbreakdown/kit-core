import type { Track } from '@libraryofages/kit-core';
import { HtmlAudioEngine, type MediaLike } from '../engine/HtmlAudioEngine';

class FakeMedia implements MediaLike {
  src = '';
  currentTime = 0;
  duration = 10;
  playbackRate = 1;
  volume = 1;
  paused = true;
  preload = '';
  private handlers = new Map<string, Set<() => void>>();
  play() { this.paused = false; this.fire('play'); return Promise.resolve(); }
  pause() { this.paused = true; this.fire('pause'); }
  addEventListener(type: string, l: () => void) { (this.handlers.get(type) ?? this.handlers.set(type, new Set()).get(type))!.add(l); }
  removeEventListener(type: string, l: () => void) { this.handlers.get(type)?.delete(l); }
  fire(type: string) { for (const h of this.handlers.get(type) ?? []) h(); }
}

const tracks: Track[] = [
  { id: 'a', index: 0, title: 'A', source: { kind: 'url', url: 'cdn://a.mp3' }, durationSeconds: 10, backMatter: false },
  { id: 'b', index: 1, title: 'B', source: { kind: 'file', path: 'file:///tmp/b.mp3' }, durationSeconds: 10, backMatter: false },
  { id: 'c', index: 2, title: 'C', source: { kind: 'url', url: 'cdn://c.mp3' }, durationSeconds: 10, backMatter: true },
];

async function make() {
  const media = new FakeMedia();
  const engine = new HtmlAudioEngine(() => media);
  await engine.setup();
  return { media, engine };
}

test('load sets src from a url source and a file source, at the requested position', async () => {
  const { media, engine } = await make();
  await engine.load(tracks, 1, 4);
  expect(media.src).toBe('file:///tmp/b.mp3');
  expect(media.currentTime).toBe(4);
  expect(media.preload).toBe('metadata');
  await engine.skipTo(0);
  expect(media.src).toBe('cdn://a.mp3');
});

test('seekTo and setRate reach the element; state reflects them', async () => {
  const { media, engine } = await make();
  await engine.load(tracks, 0, 0);
  await engine.seekTo(7);
  expect(media.currentTime).toBe(7);
  await engine.seekTo(99);
  expect(media.currentTime).toBe(10);
  await engine.setRate(1.5);
  expect(media.playbackRate).toBe(1.5);
  expect(engine.state()).toMatchObject({ index: 0, positionSeconds: 10, durationSeconds: 10, rate: 1.5, playing: false });
});

test('ended on a middle track advances (trackEnded then trackChanged automatic); on the last track emits ended', async () => {
  const { media, engine } = await make();
  const events: string[] = [];
  engine.on('trackEnded', (e) => events.push(`trackEnded:${e.index}`));
  engine.on('trackChanged', (e) => events.push(`trackChanged:${e.index}:${e.automatic}`));
  engine.on('ended', (e) => events.push(`ended:${e.index}`));
  await engine.load(tracks, 1, 0);
  await engine.play();
  media.fire('ended');
  await Promise.resolve();
  expect(media.src).toBe('cdn://c.mp3');
  expect(events).toEqual(['trackChanged:1:false', 'trackEnded:1', 'trackChanged:2:true']);
  media.fire('ended');
  expect(events[events.length - 2]).toBe('trackEnded:2');
  expect(events[events.length - 1]).toBe('ended:2');
});

test('setAutoAdvance(false) stops at the track boundary', async () => {
  const { media, engine } = await make();
  const events: string[] = [];
  engine.on('trackChanged', (e) => events.push(`trackChanged:${e.index}`));
  await engine.load(tracks, 0, 0);
  engine.setAutoAdvance(false);
  media.fire('ended');
  expect(media.src).toBe('cdn://a.mp3');
  expect(events).toEqual(['trackChanged:0']);
});

test('destroy releases the element', async () => {
  const { media, engine } = await make();
  await engine.load(tracks, 0, 0);
  engine.destroy();
  expect(media.src).toBe('');
  expect(engine.state().positionSeconds).toBe(0);
});
