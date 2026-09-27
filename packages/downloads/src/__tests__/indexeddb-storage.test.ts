import { createHash } from 'node:crypto';
import { IndexedDbStorage } from '../storage/IndexedDbStorage';

function stream(bytes: Uint8Array, chunk = 1_000_000): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      controller.enqueue(bytes.subarray(offset, Math.min(bytes.length, offset + chunk)));
      offset += chunk;
    },
  });
}

function synthetic(size: number): Uint8Array {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) out[i] = (i * 31 + 7) & 0xff;
  return out;
}

const blobs: Blob[] = [];
const objectUrls = { create: (b: Blob) => { blobs.push(b); return `blob:test/${blobs.length}`; }, revoke: () => {} };

test('a 9 MB stream lands in 3 slices with the right byte count and Node-equal sha256; blob, delete and totals', async () => {
  const storage = new IndexedDbStorage(objectUrls, undefined, 'test-storage-1');
  const data = synthetic(9 * 1024 * 1024);
  const progress: number[] = [];
  const result = await storage.writeStream('audio:book:v:ch1', stream(data), data.length, (b) => progress.push(b));
  expect(result.bytes).toBe(data.length);
  expect(result.sha256).toBe(createHash('sha256').update(data).digest('hex'));
  expect(progress[progress.length - 1]).toBe(data.length);
  expect(await storage.size('audio:book:v:ch1')).toBe(data.length);
  expect(await storage.exists('audio:book:v:ch1')).toBe(true);
  const meta = await (storage as unknown as { meta(key: string): Promise<{ slices: number }> }).meta('audio:book:v:ch1');
  expect(meta.slices).toBe(3);

  const src = await storage.localSource('audio:book:v:ch1');
  expect(src).toEqual({ kind: 'url', url: 'blob:test/1' });
  expect(blobs[0].size).toBe(data.length);
  expect(await storage.localSource('audio:book:v:ch1')).toEqual(src);

  await storage.writeStream('text:book:content', stream(new TextEncoder().encode('# Hello\n\nworld')), 14);
  expect(await storage.readText('text:book:content')).toBe('# Hello\n\nworld');
  expect(await storage.totalBytes()).toBe(data.length + 14);

  await storage.delete('audio:book:v:ch1');
  expect(await storage.exists('audio:book:v:ch1')).toBe(false);
  expect(await storage.totalBytes()).toBe(14);
  await storage.deletePrefix('text:');
  expect(await storage.totalBytes()).toBe(0);
});

test('JSON records round-trip and list by prefix; an aborted write leaves nothing behind', async () => {
  const storage = new IndexedDbStorage(objectUrls, undefined, 'test-storage-2');
  await storage.putJson('item:a', { id: 'a' });
  await storage.putJson('item:b', { id: 'b' });
  await storage.putJson('settings', { wifiOnly: false });
  expect(await storage.getJson('item:a')).toEqual({ id: 'a' });
  expect((await storage.listJson('item:')).map((r) => r.key).sort()).toEqual(['item:a', 'item:b']);
  await storage.deleteJson('item:a');
  expect(await storage.getJson('item:a')).toBeNull();

  const controller = new AbortController();
  const data = synthetic(2_500_000);
  const body = new ReadableStream<Uint8Array>({
    pull(c) { c.enqueue(data.subarray(0, 1_000_000)); controller.abort(); },
  });
  await expect(storage.writeStream('audio:x', body, data.length, undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(await storage.exists('audio:x')).toBe(false);
});
