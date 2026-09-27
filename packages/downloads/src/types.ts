import type { ReactNode } from 'react';
import type { BundleManifest, Theme, TrackSource, ValidityPolicy } from '@libraryofages/kit-core';
import type { Connectivity } from './connectivity/Connectivity';
import type { BundleStorage } from './storage/BundleStorage';

export type DownloadKind = 'text' | 'audio';

export type DownloadItemState =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'ready'
  | 'update-available'
  | 'locked'
  | 'failed';

export interface DownloadFile {
  key: string;
  url: string;
  bytes: number;
  sha256: string | null;
  done: boolean;
  label: string;
}

/** The persisted record for one download (a book's text, or one voice of its audiobook). */
export interface DownloadRecord {
  key: string;
  id: string;
  title: string;
  kind: DownloadKind;
  voice: string | null;
  files: DownloadFile[];
  state: DownloadItemState;
  error: string | null;
  lockedReason: 'expired' | 'lapsed' | 'locked' | null;
  gated: boolean;
  validUntil: string | null;
  manifestHash: string;
  manifest: BundleManifest;
  createdAt: string;
  /** True while the user has asked it to wait (cancel/pause); the queue skips it. */
  held: boolean;
}

export interface DownloadItem {
  key: string;
  id: string;
  title: string;
  kind: DownloadKind;
  voice: string | null;
  state: DownloadItemState;
  byteSize: number;
  downloadedBytes: number;
  /** 0–1 */
  progress: number;
  error: string | null;
  lockedReason: DownloadRecord['lockedReason'];
  waitingForWifi: boolean;
  validUntil: string | null;
  fileCount: number;
  doneCount: number;
}

export interface DownloadsSettings {
  wifiOnly: boolean;
  autoDownloadNext: boolean;
}

export interface DownloadsProviderProps {
  validityPolicy: ValidityPolicy;
  /** `kind` says what is about to be downloaded, so a host can set `gated` for the text and the audio of one book differently. */
  fetchManifest(id: string, kind: DownloadKind): Promise<BundleManifest>;
  theme: Theme;
  /** Defaults to the platform storage (IndexedDB on web, files on Android). */
  storage?: BundleStorage;
  connectivity?: Connectivity;
  /** Max transfers in flight across items (default 2). */
  concurrency?: number;
  now?(): Date;
  children: ReactNode;
}

export interface DownloadsApi {
  downloadText(id: string): Promise<void>;
  downloadAudio(id: string, voice: string): Promise<void>;
  pause(key: string): Promise<void>;
  resume(key: string): Promise<void>;
  cancel(key: string): Promise<void>;
  retry(key: string): Promise<void>;
  remove(key: string): Promise<void>;
  deleteAll(kind?: DownloadKind): Promise<void>;
  resolveLocal(source: TrackSource): Promise<TrackSource>;
  readText(id: string): Promise<string | null>;
  refreshValidity(): Promise<void>;
  checkForUpdates(key: string): Promise<boolean>;
  /** The host renewed (or a journey rewrote) a gated item's offline window; validity is re-evaluated at once. */
  setOfflineValidUntil(key: string, iso: string | null): Promise<void>;
  setSettings(patch: Partial<DownloadsSettings>): Promise<void>;
  items(): DownloadItem[];
  totals(): { bytes: number; free: number | null };
}

export interface DownloadsContextValue extends DownloadsApi {
  list: DownloadItem[];
  settings: DownloadsSettings;
  ready: boolean;
  usedBytes: number;
  freeBytes: number | null;
  connection: { online: boolean; type: string };
}

export const textKey = (id: string) => `text:${id}`;
export const audioKey = (id: string, voice: string) => `audio:${id}:${voice}`;
export const fileKey = (recordKey: string, name: string) => `${recordKey}:${name}`;
