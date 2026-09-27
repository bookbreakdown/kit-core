import type { TrackSource } from '@libraryofages/kit-core';

export interface WriteResult { bytes: number; sha256: string | null }

/**
 * Where downloaded bytes and the engine's records live: IndexedDB on web, files on Android.
 * Bytes stream in; nothing holds a whole audiobook in memory.
 */
export interface BundleStorage {
  writeStream(key: string, body: ReadableStream<Uint8Array>, expectedBytes: number, onProgress?: (bytes: number) => void, signal?: AbortSignal): Promise<WriteResult>;
  exists(key: string): Promise<boolean>;
  size(key: string): Promise<number>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  /** A source the platform's player can open directly (a `blob:` URL on web, a file on Android). */
  localSource(key: string): Promise<TrackSource>;
  readText(key: string): Promise<string>;
  totalBytes(): Promise<number>;
  freeBytes(): Promise<number | null>;
  /** Small JSON records (download items, settings). */
  getJson<T>(key: string): Promise<T | null>;
  putJson<T>(key: string, value: T): Promise<void>;
  deleteJson(key: string): Promise<void>;
  listJson<T>(prefix: string): Promise<Array<{ key: string; value: T }>>;
}

export const HASH_LIMIT_WEB = 64 * 1024 * 1024;
export const HASH_LIMIT_NATIVE = 16 * 1024 * 1024;

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function concat(chunks: Uint8Array[], total: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
