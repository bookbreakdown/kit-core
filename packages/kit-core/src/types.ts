/**
 * Contract types shared by every kit package and adopted by any backend that
 * feeds them. See docs/contracts.md. No runtime code lives here.
 */

export interface ThemeColors {
  background: string;
  text: string;
  muted: string;
  accent: string;
  surface: string;
  border: string;
}

export interface ThemeFonts {
  serif: string;
  sans: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
}

export interface Chapter {
  index: number;
  title: string;
  markdown: string;
  wordCount: number;
}

export interface BookDocument {
  title: string;
  chapters: Chapter[];
  /** Index of the last main-text chapter, or null when the host has not said. */
  finishChapterIndex: number | null;
}

export type TrackSource =
  | { kind: 'url'; url: string }
  | { kind: 'file'; path: string };

export interface Track {
  id: string;
  index: number;
  title: string;
  source: TrackSource;
  durationSeconds: number;
  artworkUrl?: string;
  backMatter: boolean;
  /** Set by the host for tracks it lists but will not play (locked chapters); the player refuses them. */
  blocked?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  tracks: Track[];
  finishTrackIndex: number | null;
}

export interface ManifestFile {
  url: string;
  byteSize: number;
  /** Null when the server could not hash the object (large audio); size still verifies. */
  sha256: string | null;
}

export interface ManifestChapter extends ManifestFile {
  chapterNumber: number;
  title: string;
  durationSeconds: number;
  backMatter: boolean;
}

export interface ManifestVoice {
  voice: string;
  label: string;
  chapters: ManifestChapter[];
}

export interface BundleManifest {
  id: string;
  title: string;
  content: ManifestFile & { wordCount: number };
  cover: ManifestFile | null;
  voices: ManifestVoice[];
  gated: boolean;
  /** ISO-8601 instant, or null when the content never expires. */
  offlineValidUntil: string | null;
  finishChapterIndex: number | null;
}

export interface ReadingPosition {
  chapterIndex: number;
  /** 0–100 within the chapter; canonical across devices. */
  offsetPct: number;
  /** Device-specific page within the chapter, when known. */
  pageIndex: number | null;
}

export interface PositionStore {
  load(bookId: string): Promise<ReadingPosition | null>;
  save(bookId: string, position: ReadingPosition): Promise<void>;
}

export interface ListeningPosition {
  trackIndex: number;
  positionSeconds: number;
  rate: number;
}

export interface ProgressStore {
  load(playlistId: string): Promise<ListeningPosition | null>;
  save(playlistId: string, position: ListeningPosition): Promise<void>;
}

export type ValidityVerdict =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'lapsed' | 'locked' };

export interface ValidityPolicy {
  isPlayable(manifest: BundleManifest, now: Date): ValidityVerdict;
}
