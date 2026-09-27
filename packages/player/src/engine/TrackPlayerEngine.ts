import TrackPlayer, { AppKilledPlaybackBehavior, Capability, Event, State, type Track as RntpTrack } from 'react-native-track-player';
import type { Track } from '@libraryofages/kit-core';
import { Emitter, sourceUrl, type AudioEngine, type EngineEventName, type EngineEvents, type EngineState } from './AudioEngine';

const JUMP_SECONDS = 15;
let playerReady: Promise<void> | null = null;

/**
 * Android engine over react-native-track-player: notification and lock-screen controls,
 * background playback, rate. The host registers `playbackService` in its entry file.
 */
export class TrackPlayerEngine implements AudioEngine {
  private tracks: Track[] = [];
  private current: EngineState = { index: 0, positionSeconds: 0, durationSeconds: 0, playing: false, rate: 1 };
  private autoAdvance = true;
  private readonly emitter = new Emitter();
  private subscriptions: Array<{ remove(): void }> = [];

  async setup(): Promise<void> {
    if (!playerReady) {
      playerReady = (async () => {
        await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
        await TrackPlayer.updateOptions({
          android: { appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback },
          capabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious, Capability.SeekTo, Capability.JumpForward, Capability.JumpBackward],
          compactCapabilities: [Capability.Play, Capability.Pause, Capability.JumpForward, Capability.JumpBackward],
          forwardJumpInterval: JUMP_SECONDS,
          backwardJumpInterval: JUMP_SECONDS,
          progressUpdateEventInterval: 1,
        });
      })();
    }
    await playerReady;
    if (this.subscriptions.length) return;
    const sub = <T extends Event>(event: T, fn: (e: never) => void) => { this.subscriptions.push(TrackPlayer.addEventListener(event, fn as never)); };
    sub(Event.PlaybackProgressUpdated, (e: { position: number; duration: number; track: number }) => {
      this.current = { ...this.current, positionSeconds: e.position, durationSeconds: e.duration, index: e.track };
      this.emitter.emit('progress', this.state());
    });
    sub(Event.PlaybackActiveTrackChanged, (e: { index?: number; lastIndex?: number; lastPosition?: number }) => {
      if (e.index === undefined) return;
      const automatic = e.lastIndex !== undefined && e.index === e.lastIndex + 1;
      if (automatic && e.lastIndex !== undefined) this.emitter.emit('trackEnded', { index: e.lastIndex });
      if (automatic && !this.autoAdvance) void TrackPlayer.pause();
      this.current = { ...this.current, index: e.index, positionSeconds: 0 };
      this.emitter.emit('trackChanged', { index: e.index, automatic });
      this.emitter.emit('progress', this.state());
    });
    sub(Event.PlaybackQueueEnded, (e: { track: number }) => {
      this.emitter.emit('trackEnded', { index: e.track });
      this.emitter.emit('ended', { index: e.track });
    });
    sub(Event.PlaybackState, (e: { state: State }) => {
      this.current = { ...this.current, playing: e.state === State.Playing || e.state === State.Buffering };
      this.emitter.emit('progress', this.state());
    });
    sub(Event.PlaybackError, (e: { message: string }) => this.emitter.emit('error', { message: e.message }));
    sub(Event.RemotePlay, () => this.emitter.emit('remote', { type: 'play' }));
    sub(Event.RemotePause, () => this.emitter.emit('remote', { type: 'pause' }));
    sub(Event.RemoteStop, () => this.emitter.emit('remote', { type: 'stop' }));
    sub(Event.RemoteNext, () => this.emitter.emit('remote', { type: 'next' }));
    sub(Event.RemotePrevious, () => this.emitter.emit('remote', { type: 'previous' }));
    sub(Event.RemoteJumpForward, () => this.emitter.emit('remote', { type: 'jumpForward' }));
    sub(Event.RemoteJumpBackward, () => this.emitter.emit('remote', { type: 'jumpBackward' }));
    sub(Event.RemoteSeek, (e: { position: number }) => this.emitter.emit('remote', { type: 'seek', position: e.position }));
  }

  private toRntp(t: Track): RntpTrack {
    return { url: sourceUrl(t), title: t.title, duration: t.durationSeconds, artwork: t.artworkUrl };
  }

  async load(tracks: Track[], startIndex: number, positionSeconds: number): Promise<void> {
    await this.setup();
    this.tracks = tracks;
    await TrackPlayer.reset();
    await TrackPlayer.add(tracks.map((t) => this.toRntp(t)));
    const target = Math.max(0, Math.min(tracks.length - 1, startIndex));
    await TrackPlayer.skip(target, Math.max(0, positionSeconds));
    await TrackPlayer.setRate(this.current.rate);
    this.current = { ...this.current, index: target, positionSeconds, durationSeconds: tracks[target]?.durationSeconds ?? 0 };
    this.emitter.emit('trackChanged', { index: target, automatic: false });
    this.emitter.emit('progress', this.state());
  }

  async play(): Promise<void> { await TrackPlayer.play(); }
  async pause(): Promise<void> { await TrackPlayer.pause(); }
  async seekTo(seconds: number): Promise<void> { await TrackPlayer.seekTo(Math.max(0, seconds)); this.current = { ...this.current, positionSeconds: seconds }; this.emitter.emit('progress', this.state()); }
  async skipTo(index: number, positionSeconds = 0): Promise<void> {
    const target = Math.max(0, Math.min(this.tracks.length - 1, index));
    await TrackPlayer.skip(target, positionSeconds);
  }
  async setRate(rate: number): Promise<void> { this.current = { ...this.current, rate }; await TrackPlayer.setRate(rate); this.emitter.emit('progress', this.state()); }
  async setVolume(volume: number): Promise<void> { await TrackPlayer.setVolume(Math.max(0, Math.min(1, volume))); }
  setAutoAdvance(enabled: boolean): void { this.autoAdvance = enabled; }
  state(): EngineState { return { ...this.current }; }
  on<E extends EngineEventName>(event: E, handler: (payload: EngineEvents[E]) => void): () => void { return this.emitter.on(event, handler); }
  destroy(): void {
    for (const s of this.subscriptions) s.remove();
    this.subscriptions = [];
    this.emitter.clear();
  }
}

/** The playback service the host registers: `TrackPlayer.registerPlaybackService(playbackService)`. */
export const playbackService = async (): Promise<void> => {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => TrackPlayer.seekTo(e.position));
  TrackPlayer.addEventListener(Event.RemoteJumpForward, () => TrackPlayer.seekBy(JUMP_SECONDS));
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => TrackPlayer.seekBy(-JUMP_SECONDS));
};

export function registerPlaybackService(): void {
  TrackPlayer.registerPlaybackService(() => playbackService);
}
