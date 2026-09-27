import type { Track } from '@libraryofages/kit-core';
import { Emitter, sourceUrl, type AudioEngine, type EngineEventName, type EngineEvents, type EngineState } from './AudioEngine';

/** The subset of HTMLMediaElement the engine touches; tests supply a fake. */
export interface MediaLike {
  src: string;
  currentTime: number;
  readonly duration: number;
  playbackRate: number;
  volume: number;
  readonly paused: boolean;
  preload: string;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

const EVENTS = ['timeupdate', 'loadedmetadata', 'durationchange', 'ended', 'play', 'pause', 'ratechange', 'error'] as const;

/** Web (and Jest) engine over one media element; a `file` source is treated as a URL. */
export class HtmlAudioEngine implements AudioEngine {
  private media: MediaLike | null = null;
  private tracks: Track[] = [];
  private index = 0;
  private rate = 1;
  private autoAdvance = true;
  private readonly emitter = new Emitter();
  private readonly listeners: Array<[string, () => void]> = [];

  constructor(private readonly createMedia: () => MediaLike = () => new Audio()) {}

  async setup(): Promise<void> {
    if (this.media) return;
    const m = this.createMedia();
    m.preload = 'metadata';
    this.media = m;
    const bind = (type: string, fn: () => void) => { m.addEventListener(type, fn); this.listeners.push([type, fn]); };
    for (const type of EVENTS) {
      bind(type, () => {
        if (type === 'ended') { this.onEnded(); return; }
        if (type === 'error') { this.emitter.emit('error', { message: `media error on track ${this.index}` }); return; }
        this.emitter.emit('progress', this.state());
      });
    }
  }

  private onEnded(): void {
    const i = this.index;
    this.emitter.emit('trackEnded', { index: i });
    if (i + 1 < this.tracks.length && this.autoAdvance) {
      void this.skipTo(i + 1, 0, true).then(() => this.play());
      return;
    }
    if (i + 1 >= this.tracks.length) this.emitter.emit('ended', { index: i });
    this.emitter.emit('progress', this.state());
  }

  async load(tracks: Track[], startIndex: number, positionSeconds: number): Promise<void> {
    await this.setup();
    this.tracks = tracks;
    await this.skipTo(startIndex, positionSeconds, false);
  }

  async play(): Promise<void> {
    if (!this.media) return;
    try { await this.media.play(); } catch (e) { this.emitter.emit('error', { message: e instanceof Error ? e.message : String(e) }); }
  }

  async pause(): Promise<void> { this.media?.pause(); }

  async seekTo(seconds: number): Promise<void> {
    if (!this.media) return;
    const d = this.media.duration;
    this.media.currentTime = Math.max(0, Number.isFinite(d) && d > 0 ? Math.min(seconds, d) : seconds);
    this.emitter.emit('progress', this.state());
  }

  async skipTo(index: number, positionSeconds = 0, automatic = false): Promise<void> {
    if (!this.media || this.tracks.length === 0) return;
    const target = Math.max(0, Math.min(this.tracks.length - 1, index));
    const wasPlaying = !this.media.paused;
    this.index = target;
    this.media.src = sourceUrl(this.tracks[target]);
    this.media.currentTime = Math.max(0, positionSeconds);
    this.media.playbackRate = this.rate;
    this.emitter.emit('trackChanged', { index: target, automatic });
    this.emitter.emit('progress', this.state());
    if (wasPlaying && !automatic) await this.play();
  }

  async setRate(rate: number): Promise<void> {
    this.rate = rate;
    if (this.media) this.media.playbackRate = rate;
    this.emitter.emit('progress', this.state());
  }

  async setVolume(volume: number): Promise<void> { if (this.media) this.media.volume = Math.max(0, Math.min(1, volume)); }

  setAutoAdvance(enabled: boolean): void { this.autoAdvance = enabled; }

  state(): EngineState {
    const m = this.media;
    const d = m ? m.duration : 0;
    return {
      index: this.index,
      positionSeconds: m ? m.currentTime : 0,
      durationSeconds: Number.isFinite(d) ? d : (this.tracks[this.index]?.durationSeconds ?? 0),
      playing: m ? !m.paused : false,
      rate: this.rate,
    };
  }

  on<E extends EngineEventName>(event: E, handler: (payload: EngineEvents[E]) => void): () => void { return this.emitter.on(event, handler); }

  destroy(): void {
    if (this.media) {
      for (const [type, fn] of this.listeners) this.media.removeEventListener(type, fn);
      this.media.pause();
      this.media.src = '';
    }
    this.listeners.length = 0;
    this.media = null;
    this.emitter.clear();
  }
}
