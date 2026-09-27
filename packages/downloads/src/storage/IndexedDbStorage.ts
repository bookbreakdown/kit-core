import type { TrackSource } from '@libraryofages/kit-core';
import { HASH_LIMIT_WEB, concat, toHex, type BundleStorage, type WriteResult } from './BundleStorage';

const DB_NAME = 'kit-downloads';
const DB_VERSION = 1;
const SLICE_BYTES = 4 * 1024 * 1024;

interface Meta { bytes: number; sha256: string | null; slices: number }

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}

export interface ObjectUrlFactory { create(blob: Blob): string; revoke(url: string): void }

/**
 * Web storage: bytes in 4 MB slices (`slices` store), one `meta` record per key, JSON records
 * in `records`. `localSource` assembles a `blob:` URL on demand and caches it until delete.
 */
export class IndexedDbStorage implements BundleStorage {
  private db: Promise<IDBDatabase> | null = null;
  private urls = new Map<string, string>();

  constructor(
    private readonly objectUrls: ObjectUrlFactory = { create: (b) => URL.createObjectURL(b), revoke: (u) => URL.revokeObjectURL(u) },
    private readonly hashLimit = HASH_LIMIT_WEB,
    private readonly dbName = DB_NAME,
  ) {}

  /** Closes the connection (tests and teardown). */
  async close(): Promise<void> {
    if (!this.db) return;
    const d = await this.db;
    d.close();
    this.db = null;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const r = indexedDB.open(this.dbName, DB_VERSION);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('slices')) d.createObjectStore('slices');
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
          if (!d.objectStoreNames.contains('records')) d.createObjectStore('records');
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return this.db;
  }

  private async meta(key: string): Promise<Meta | null> {
    const d = await this.open();
    const m = await req(d.transaction('meta', 'readonly').objectStore('meta').get(key) as IDBRequest<Meta | undefined>);
    return m ?? null;
  }

  async writeStream(key: string, body: ReadableStream<Uint8Array>, expectedBytes: number, onProgress?: (bytes: number) => void, signal?: AbortSignal): Promise<WriteResult> {
    const d = await this.open();
    await this.delete(key);
    const reader = body.getReader();
    const hashing = expectedBytes <= this.hashLimit && typeof crypto !== 'undefined' && !!crypto.subtle;
    const forHash: Uint8Array[] = [];
    let pending: Uint8Array[] = [];
    let pendingBytes = 0;
    let bytes = 0;
    let slices = 0;
    const put = async (slice: Uint8Array) => {
      const tx = d.transaction('slices', 'readwrite');
      tx.objectStore('slices').put(slice, `${key}#${slices}`);
      await done(tx);
      slices += 1;
    };
    // Slices are exactly SLICE_BYTES except the last, whatever chunk sizes the network delivers.
    const flush = async (all: boolean) => {
      while (pendingBytes >= SLICE_BYTES || (all && pendingBytes > 0)) {
        const take = Math.min(SLICE_BYTES, pendingBytes);
        const whole = concat(pending, pendingBytes);
        await put(whole.subarray(0, take));
        const rest = whole.subarray(take);
        pending = rest.length ? [rest] : []; pendingBytes = rest.length;
      }
    };
    for (;;) {
      if (signal?.aborted) { await reader.cancel().catch(() => {}); throw new DOMException('aborted', 'AbortError'); }
      const { value, done: finished } = await reader.read();
      if (finished) break;
      if (!value || value.length === 0) continue;
      bytes += value.length;
      pending.push(value); pendingBytes += value.length;
      if (hashing) forHash.push(value);
      onProgress?.(bytes);
      if (pendingBytes >= SLICE_BYTES) await flush(false);
    }
    await flush(true);
    const sha256 = hashing ? toHex(await crypto.subtle.digest('SHA-256', concat(forHash, bytes))) : null;
    const tx = d.transaction('meta', 'readwrite');
    tx.objectStore('meta').put({ bytes, sha256, slices } satisfies Meta, key);
    await done(tx);
    return { bytes, sha256 };
  }

  async exists(key: string): Promise<boolean> { return (await this.meta(key)) !== null; }
  async size(key: string): Promise<number> { return (await this.meta(key))?.bytes ?? 0; }

  private async sliceBlobs(key: string): Promise<Uint8Array[]> {
    const m = await this.meta(key);
    if (!m) return [];
    const d = await this.open();
    const store = d.transaction('slices', 'readonly').objectStore('slices');
    const out: Uint8Array[] = [];
    for (let i = 0; i < m.slices; i += 1) {
      const s = await req(store.get(`${key}#${i}`) as IDBRequest<Uint8Array | undefined>);
      if (s) out.push(s);
    }
    return out;
  }

  async delete(key: string): Promise<void> {
    const m = await this.meta(key);
    const url = this.urls.get(key);
    if (url) { this.objectUrls.revoke(url); this.urls.delete(key); }
    if (!m) return;
    const d = await this.open();
    const tx = d.transaction(['slices', 'meta'], 'readwrite');
    for (let i = 0; i < m.slices; i += 1) tx.objectStore('slices').delete(`${key}#${i}`);
    tx.objectStore('meta').delete(key);
    await done(tx);
  }

  async deletePrefix(prefix: string): Promise<void> {
    const d = await this.open();
    const keys = await req(d.transaction('meta', 'readonly').objectStore('meta').getAllKeys() as IDBRequest<IDBValidKey[]>);
    for (const k of keys) if (typeof k === 'string' && k.startsWith(prefix)) await this.delete(k);
  }

  async localSource(key: string): Promise<TrackSource> {
    const cached = this.urls.get(key);
    if (cached) return { kind: 'url', url: cached };
    const parts = await this.sliceBlobs(key);
    if (parts.length === 0) throw new Error(`no local bytes for ${key}`);
    const url = this.objectUrls.create(new Blob(parts.map((p) => p as BlobPart)));
    this.urls.set(key, url);
    return { kind: 'url', url };
  }

  async readText(key: string): Promise<string> {
    const parts = await this.sliceBlobs(key);
    const total = parts.reduce((n, p) => n + p.length, 0);
    return new TextDecoder().decode(concat(parts, total));
  }

  async totalBytes(): Promise<number> {
    const d = await this.open();
    const all = await req(d.transaction('meta', 'readonly').objectStore('meta').getAll() as IDBRequest<Meta[]>);
    return all.reduce((n, m) => n + m.bytes, 0);
  }

  async freeBytes(): Promise<number | null> {
    try {
      const est = await navigator.storage?.estimate?.();
      return est && est.quota !== undefined && est.usage !== undefined ? est.quota - est.usage : null;
    } catch { return null; }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const d = await this.open();
    const v = await req(d.transaction('records', 'readonly').objectStore('records').get(key) as IDBRequest<T | undefined>);
    return v ?? null;
  }
  async putJson<T>(key: string, value: T): Promise<void> {
    const d = await this.open();
    const tx = d.transaction('records', 'readwrite');
    tx.objectStore('records').put(value, key);
    await done(tx);
  }
  async deleteJson(key: string): Promise<void> {
    const d = await this.open();
    const tx = d.transaction('records', 'readwrite');
    tx.objectStore('records').delete(key);
    await done(tx);
  }
  async listJson<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    const d = await this.open();
    const store = d.transaction('records', 'readonly').objectStore('records');
    const keys = await req(store.getAllKeys() as IDBRequest<IDBValidKey[]>);
    const out: Array<{ key: string; value: T }> = [];
    for (const k of keys) {
      if (typeof k !== 'string' || !k.startsWith(prefix)) continue;
      const v = await req(store.get(k) as IDBRequest<T | undefined>);
      if (v !== undefined) out.push({ key: k, value: v });
    }
    return out;
  }
}
