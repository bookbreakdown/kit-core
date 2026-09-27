import { Directory, File, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { TrackSource } from '@libraryofages/kit-core';
import { HASH_LIMIT_NATIVE, toHex, type BundleStorage, type WriteResult } from './BundleStorage';

const ROOT = 'kit-downloads';

function safe(key: string): string { return key.replace(/[^A-Za-z0-9._-]/g, '__'); }

/**
 * Android storage: one file per key under the app's document directory, streamed through the
 * file's writable stream; JSON records as small files under `records/`.
 */
export class FileSystemStorage implements BundleStorage {
  private readonly root: Directory;
  private readonly records: Directory;

  constructor(root: Directory = new Directory(Paths.document, ROOT), private readonly hashLimit = HASH_LIMIT_NATIVE) {
    this.root = root;
    this.records = new Directory(root, 'records');
    if (!this.root.exists) this.root.create({ intermediates: true, idempotent: true });
    if (!this.records.exists) this.records.create({ intermediates: true, idempotent: true });
  }

  private file(key: string): File { return new File(this.root, safe(key)); }
  private record(key: string): File { return new File(this.records, `${safe(key)}.json`); }

  async writeStream(key: string, body: ReadableStream<Uint8Array>, expectedBytes: number, onProgress?: (bytes: number) => void, signal?: AbortSignal): Promise<WriteResult> {
    const f = this.file(key);
    if (f.exists) f.delete();
    f.create({ intermediates: true, overwrite: true });
    const writer = f.writableStream().getWriter();
    const reader = body.getReader();
    let bytes = 0;
    try {
      for (;;) {
        if (signal?.aborted) { await reader.cancel().catch(() => {}); throw new DOMException('aborted', 'AbortError'); }
        const { value, done } = await reader.read();
        if (done) break;
        if (!value || value.length === 0) continue;
        await writer.write(value);
        bytes += value.length;
        onProgress?.(bytes);
      }
      await writer.close();
    } catch (e) {
      await writer.abort().catch(() => {});
      if (f.exists) f.delete();
      throw e;
    }
    let sha256: string | null = null;
    if (expectedBytes <= this.hashLimit) sha256 = toHex(await digest(CryptoDigestAlgorithm.SHA256, await f.bytes()));
    return { bytes, sha256 };
  }

  async exists(key: string): Promise<boolean> { return this.file(key).exists; }
  async size(key: string): Promise<number> { const f = this.file(key); return f.exists ? (f.size ?? 0) : 0; }
  async delete(key: string): Promise<void> { const f = this.file(key); if (f.exists) f.delete(); }
  async deletePrefix(prefix: string): Promise<void> {
    const p = safe(prefix);
    for (const entry of this.root.list()) if (entry instanceof File && entry.name.startsWith(p)) entry.delete();
  }
  async localSource(key: string): Promise<TrackSource> {
    const f = this.file(key);
    if (!f.exists) throw new Error(`no local file for ${key}`);
    return { kind: 'file', path: f.uri };
  }
  async readText(key: string): Promise<string> { return this.file(key).text(); }
  async totalBytes(): Promise<number> {
    let n = 0;
    for (const entry of this.root.list()) if (entry instanceof File) n += entry.size ?? 0;
    return n;
  }
  async freeBytes(): Promise<number | null> { const v = Paths.availableDiskSpace; return Number.isFinite(v) ? v : null; }
  async getJson<T>(key: string): Promise<T | null> { const r = this.record(key); return r.exists ? (JSON.parse(await r.text()) as T) : null; }
  async putJson<T>(key: string, value: T): Promise<void> { const r = this.record(key); if (!r.exists) r.create({ intermediates: true, overwrite: true }); r.write(JSON.stringify(value)); }
  async deleteJson(key: string): Promise<void> { const r = this.record(key); if (r.exists) r.delete(); }
  async listJson<T>(prefix: string): Promise<Array<{ key: string; value: T }>> {
    const out: Array<{ key: string; value: T }> = [];
    const p = safe(prefix);
    for (const entry of this.records.list()) {
      if (!(entry instanceof File) || !entry.name.startsWith(p)) continue;
      out.push({ key: entry.name.replace(/\.json$/, ''), value: JSON.parse(await entry.text()) as T });
    }
    return out;
  }
}
