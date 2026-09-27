import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsStore } from './types';

export const WPM_KEY = 'reader.wpm';
export const DEFAULT_WPM = 230;
const MIN_WPM = 80;
const MAX_WPM = 800;
const MIN_SAMPLE_SECONDS = 2;
const MAX_SAMPLE_SECONDS = 180;
const ALPHA = 0.2;

/**
 * Learned words per minute: each forward page turn that took a plausible time contributes
 * words-on-page / minutes, blended into a running estimate persisted under `reader.wpm`.
 */
export function useReadingSpeed(store: SettingsStore) {
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const wpmRef = useRef(DEFAULT_WPM);

  useEffect(() => {
    let alive = true;
    store.get(WPM_KEY).then((raw) => {
      const n = raw ? Number(raw) : NaN;
      if (alive && Number.isFinite(n) && n >= MIN_WPM && n <= MAX_WPM) { wpmRef.current = n; setWpm(n); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [store]);

  const sample = useCallback((wordsOnPage: number, seconds: number) => {
    if (!(wordsOnPage > 0) || seconds < MIN_SAMPLE_SECONDS || seconds > MAX_SAMPLE_SECONDS) return;
    const observed = wordsOnPage / (seconds / 60);
    const next = Math.round(Math.max(MIN_WPM, Math.min(MAX_WPM, wpmRef.current * (1 - ALPHA) + observed * ALPHA)));
    if (next === wpmRef.current) return;
    wpmRef.current = next;
    setWpm(next);
    void store.set(WPM_KEY, String(next));
  }, [store]);

  return { wpm, sample };
}

export function minutesFor(words: number, wpm: number): number {
  return words <= 0 ? 0 : words / Math.max(wpm, 1);
}
