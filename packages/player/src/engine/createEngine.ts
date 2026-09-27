import type { AudioEngine } from './AudioEngine';
import { TrackPlayerEngine, registerPlaybackService as register } from './TrackPlayerEngine';

/** Native default (Metro picks createEngine.web.ts on web). */
export function createEngine(): AudioEngine { return new TrackPlayerEngine(); }
export function registerPlaybackService(): void { register(); }
