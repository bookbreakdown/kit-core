/**
 * Driven Downloads journey on the playground's web export (FR-DL-03/04/05/09/10).
 *   npx expo export --platform web && npx serve -s dist -l 4173 && node e2e/downloads.spec.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/var/www/openshelf/package.json');
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYGROUND_URL || 'http://127.0.0.1:4173';
const manifest = JSON.parse(readFileSync(join(here, '..', 'assets', 'fixtures', 'manifest.json'), 'utf8'));
const TEXT_KEY = 'text:treasure-island';
const AUDIO_KEY = 'audio:treasure-island:demo';

let failures = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'ASSERT-OK ' : 'ASSERT-FAIL'} ${msg}`); if (!cond) failures += 1; };
const t = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
page.on('pageerror', (e) => { console.log('PAGE-ERROR', e.message); failures += 1; });
const counts = { a: 0, b: 0, text: 0 };
let delayB = 0;
await context.route('**/*', async (route) => {
  const url = route.request().url();
  if (/tone-a[^/]*\.mp3/.test(url)) counts.a += 1;
  if (/tone-b[^/]*\.mp3/.test(url)) { counts.b += 1; if (delayB) await sleep(delayB); }
  if (/treasure-island[^/]*\.md/.test(url)) counts.text += 1;
  await route.continue();
});
const stateOf = async (key) => (await page.locator(t(`download-${key}-state`)).innerText()).trim();
const waitState = async (key, re, ms = 20000) => { await page.locator(t(`download-${key}-state`)).filter({ hasText: re }).waitFor({ timeout: ms }); return stateOf(key); };

await page.goto(BASE + '/downloads', { waitUntil: 'networkidle' });
await page.evaluate(async () => { for (const k of Object.keys(localStorage)) if (k.startsWith('playground:')) localStorage.removeItem(k); await new Promise((r) => { const d = indexedDB.deleteDatabase('kit-downloads'); d.onsuccess = d.onerror = d.onblocked = r; }); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator(t('downloads-list')).waitFor({ timeout: 15000 });

// text download → ready, size equals the manifest bytes, offline read shows the length
await page.locator(t('demo-download-text')).click();
assert((await waitState(TEXT_KEY, /Downloaded/)) === 'Downloaded', 'text download → Downloaded');
const size = await page.locator(t(`download-${TEXT_KEY}-size`)).innerText();
const expectedSize = `${(manifest.content.byteSize / 1024).toFixed(1)} KB`;
assert(size === expectedSize, `size shown equals the manifest bytes (${size} == ${expectedSize} for ${manifest.content.byteSize} B)`);
await page.locator(t('demo-offline-read')).click();
await sleep(500);
const len = await page.locator(t('demo-read-length')).innerText();
assert(/read length: [1-9]\d{4,}/.test(len), `offline read returns the text (${len})`);

// audio download with resume after a mid-download reload; the first file is not re-fetched
delayB = 2500;
await page.locator(t('demo-download-audio')).click();
await page.locator(t(`download-${AUDIO_KEY}-state`)).waitFor();
await sleep(1200); // tone-a done, tone-b held by the route delay
const aBefore = counts.a;
await page.reload({ waitUntil: 'networkidle' });
await page.locator(t('downloads-list')).waitFor({ timeout: 15000 });
delayB = 0;
assert((await waitState(AUDIO_KEY, /Downloaded/)) === 'Downloaded', 'audio resumes after a reload and completes');
assert(counts.a === aBefore && counts.a === 1, `first chapter fetched once across the reload (tone-a requests: ${counts.a})`);
assert(counts.b >= 1, `second chapter fetched after the reload (tone-b requests: ${counts.b})`);
await page.screenshot({ path: join(here, 'downloads-list.png'), fullPage: true });

// offline play from a blob: source
await context.setOffline(true);
await page.locator(t('demo-play-offline')).click();
await sleep(1500);
const from = await page.locator(t('demo-played-from')).innerText();
const src = await page.evaluate(() => window.__demoAudio?.src || '');
const playing = await page.evaluate(() => !!window.__demoAudio && !window.__demoAudio.paused && window.__demoAudio.currentTime > 0);
assert(from.includes('blob:') && src.startsWith('blob:'), `offline play resolves a blob: source (${from})`);
assert(playing, 'offline playback is running from local bytes');
await context.setOffline(false);
await page.evaluate(() => window.__demoAudio?.pause());

// policy → lapsed → locked; valid → ready
await page.locator(t('demo-policy-lapsed')).click();
assert(/lapsed/i.test(await waitState(TEXT_KEY, /lapsed/i)), 'lapsed policy → item locked');
await page.locator(t('demo-policy-valid')).click();
assert((await waitState(TEXT_KEY, /Downloaded/)) === 'Downloaded', 'valid policy → item ready again');

// wifiOnly with cellular: audio waits, text proceeds
await page.locator(t(`download-${AUDIO_KEY}-delete`)).click();
await page.locator(t(`download-${TEXT_KEY}-delete`)).click();
await sleep(500);
await page.locator(t('demo-net-cellular')).click();
await sleep(200);
await page.locator(t('demo-download-audio')).click();
await page.locator(t('demo-download-text')).click();
assert((await waitState(TEXT_KEY, /Downloaded/)) === 'Downloaded', 'on cellular the text download proceeds');
assert(/Waiting for Wi-Fi/.test(await waitState(AUDIO_KEY, /Waiting for Wi-Fi/)), 'on cellular the audio download waits for Wi-Fi');
await page.locator(t('demo-net-wifi')).click();
assert((await waitState(AUDIO_KEY, /Downloaded/)) === 'Downloaded', 'Wi-Fi back → audio completes');

// remove → totals 0
await page.locator(t(`download-${AUDIO_KEY}-delete`)).click();
await page.locator(t(`download-${TEXT_KEY}-delete`)).click();
await sleep(600);
const used = await page.locator(t('downloads-used')).innerText();
assert(/^0 B used/.test(used), `remove → totals 0 (${used})`);

await browser.close();
console.log(failures === 0 ? 'DOWNLOADS-JOURNEY PASS' : `DOWNLOADS-JOURNEY FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
