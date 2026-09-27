import type { BundleStorage, WriteResult } from './storage/BundleStorage';

/**
 * The one place in the kit that moves bytes from a URL: the host supplied the URL through its
 * manifest; this streams the response body into storage under `key`.
 */
export async function transfer(url: string, storage: BundleStorage, key: string, expectedBytes: number, onProgress?: (bytes: number) => void, signal?: AbortSignal): Promise<WriteResult> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${key}`);
  if (!res.body) throw new Error(`no body for ${key}`);
  return storage.writeStream(key, res.body, expectedBytes, onProgress, signal);
}
