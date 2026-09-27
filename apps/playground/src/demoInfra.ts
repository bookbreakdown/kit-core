import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import type { BundleManifest, ListeningPosition, ProgressStore, ValidityPolicy } from '@libraryofages/kit-core';
import type { ConnectionState, Connectivity } from '@libraryofages/downloads';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MANIFEST = require('../assets/fixtures/manifest.json') as BundleManifest;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ASSETS: Record<string, number> = { 'audio/tone-a.mp3': require('../assets/audio/tone-a.mp3'), 'audio/tone-b.mp3': require('../assets/audio/tone-b.mp3'), 'fixtures/treasure-island.md': require('../assets/fixtures/treasure-island.md') };

function ls(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

/** Resolves an `asset:` URL from the fixture manifest to the served asset URI. */
export async function assetUri(rel: string): Promise<string> {
  const id = ASSETS[rel];
  if (id === undefined) throw new Error(`unknown fixture asset ${rel}`);
  const asset = Asset.fromModule(id);
  if (Platform.OS !== 'web') await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}

export async function fixtureManifest(): Promise<BundleManifest> {
  const rewrite = async <T extends { url: string }>(f: T): Promise<T> => ({ ...f, url: f.url.startsWith('asset:') ? await assetUri(f.url.slice('asset:'.length)) : f.url });
  return {
    ...MANIFEST,
    content: await rewrite(MANIFEST.content),
    cover: MANIFEST.cover ? await rewrite(MANIFEST.cover) : null,
    voices: await Promise.all(MANIFEST.voices.map(async (v) => ({ ...v, chapters: await Promise.all(v.chapters.map(rewrite)) }))),
  };
}

export const fixtureManifestRaw = MANIFEST;

export function progressStore(prefix: string): ProgressStore & { peek(id: string): ListeningPosition | null } {
  const mem = new Map<string, ListeningPosition>();
  const s = ls();
  const read = (id: string) => { if (s) { const raw = s.getItem(`${prefix}:progress:${id}`); return raw ? (JSON.parse(raw) as ListeningPosition) : null; } return mem.get(id) ?? null; };
  return { async load(id) { return read(id); }, async save(id, p) { if (s) s.setItem(`${prefix}:progress:${id}`, JSON.stringify(p)); else mem.set(id, p); }, peek: read };
}

export type PolicyMode = 'valid' | 'lapsed' | 'expired';
export function policyFor(mode: () => PolicyMode): ValidityPolicy {
  return { isPlayable: () => { const m = mode(); return m === 'valid' ? { ok: true } : { ok: false, reason: m }; } };
}

/** A connectivity stub the demo toggles between Wi-Fi and cellular. */
export class DemoConnectivity implements Connectivity {
  state: ConnectionState = { online: true, type: 'wifi' };
  private handlers = new Set<(s: ConnectionState) => void>();
  async current() { return this.state; }
  subscribe(h: (s: ConnectionState) => void) { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
  set(type: 'wifi' | 'cellular') { this.state = { online: true, type }; for (const h of this.handlers) h(this.state); }
}
