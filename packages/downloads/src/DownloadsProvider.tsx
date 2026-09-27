import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { BundleManifest, ManifestFile, TrackSource } from '@libraryofages/kit-core';
import { allowsLargeTransfer, type ConnectionState } from './connectivity/Connectivity';
import { createConnectivity } from './connectivity/createConnectivity';
import type { BundleStorage } from './storage/BundleStorage';
import { createStorage } from './storage/createStorage';
import { transfer } from './transfer';
import { audioKey, fileKey, textKey, type DownloadFile, type DownloadItem, type DownloadKind, type DownloadRecord, type DownloadsApi, type DownloadsContextValue, type DownloadsProviderProps, type DownloadsSettings } from './types';

const DownloadsContext = createContext<DownloadsContextValue | null>(null);
const RECORD_PREFIX = 'item:';
const SETTINGS_KEY = 'settings';
const DEFAULT_SETTINGS: DownloadsSettings = { wifiOnly: true, autoDownloadNext: false };

function manifestHash(m: BundleManifest): string {
  const parts = [m.content.url, m.content.byteSize, m.content.sha256 ?? '', m.cover?.byteSize ?? '', m.cover?.sha256 ?? ''];
  for (const v of m.voices) for (const c of v.chapters) parts.push(v.voice, c.chapterNumber, c.byteSize, c.sha256 ?? '');
  return parts.join('|');
}

function filesFor(kind: DownloadKind, recordKey: string, m: BundleManifest, voice: string | null): DownloadFile[] {
  const mk = (name: string, f: ManifestFile, label: string): DownloadFile => ({ key: fileKey(recordKey, name), url: f.url, bytes: f.byteSize, sha256: f.sha256, done: false, label });
  if (kind === 'text') {
    const out = [mk('content', m.content, 'Text')];
    if (m.cover) out.push(mk('cover', m.cover, 'Cover'));
    return out;
  }
  const v = m.voices.find((x) => x.voice === voice);
  if (!v) throw new Error(`voice ${voice} not in manifest ${m.id}`);
  return [...v.chapters].sort((a, b) => a.chapterNumber - b.chapterNumber).map((c) => mk(`ch${c.chapterNumber}`, c, c.title));
}

function toItem(r: DownloadRecord, inFlight: Map<string, number>, waitingForWifi: boolean): DownloadItem {
  const byteSize = r.files.reduce((n, f) => n + f.bytes, 0);
  const downloadedBytes = r.files.reduce((n, f) => n + (f.done ? f.bytes : (inFlight.get(f.key) ?? 0)), 0);
  return {
    key: r.key, id: r.id, title: r.title, kind: r.kind, voice: r.voice, state: r.state, byteSize, downloadedBytes,
    progress: byteSize > 0 ? Math.min(1, downloadedBytes / byteSize) : r.state === 'ready' ? 1 : 0,
    error: r.error, lockedReason: r.lockedReason, waitingForWifi, validUntil: r.validUntil, fileCount: r.files.length, doneCount: r.files.filter((f) => f.done).length,
  };
}

/**
 * Manifest-driven download engine: a queue with bounded concurrency and chapter order, resumable
 * per file, integrity by size and sha256, Wi-Fi-only for audio, validity through the host's policy.
 */
export function DownloadsProvider(props: DownloadsProviderProps) {
  const { validityPolicy, fetchManifest, theme, concurrency = 2, children } = props;
  void theme;
  const storage = useMemo<BundleStorage>(() => props.storage ?? createStorage(), [props.storage]);
  const connectivity = useMemo(() => props.connectivity ?? createConnectivity(), [props.connectivity]);
  const now = props.now ?? (() => new Date());
  const nowRef = useRef(now); nowRef.current = now;
  const policyRef = useRef(validityPolicy); policyRef.current = validityPolicy;
  const fetchManifestRef = useRef(fetchManifest); fetchManifestRef.current = fetchManifest;

  const records = useRef(new Map<string, DownloadRecord>());
  const inFlight = useRef(new Map<string, number>());
  const controllers = useRef(new Map<string, AbortController>());
  const activeByRecord = useRef(new Set<string>());
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [settings, setSettingsState] = useState<DownloadsSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [connection, setConnection] = useState<ConnectionState>({ online: true, type: 'unknown' });
  const connectionRef = useRef(connection); connectionRef.current = connection;
  const [usedBytes, setUsedBytes] = useState(0);
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const persist = useCallback(async (r: DownloadRecord) => {
    records.current.set(r.key, r);
    await storage.putJson(RECORD_PREFIX + r.key, r);
    bump();
  }, [bump, storage]);

  const refreshTotals = useCallback(async () => {
    setUsedBytes(await storage.totalBytes());
    setFreeBytes(await storage.freeBytes());
  }, [storage]);

  const waitingForWifi = useCallback((r: DownloadRecord) => r.kind === 'audio' && settingsRef.current.wifiOnly && !allowsLargeTransfer(connectionRef.current), []);
  const pumpRef = useRef<() => void>(() => {});

  const applyValidity = useCallback(async (r: DownloadRecord): Promise<DownloadRecord> => {
    if (!r.gated) return r;
    const verdict = policyRef.current.isPlayable(r.manifest, nowRef.current());
    if (!verdict.ok) {
      if (r.state !== 'locked' || r.lockedReason !== verdict.reason) { const next = { ...r, state: 'locked' as const, lockedReason: verdict.reason }; await persist(next); return next; }
      return r;
    }
    if (r.state === 'locked') {
      const allDone = r.files.every((f) => f.done);
      const next = { ...r, state: allDone ? 'ready' as const : 'queued' as const, lockedReason: null };
      await persist(next);
      // an unlocked item with files still missing goes back to the queue and must actually run
      if (!allDone) pumpRef.current();
      return next;
    }
    return r;
  }, [persist]);

  // --- the queue ------------------------------------------------------------------------
  const runFile = useCallback(async (r: DownloadRecord, f: DownloadFile) => {
    const controller = new AbortController();
    controllers.current.set(f.key, controller);
    activeByRecord.current.add(r.key);
    inFlight.current.set(f.key, 0);
    try {
      const result = await transfer(f.url, storage, f.key, f.bytes, (b) => { inFlight.current.set(f.key, b); bump(); }, controller.signal);
      const current = records.current.get(r.key);
      if (!current) { await storage.delete(f.key); return; }
      let failure: string | null = null;
      if (result.bytes !== f.bytes) failure = `size mismatch for ${f.label}: got ${result.bytes}, expected ${f.bytes}`;
      else if (f.sha256 && result.sha256 && result.sha256.toLowerCase() !== f.sha256.toLowerCase()) failure = `checksum mismatch for ${f.label}`;
      if (failure) {
        await storage.delete(f.key);
        await persist({ ...current, state: 'failed', error: failure });
        return;
      }
      const files = current.files.map((x) => (x.key === f.key ? { ...x, done: true } : x));
      const allDone = files.every((x) => x.done);
      await persist({ ...current, files, state: allDone ? 'ready' : current.state === 'downloading' ? 'downloading' : current.state, error: null });
      await refreshTotals();
    } catch (e) {
      const current = records.current.get(r.key);
      const aborted = e instanceof Error && e.name === 'AbortError';
      if (current && !aborted) await persist({ ...current, state: 'failed', error: e instanceof Error ? e.message : String(e) });
      if (current && aborted && current.state === 'downloading') await persist({ ...current, state: current.held ? 'queued' : 'paused' });
    } finally {
      controllers.current.delete(f.key);
      inFlight.current.delete(f.key);
      activeByRecord.current.delete(r.key);
      bump();
      pumpRef.current();
    }
  }, [bump, persist, refreshTotals, storage]);

  const pump = useCallback(() => {
    let active = controllers.current.size;
    const queue = [...records.current.values()].filter((r) => (r.state === 'queued' || r.state === 'downloading') && !r.held).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const r of queue) {
      if (active >= concurrency) break;
      if (activeByRecord.current.has(r.key)) continue;
      if (waitingForWifi(r)) { if (r.state === 'downloading') void persist({ ...r, state: 'queued' }); continue; }
      const next = r.files.find((f) => !f.done);
      if (!next) { void persist({ ...r, state: 'ready' }); continue; }
      if (r.state !== 'downloading') void persist({ ...r, state: 'downloading', error: null });
      active += 1;
      void runFile(r, next);
    }
  }, [concurrency, persist, runFile, waitingForWifi]);
  pumpRef.current = pump;

  // --- boot -----------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await storage.listJson<DownloadRecord>(RECORD_PREFIX);
      for (const { value } of saved) records.current.set(value.key, value.state === 'downloading' ? { ...value, state: 'queued' } : value);
      const s = await storage.getJson<DownloadsSettings>(SETTINGS_KEY);
      if (s) setSettingsState({ ...DEFAULT_SETTINGS, ...s });
      const c = await connectivity.current();
      if (!alive) return;
      connectionRef.current = c; setConnection(c);
      for (const r of records.current.values()) await applyValidity(r);
      await refreshTotals();
      setReady(true);
      bump();
      pumpRef.current();
    })().catch(() => { if (alive) setReady(true); });
    const off = connectivity.subscribe((c) => { connectionRef.current = c; setConnection(c); pumpRef.current(); });
    const app = AppState.addEventListener('change', (s: AppStateStatus) => { if (s === 'active') { void (async () => { for (const r of records.current.values()) await applyValidity(r); })(); } });
    return () => { alive = false; off(); app.remove(); for (const c of controllers.current.values()) c.abort(); };
  }, [applyValidity, bump, connectivity, refreshTotals, storage]);

  // --- api --------------------------------------------------------------------------------
  const enqueue = useCallback(async (kind: DownloadKind, id: string, voice: string | null) => {
    const key = kind === 'text' ? textKey(id) : audioKey(id, voice ?? '');
    const existing = records.current.get(key);
    if (existing && existing.state !== 'failed') { if (existing.held) await persist({ ...existing, held: false, state: 'queued' }); pumpRef.current(); return; }
    const manifest = await fetchManifestRef.current(id, kind);
    const files = filesFor(kind, key, manifest, voice);
    const record: DownloadRecord = {
      key, id, title: manifest.title, kind, voice, files, state: 'queued', error: null, lockedReason: null, gated: manifest.gated,
      validUntil: manifest.offlineValidUntil, manifestHash: manifestHash(manifest), manifest, createdAt: nowRef.current().toISOString(), held: false,
    };
    // keep files already on disk from a previous attempt
    for (const f of record.files) if (existing?.files.find((x) => x.key === f.key && x.done)) f.done = true;
    await persist(record);
    await applyValidity(record);
    pumpRef.current();
  }, [applyValidity, persist]);

  const downloadText = useCallback((id: string) => enqueue('text', id, null), [enqueue]);
  const downloadAudio = useCallback((id: string, voice: string) => enqueue('audio', id, voice), [enqueue]);

  const abortRecord = useCallback((r: DownloadRecord) => {
    for (const f of r.files) controllers.current.get(f.key)?.abort();
  }, []);

  const pause = useCallback(async (key: string) => {
    const r = records.current.get(key); if (!r) return;
    await persist({ ...r, held: true, state: r.state === 'ready' ? 'ready' : 'paused' });
    abortRecord(r);
  }, [abortRecord, persist]);
  const cancel = useCallback(async (key: string) => {
    const r = records.current.get(key); if (!r) return;
    await persist({ ...r, held: true, state: r.state === 'ready' ? 'ready' : 'queued', error: null });
    abortRecord(r);
  }, [abortRecord, persist]);
  const resume = useCallback(async (key: string) => {
    const r = records.current.get(key); if (!r) return;
    await persist({ ...r, held: false, state: r.files.every((f) => f.done) ? 'ready' : 'queued', error: null });
    pumpRef.current();
  }, [persist]);
  const retry = resume;

  const remove = useCallback(async (key: string) => {
    const r = records.current.get(key); if (!r) return;
    abortRecord(r);
    records.current.delete(key);
    await storage.deletePrefix(`${key}:`);
    await storage.deleteJson(RECORD_PREFIX + key);
    await refreshTotals();
    bump();
  }, [abortRecord, bump, refreshTotals, storage]);

  const deleteAll = useCallback(async (kind?: DownloadKind) => {
    for (const r of [...records.current.values()]) if (!kind || r.kind === kind) await remove(r.key);
  }, [remove]);

  const resolveLocal = useCallback(async (source: TrackSource): Promise<TrackSource> => {
    if (source.kind !== 'url') return source;
    for (const r of records.current.values()) {
      const f = r.files.find((x) => x.url === source.url && x.done);
      if (f) { try { return await storage.localSource(f.key); } catch { return source; } }
    }
    return source;
  }, [storage]);

  const readText = useCallback(async (id: string): Promise<string | null> => {
    const r = records.current.get(textKey(id));
    const f = r?.files.find((x) => x.key.endsWith(':content') && x.done);
    return f ? storage.readText(f.key) : null;
  }, [storage]);

  const refreshValidity = useCallback(async () => { for (const r of [...records.current.values()]) await applyValidity(r); }, [applyValidity]);

  const checkForUpdates = useCallback(async (key: string): Promise<boolean> => {
    const r = records.current.get(key); if (!r) return false;
    const fresh = await fetchManifestRef.current(r.id, r.kind);
    const changed = manifestHash(fresh) !== r.manifestHash;
    if (changed && r.state === 'ready') await persist({ ...r, state: 'update-available' });
    return changed;
  }, [persist]);

  const setOfflineValidUntil = useCallback(async (key: string, iso: string | null) => {
    const r = records.current.get(key); if (!r) return;
    const next: DownloadRecord = { ...r, validUntil: iso, manifest: { ...r.manifest, offlineValidUntil: iso } };
    await persist(next);
    await applyValidity(next);
  }, [applyValidity, persist]);

  const setSettings = useCallback(async (patch: Partial<DownloadsSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettingsState(next);
    await storage.putJson(SETTINGS_KEY, next);
    pumpRef.current();
  }, [storage]);

  const items = useCallback((): DownloadItem[] => [...records.current.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((r) => toItem(r, inFlight.current, (r.state === 'queued' || r.state === 'downloading') && waitingForWifi(r))), [waitingForWifi]);
  const totals = useCallback(() => ({ bytes: usedBytes, free: freeBytes }), [freeBytes, usedBytes]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => items(), [items, tick, connection, settings]);

  const api: DownloadsApi = useMemo(() => ({ downloadText, downloadAudio, pause, resume, cancel, retry, remove, deleteAll, resolveLocal, readText, refreshValidity, checkForUpdates, setOfflineValidUntil, setSettings, items, totals }), [cancel, checkForUpdates, deleteAll, downloadAudio, downloadText, items, pause, readText, refreshValidity, remove, resolveLocal, resume, retry, setOfflineValidUntil, setSettings, totals]);
  const value = useMemo<DownloadsContextValue>(() => ({ ...api, list, settings, ready, usedBytes, freeBytes, connection }), [api, connection, freeBytes, list, ready, settings, usedBytes]);

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

export function useDownloads(): DownloadsContextValue {
  const v = useContext(DownloadsContext);
  if (!v) throw new Error('useDownloads must be used inside <DownloadsProvider>');
  return v;
}

export function useDownloadsOptional(): DownloadsContextValue | null { return useContext(DownloadsContext); }
