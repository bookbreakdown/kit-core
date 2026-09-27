#!/usr/bin/env node
// Writes apps/playground/assets/fixtures/manifest.json: a BundleManifest for the playground's
// fixture text and the two tone MP3s, with real byte sizes and sha256 digests. URLs are the
// bundled asset names; the demo screen rewrites them to served asset URIs at run time.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..', 'apps', 'playground');
const file = (rel) => {
  const p = join(app, 'assets', rel);
  const buf = readFileSync(p);
  return { url: `asset:${rel}`, byteSize: statSync(p).size, sha256: createHash('sha256').update(buf).digest('hex') };
};
const text = readFileSync(join(app, 'assets', 'fixtures', 'treasure-island.md'), 'utf8');
const wordCount = text.split(/\s+/).filter(Boolean).length;
const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
const manifest = {
  id: 'treasure-island',
  title: 'Treasure Island',
  content: { ...file('fixtures/treasure-island.md'), wordCount },
  cover: null,
  voices: [{ voice: 'demo', label: 'Demo', chapters: [
    { chapterNumber: 1, title: 'Tone A', durationSeconds: 5, backMatter: false, ...file('audio/tone-a.mp3') },
    { chapterNumber: 2, title: 'Tone B', durationSeconds: 5, backMatter: false, ...file('audio/tone-b.mp3') },
  ] }],
  gated: true,
  offlineValidUntil: validUntil,
  finishChapterIndex: 0,
};
writeFileSync(join(app, 'assets', 'fixtures', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: text ${manifest.content.byteSize} B sha256 ${manifest.content.sha256.slice(0, 12)}…, audio ${manifest.voices[0].chapters.map((c) => `${c.byteSize} B`).join(' + ')}, validUntil ${validUntil}`);
