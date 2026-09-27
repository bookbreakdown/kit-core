#!/usr/bin/env node
/**
 * Generates packages/kit-core/fixtures/expected/<slug>.json from the WEB reader's
 * own implementation, so the kit-core parser can be tested for byte-for-byte
 * equality with what libraryofages.com paginates.
 *
 * Runs against the openshelf checkout (ESM, "type": "module"). Re-run only when
 * the web parser or pre-clean changes; commit the output.
 *
 * Pre-clean is copied from resources/js/pages/ReaderPage.jsx (the three
 * replacements applied before parseChapters), in the same order.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const OPENSHELF_API = '/var/www/openshelf/resources/js/lib/api.js';
const { parseChapters } = await import(OPENSHELF_API);

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'packages', 'kit-core', 'fixtures');
const outDir = join(fixturesDir, 'expected');

function preCleanLikeReaderPage(raw) {
  let md = raw;
  md = md.replace(/```\w*\n?/g, '');
  md = md.replace(/^[ \t]+/gm, '');
  md = md.replace(/^##\s[^\n]+\n+/, '');
  return md;
}

const files = readdirSync(fixturesDir).filter((f) => f.endsWith('.md'));
for (const f of files) {
  const raw = readFileSync(join(fixturesDir, f), 'utf8');
  const chapters = parseChapters(preCleanLikeReaderPage(raw));
  const out = join(outDir, basename(f, '.md') + '.json');
  writeFileSync(out, JSON.stringify({ chapters }, null, 2) + '\n');
  console.log(`wrote ${out} (${chapters.length} chapters)`);
}
