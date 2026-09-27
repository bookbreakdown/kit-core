export const PACKAGE = { name: '@libraryofages/player', version: '0.0.2' } as const;
export { PlayerProvider, usePlayer, usePlayerOptional } from './PlayerProvider';
export { MiniPlayer } from './ui/MiniPlayer';
export { FullPlayerSheet } from './ui/FullPlayerSheet';
export { ChapterList } from './ui/ChapterList';
export { createEngine, registerPlaybackService, HtmlAudioEngine } from './engine';
export type { AudioEngine, EngineState, EngineEvents, EngineEventName, RemoteCommand, MediaLike } from './engine';
export { SPEEDS, JUMP_SECONDS, SAVE_INTERVAL_MS, FADE_MS } from './types';
export type { PlayerApi, PlayerProviderProps, PlayerState, PlayerContextValue, SleepTimerSetting, SleepTimerState, Voice } from './types';
