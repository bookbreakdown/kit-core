import type { Track } from '@libraryofages/kit-core';

export interface EngineState {
  index: number;
  positionSeconds: number;
  durationSeconds: number;
  playing: boolean;
  rate: number;
}

export type RemoteCommand =
  | { type: 'play' | 'pause' | 'stop' | 'next' | 'previous' | 'jumpForward' | 'jumpBackward' }
  | { type: 'seek'; position: number };

export interface EngineEvents {
  /** Position, duration, playing or rate changed. */
  progress: EngineState;
  /** The active track index changed (a skip, or an automatic advance). */
  trackChanged: { index: number; automatic: boolean };
  /** A track reached its end; fires before any automatic advance. */
  trackEnded: { index: number };
  /** The last track ended (no automatic advance possible). */
  ended: { index: number };
  error: { message: string };
  /** A lock-screen / notification / headset command. */
  remote: RemoteCommand;
}

export type EngineEventName = keyof EngineEvents;

/**
 * The playback engine the player logic sits on: an HTMLAudioElement on web (and in Jest),
 * react-native-track-player on Android. Everything above it is proven once on the HTML engine.
 */
export interface AudioEngine {
  setup(): Promise<void>;
  load(tracks: Track[], startIndex: number, positionSeconds: number): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  skipTo(index: number, positionSeconds?: number): Promise<void>;
  setRate(rate: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  /** When false the engine pauses at a track's end instead of advancing (sleep timer "end of chapter"). */
  setAutoAdvance(enabled: boolean): void;
  state(): EngineState;
  on<E extends EngineEventName>(event: E, handler: (payload: EngineEvents[E]) => void): () => void;
  destroy(): void;
}

export class Emitter {
  private handlers = new Map<string, Set<(p: unknown) => void>>();

  on<E extends EngineEventName>(event: E, handler: (payload: EngineEvents[E]) => void): () => void {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as (p: unknown) => void);
    this.handlers.set(event, set);
    return () => { set.delete(handler as (p: unknown) => void); };
  }

  emit<E extends EngineEventName>(event: E, payload: EngineEvents[E]): void {
    for (const h of this.handlers.get(event) ?? []) h(payload);
  }

  clear(): void { this.handlers.clear(); }
}

export function sourceUrl(track: Track): string {
  return track.source.kind === 'url' ? track.source.url : track.source.path;
}
