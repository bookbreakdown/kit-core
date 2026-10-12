import type { ReactNode } from 'react';
import type { Playlist, ProgressStore, Theme, Track, TrackSource } from '@libraryofages/kit-core';
import type { AudioEngine } from './engine/AudioEngine';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const JUMP_SECONDS = 15;
export type PlayerPanel = 'chapters' | 'sleep' | 'voices';
/** The mini player's height (progress line + row), for layouts that reserve room for it. */
export const MINI_PLAYER_HEIGHT = 62;
export const SAVE_INTERVAL_MS = 5000;
export const FADE_MS = 5000;

export type SleepTimerSetting = number | 'end-of-chapter' | null;

export interface Voice { id: string; label: string }

export interface PlayerProviderProps {
  theme: Theme;
  progressStore: ProgressStore;
  /** Local-first resolution (the downloads engine's `resolveLocal`); applied to every track before load. */
  resolveSource?(source: TrackSource): Promise<TrackSource>;
  /** Injected for tests and hosts; defaults to the platform engine. */
  engineFactory?(): AudioEngine;
  voices?: Voice[];
  onSwitchVoice?(id: string): void;
  onTrackBlocked?(index: number): void;
  onPlaylistEnd?(): void;
  /** Milliseconds between progress saves while playing (default 5000). */
  saveIntervalMs?: number;
  children: ReactNode;
}

export interface SleepTimerState {
  setting: SleepTimerSetting;
  /** Wall-clock end for a minutes timer. */
  endsAt: number | null;
}

export interface PlayerState {
  playlist: Playlist | null;
  index: number;
  positionSeconds: number;
  durationSeconds: number;
  playing: boolean;
  rate: number;
  sleepTimer: SleepTimerState;
  /** The index the host refused, until the next successful track change. */
  blockedIndex: number | null;
  loaded: boolean;
  expanded: boolean;
  /** The full player's panel to show when it opens (e.g. the reader's Chapters button). */
  openPanel: PlayerPanel | null;
  fading: boolean;
}

export interface PlayerApi {
  load(playlist: Playlist, start?: { trackIndex: number; positionSeconds: number }): Promise<void>;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(seconds: number): void;
  jump(deltaSeconds: number): void;
  setRate(rate: number): void;
  cycleRate(): void;
  skipNext(): void;
  skipPrev(): void;
  goTo(index: number): void;
  setSleepTimer(setting: SleepTimerSetting): void;
  switchPlaylist(playlist: Playlist): Promise<void>;
  setExpanded(expanded: boolean, panel?: PlayerPanel): void;
  close(): Promise<void>;
  currentTrack(): Track | null;
}

export type PlayerContextValue = PlayerState & PlayerApi & { voices: Voice[]; switchVoice(id: string): void };
