import { Platform } from 'react-native';
import type { PositionStore, ReadingPosition } from '@libraryofages/kit-core';
import type { SettingsStore } from '@libraryofages/reader';

/**
 * Demo stores: memory on native, localStorage on web so a reload restores the position
 * (the driven journey asserts this). A real app supplies AsyncStorage/MMKV-backed stores.
 */
function webStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export function makeSettingsStore(prefix: string): SettingsStore {
  const mem = new Map<string, string>();
  const ls = webStorage();
  return {
    async get(key) { return ls ? ls.getItem(`${prefix}:${key}`) : mem.get(key) ?? null; },
    async set(key, value) { if (ls) ls.setItem(`${prefix}:${key}`, value); else mem.set(key, value); },
  };
}

export function makePositionStore(prefix: string): PositionStore & { peek(bookId: string): ReadingPosition | null } {
  const mem = new Map<string, ReadingPosition>();
  const ls = webStorage();
  const read = (bookId: string): ReadingPosition | null => {
    if (ls) { const raw = ls.getItem(`${prefix}:pos:${bookId}`); return raw ? (JSON.parse(raw) as ReadingPosition) : null; }
    return mem.get(bookId) ?? null;
  };
  return {
    async load(bookId) { return read(bookId); },
    async save(bookId, position) { if (ls) ls.setItem(`${prefix}:pos:${bookId}`, JSON.stringify(position)); else mem.set(bookId, position); },
    peek: read,
  };
}
