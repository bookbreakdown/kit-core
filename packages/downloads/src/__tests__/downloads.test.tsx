import { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import type { BundleManifest, ValidityPolicy } from '@libraryofages/kit-core';
import { createHash } from 'node:crypto';
import type { ConnectionState, Connectivity } from '../connectivity/Connectivity';
import { DownloadsProvider, useDownloads } from '../DownloadsProvider';
import { IndexedDbStorage } from '../storage/IndexedDbStorage';
import type { DownloadsContextValue } from '../types';

// --- fixtures -------------------------------------------------------------------------
const bodies = new Map<string, Uint8Array>();
const bytesOf = (seed: number, size: number) => { const b = new Uint8Array(size); for (let i = 0; i < size; i += 1) b[i] = (i * seed + 3) & 0xff; return b; };
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
bodies.set('cdn://text.md', new TextEncoder().encode('# Book\n\n' + 'word '.repeat(2000)));
bodies.set('cdn://ch1.mp3', bytesOf(5, 300_000));
bodies.set('cdn://ch2.mp3', bytesOf(7, 300_000));
bodies.set('cdn://ch3.mp3', bytesOf(9, 300_000));

const manifest = (): BundleManifest => ({
  id: 'book', title: 'Book',
  content: { url: 'cdn://text.md', byteSize: bodies.get('cdn://text.md')!.length, sha256: sha(bodies.get('cdn://text.md')!), wordCount: 2001 },
  cover: null,
  voices: [{ voice: 'v', label: 'V', chapters: [1, 2, 3].map((n) => ({ chapterNumber: n, title: `Ch ${n}`, url: `cdn://ch${n}.mp3`, byteSize: 300_000, sha256: sha(bodies.get(`cdn://ch${n}.mp3`)!), durationSeconds: 5, backMatter: false })) }],
  gated: true, offlineValidUntil: '2099-01-01T00:00:00Z', finishChapterIndex: 0,
});

let inFlight = 0; let maxInFlight = 0; const fetched: string[] = []; const stalls = new Map<string, Promise<void>>();
const origFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const data = bodies.get(url);
    if (!data) return new Response(null, { status: 404 });
    fetched.push(url);
    inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        if (init?.signal?.aborted) { inFlight -= 1; c.error(new DOMException('aborted', 'AbortError')); return; }
        const stall = stalls.get(url);
        if (stall && offset >= data.length / 2) await stall;
        if (offset >= data.length) { inFlight -= 1; c.close(); return; }
        c.enqueue(data.subarray(offset, offset + 50_000)); offset += 50_000;
        await new Promise((r) => setTimeout(r, 1));
      },
      cancel() { inFlight -= 1; },
    });
    return new Response(body, { status: 200 });
  }) as typeof fetch;
});
afterAll(() => { global.fetch = origFetch; });

class FakeConnectivity implements Connectivity {
  state: ConnectionState = { online: true, type: 'wifi' };
  handlers = new Set<(s: ConnectionState) => void>();
  async current() { return this.state; }
  subscribe(h: (s: ConnectionState) => void) { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
  set(s: ConnectionState) { this.state = s; for (const h of this.handlers) h(s); }
}

let api: DownloadsContextValue | null = null;
function Grab() { const d = useDownloads(); useEffect(() => { api = d; }); return <Text testID="items">{d.list.map((i) => `${i.key}=${i.state}${i.waitingForWifi ? '(wifi)' : ''}`).join(',')}</Text>; }
const theme = { name: 't', colors: { background: 'paper', text: 'ink', muted: 'ash', accent: 'ember', surface: 'card', border: 'line' }, fonts: { serif: 'serif', sans: 'sans' } };
const okPolicy: ValidityPolicy = { isPlayable: () => ({ ok: true }) };

let dbSeq = 0;
const manifestKinds: string[] = [];
function mount(policy: ValidityPolicy = okPolicy, connectivity = new FakeConnectivity(), storage = new IndexedDbStorage({ create: () => 'blob:x', revoke: () => {} }, undefined, `test-downloads-${++dbSeq}`), fetchManifest: (id: string, kind: 'text' | 'audio') => Promise<BundleManifest> = async (_id, kind) => { manifestKinds.push(kind); return manifest(); }) {
  const utils = render(
    <DownloadsProvider theme={theme} validityPolicy={policy} fetchManifest={fetchManifest} storage={storage} connectivity={connectivity}>
      <Grab />
    </DownloadsProvider>,
  );
  return { ...utils, connectivity, storage };
}
const stateOf = (key: string) => api!.items().find((i) => i.key === key)?.state;
const until = (fn: () => boolean, ms = 8000) => waitFor(() => expect(fn()).toBe(true), { timeout: ms });

beforeEach(() => { api = null; fetched.length = 0; maxInFlight = 0; inFlight = 0; stalls.clear(); });

test('text download → ready, resolveLocal returns the local source, readText returns the text', async () => {
  mount();
  await until(() => !!api?.ready);
  await act(async () => { await api!.downloadText('book'); });
  await until(() => stateOf('text:book') === 'ready');
  expect(await api!.resolveLocal({ kind: 'url', url: 'cdn://text.md' })).toEqual({ kind: 'url', url: 'blob:x' });
  expect(await api!.resolveLocal({ kind: 'url', url: 'cdn://other.md' })).toEqual({ kind: 'url', url: 'cdn://other.md' });
  expect(manifestKinds).toContain('text'); // the host learns which kind is being fetched
  expect((await api!.readText('book'))?.startsWith('# Book')).toBe(true);
  expect(api!.items()[0]).toMatchObject({ byteSize: manifest().content.byteSize, progress: 1, doneCount: 1 });
});

test('audio: chapters complete in order with at most 2 transfers in flight; cancel keeps done files; resume does not re-fetch them', async () => {
  const { storage } = mount();
  await until(() => !!api?.ready);
  let unstall1!: () => void; stalls.set('cdn://ch1.mp3', new Promise<void>((r) => { unstall1 = r; }));
  let unstall2!: () => void; stalls.set('cdn://ch2.mp3', new Promise<void>((r) => { unstall2 = r; }));
  await act(async () => { await api!.downloadAudio('book', 'v'); await api!.downloadText('book'); });
  await until(() => fetched.length >= 2);
  expect(maxInFlight).toBeLessThanOrEqual(2);
  expect(fetched[0]).toBe('cdn://ch1.mp3');
  unstall1();
  await until(() => api!.items().find((i) => i.key === 'audio:book:v')!.doneCount >= 1);
  await until(() => fetched.includes('cdn://ch2.mp3'));
  await act(async () => { await api!.cancel('audio:book:v'); });
  unstall2();
  await until(() => stateOf('audio:book:v') === 'queued');
  const item = api!.items().find((i) => i.key === 'audio:book:v')!;
  expect(item.doneCount).toBe(1);
  expect(await storage.exists('audio:book:v:ch1')).toBe(true);
  expect(await storage.exists('audio:book:v:ch2')).toBe(false);
  const before = fetched.filter((u) => u === 'cdn://ch1.mp3').length;
  await act(async () => { await api!.resume('audio:book:v'); });
  await until(() => stateOf('audio:book:v') === 'ready');
  expect(fetched.filter((u) => u === 'cdn://ch1.mp3').length).toBe(before);
  expect(fetched.filter((u) => u.endsWith('.mp3'))).toEqual(expect.arrayContaining(['cdn://ch2.mp3', 'cdn://ch3.mp3']));
  expect(maxInFlight).toBeLessThanOrEqual(2);
  expect(api!.items().find((i) => i.key === 'audio:book:v')).toMatchObject({ progress: 1, doneCount: 3, byteSize: 900_000 });
  expect(await api!.resolveLocal({ kind: 'url', url: 'cdn://ch2.mp3' })).toEqual({ kind: 'url', url: 'blob:x' });
}, 20000);

test('a size mismatch fails with a reason and keeps no bytes; retry re-queues', async () => {
  const bad = async () => { const m = manifest(); m.content.byteSize += 5; return m; };
  const { storage } = mount(okPolicy, new FakeConnectivity(), undefined, bad);
  await until(() => !!api?.ready);
  await act(async () => { await api!.downloadText('book'); });
  await until(() => stateOf('text:book') === 'failed');
  expect(api!.items()[0].error).toMatch(/size mismatch/);
  expect(await storage.exists('text:book:content')).toBe(false);
  await act(async () => { await api!.retry('text:book'); });
  await until(() => stateOf('text:book') === 'failed');
});

test('policy verdicts lock and unlock; checkForUpdates flags a changed manifest; remove empties storage', async () => {
  let verdict: ReturnType<ValidityPolicy['isPlayable']> = { ok: true };
  const policyRef: { current: ValidityPolicy } = { current: { isPlayable: () => verdict } };
  const policy: ValidityPolicy = { isPlayable: (m, now) => policyRef.current.isPlayable(m, now) };
  let m = manifest();
  const { storage } = mount(policy, new FakeConnectivity(), undefined, async () => m);
  await until(() => !!api?.ready);
  await act(async () => { await api!.downloadText('book'); });
  await until(() => stateOf('text:book') === 'ready');
  verdict = { ok: false, reason: 'lapsed' };
  await act(async () => { await api!.refreshValidity(); });
  expect(api!.items()[0]).toMatchObject({ state: 'locked', lockedReason: 'lapsed' });
  verdict = { ok: true };
  await act(async () => { await api!.refreshValidity(); });
  expect(stateOf('text:book')).toBe('ready');
  // the host rewrites the offline window: the policy sees the new manifest at once
  let seen: string | null | undefined;
  const spy: ValidityPolicy = { isPlayable: (m) => { seen = m.offlineValidUntil; return verdict; } };
  policyRef.current = spy;
  await act(async () => { await api!.setOfflineValidUntil('text:book', '2000-01-01T00:00:00Z'); });
  expect(seen).toBe('2000-01-01T00:00:00Z');
  expect(api!.items()[0].validUntil).toBe('2000-01-01T00:00:00Z');
  m = { ...m, content: { ...m.content, sha256: 'deadbeef' } };
  let changed = false;
  await act(async () => { changed = await api!.checkForUpdates('text:book'); });
  expect(changed).toBe(true);
  expect(stateOf('text:book')).toBe('update-available');
  await act(async () => { await api!.remove('text:book'); });
  expect(api!.items()).toHaveLength(0);
  expect(await storage.totalBytes()).toBe(0);
  expect(await storage.listJson('item:')).toHaveLength(0);
});

test('an item locked while queued downloads once the policy allows it again', async () => {
  let verdict: ReturnType<ValidityPolicy['isPlayable']> = { ok: false, reason: 'locked' };
  const policy: ValidityPolicy = { isPlayable: () => verdict };
  mount(policy);
  await until(() => !!api?.ready);
  await act(async () => { await api!.downloadText('book'); });
  await until(() => stateOf('text:book') === 'locked');
  expect(fetched).toHaveLength(0);
  verdict = { ok: true };
  await act(async () => { await api!.refreshValidity(); });
  await until(() => stateOf('text:book') === 'ready');
  expect(fetched).toContain('cdn://text.md');
});

test('wifiOnly: on cellular audio waits while text proceeds; Wi-Fi returning resumes it', async () => {
  const conn = new FakeConnectivity();
  conn.state = { online: true, type: 'cellular' };
  mount(okPolicy, conn);
  await until(() => !!api?.ready);
  await act(async () => { await api!.downloadAudio('book', 'v'); await api!.downloadText('book'); });
  await until(() => stateOf('text:book') === 'ready');
  const audio = api!.items().find((i) => i.key === 'audio:book:v')!;
  expect(audio.state).toBe('queued');
  expect(audio.waitingForWifi).toBe(true);
  expect(fetched.some((u) => u.endsWith('.mp3'))).toBe(false);
  await act(async () => { conn.set({ online: true, type: 'wifi' }); });
  await until(() => stateOf('audio:book:v') === 'ready', 15000);
}, 20000);
