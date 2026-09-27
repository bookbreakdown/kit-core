export type TapZone = 'left' | 'center' | 'right';

export interface PageEngineOptions {
  onPage?(page: number, count: number, offsetPct: number): void;
  onTap?(zone: TapZone): void;
  /** Fires when next()/prev() (from any source: API, tap zone, swipe, key) had no page to move to. */
  onEdge?(direction: 'next' | 'prev'): void;
  tapZones?: boolean;
  swipe?: boolean;
  keyboard?: boolean;
  resizeDebounceMs?: number;
}

export interface PageEngine {
  layout(): void;
  next(): boolean;
  prev(): boolean;
  goTo(page: number): boolean;
  goToPct(pct: number): void;
  relayoutKeepingPosition(): void;
  offsetPct(): number;
  destroy(): void;
  readonly page: number;
  readonly count: number;
  readonly width: number;
}

export function createPageEngine(container: HTMLElement, options?: PageEngineOptions): PageEngine;
