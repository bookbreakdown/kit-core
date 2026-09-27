import type { ReactNode } from 'react';
import type { BookDocument, PositionStore, ReadingPosition, Theme } from '@libraryofages/kit-core';
import type { PageHostComponent } from './host/types';

export interface ReaderSettings {
  theme: 'light' | 'sepia' | 'dark' | 'system';
  fontSize: number;
  fontFamily: 'serif' | 'sans' | 'system';
  lineSpacing: 1 | 2 | 3;
  margins: 1 | 2 | 3;
  align: 'left' | 'justify';
  /** 0.3–1; below 1 a dark overlay dims the page. */
  brightness: number;
  volumeKeysTurnPages: boolean;
}

/** Small string store the host provides (AsyncStorage, MMKV, localStorage, memory). */
export interface SettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** The host supplies every colour; the kit ships none. */
export interface ReaderThemes {
  light: Theme;
  sepia: Theme;
  dark: Theme;
}

export interface ReaderLabels {
  back: string;
  contents: string;
  settings: string;
  backMatter: string;
  inChapter: string;
  ofBook: string;
  leftInChapter: string;
  leftInBook: string;
  about: string;
  lessThanAMinute: string;
  hourShort: string;
  minuteShort: string;
  chapter: string;
  page: string;
  backTo: string;
  furthestTitle: string;
  furthestBody: string;
  go: string;
  dismiss: string;
  theme: string;
  fontSize: string;
  font: string;
  spacing: string;
  margins: string;
  align: string;
  brightness: string;
  volumeKeys: string;
}

export interface ReaderProps {
  /** Stable id the position and dismissal records are keyed by. */
  bookId: string;
  document: BookDocument;
  themes: ReaderThemes;
  positionStore: PositionStore;
  settingsStore: SettingsStore;
  /** The furthest position known elsewhere (another device); prompts when ahead of here. */
  furthest?: ReadingPosition | null;
  title?: string;
  labels?: Partial<ReaderLabels>;
  onBack?(): void;
  onPositionChange?(position: ReadingPosition): void;
  onChapterChange?(index: number): void;
  onChapterEnd?(index: number): void;
  onBookEnd?(): void;
  onSelection?(action: 'copy' | 'share' | 'define', text: string): void;
  renderNotice?(): ReactNode;
  renderLocked?(): ReactNode;
  /** Full-screen host views shown between this chapter's last page and the next chapter. */
  insertPages?(chapterIndex: number): ReactNode[];
  /** Test and host override of the page host (iframe on web, WebView on native by default). */
  hostComponent?: PageHostComponent;
}

export interface ReaderHandle {
  goToChapter(index: number, offsetPct?: number): void;
  /** Jump by percent of the whole book. */
  goToPct(bookPct: number): void;
  toggleChrome(): void;
  onVolumeKey(direction: 'up' | 'down'): void;
}
