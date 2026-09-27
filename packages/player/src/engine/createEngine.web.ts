import type { AudioEngine } from './AudioEngine';
import { HtmlAudioEngine } from './HtmlAudioEngine';

export function createEngine(): AudioEngine { return new HtmlAudioEngine(); }
/** No background service on web. */
export function registerPlaybackService(): void {}
