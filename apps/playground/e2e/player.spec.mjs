/**
 * Driven Player journey on the playground's web export (FR-AUD-02/03/05/06/08/09/10).
 *   npx expo export --platform web && npx serve -s dist -l 4173 && node e2e/player.spec.mjs
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/var/www/openshelf/package.json');
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYGROUND_URL || 'http://127.0.0.1:4173';

let failures = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'ASSERT-OK ' : 'ASSERT-FAIL'} ${msg}`); if (!cond) failures += 1; };
const t = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => { console.log('PAGE-ERROR', e.message); failures += 1; });
const state = async () => (await page.locator(t('demo-state')).innerText()).trim().split(':');
const audio = () => page.evaluate(() => ({ src: window.__demoAudio?.src || '', t: window.__demoAudio?.currentTime || 0, paused: window.__demoAudio?.paused, rate: window.__demoAudio?.playbackRate, vol: window.__demoAudio?.volume }));

await page.goto(BASE + '/player', { waitUntil: 'networkidle' });
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('playground:')) localStorage.removeItem(k); });
await page.reload({ waitUntil: 'networkidle' });
await page.locator(t('demo-state')).waitFor({ timeout: 15000 });
await sleep(500);

// play → playing and time advancing
await page.locator(t('demo-play')).click();
await sleep(2200);
let s = await state();
assert(s[2] === 'playing' && Number(s[1]) > 0.5, `play → playing with time advancing (${s.join(':')})`);
assert((await page.locator(t('mini-player')).count()) === 1, 'mini player shown while loaded');

// pause → saved position readout
await page.locator(t('demo-pause')).click();
await sleep(400);
const saved = await page.locator(t('demo-saved')).innerText();
assert(/"trackIndex":0/.test(saved) && /"positionSeconds":[1-9]/.test(saved), `pause saves the position (${saved})`);

// full player: seek to 3 s, speed, ±15, next/prev
await page.locator(t('demo-expand')).click();
await page.locator(t('full-player')).waitFor();
const track = await page.locator(t('seek-track')).boundingBox();
await page.mouse.click(track.x + track.width * 0.6, track.y + track.height / 2);
await sleep(300);
let a = await audio();
assert(a.t >= 2.5 && a.t <= 3.5, `seek bar → ~3 s (${a.t.toFixed(2)})`);
await page.locator(t('player-speed')).click();
await sleep(200);
a = await audio();
assert(a.rate === 1.25, `speed cycles to 1.25 (${a.rate})`);
await page.locator(t('player-fwd15')).click();
await sleep(400);
s = await state();
assert(s[0] === '1', `+15 past the end moves to the next track (${s.join(':')})`);
await page.locator(t('player-prev')).click();
await sleep(400);
s = await state();
assert(s[0] === '0', `prev → track 1 (${s.join(':')})`);
await page.locator(t('player-next')).click();
await sleep(400);
s = await state();
assert(s[0] === '1', `next → track 2 (${s.join(':')})`);
await page.locator(t('player-back15')).click();
await sleep(300);
a = await audio();
assert(a.t === 0, `−15 clamps to 0 (${a.t})`);
await page.screenshot({ path: join(here, 'player-full.png') });
await page.locator(t('player-collapse')).click();

// block track 2 → tapping it shows the lock and does not play
await page.locator(t('demo-block')).click();
await sleep(500);
await page.locator(t('demo-expand')).click();
await page.locator(t('player-chapters')).click();
await page.locator(t('chapter-1')).click();
await sleep(300);
const blocked = await page.locator(t('demo-blocked')).innerText();
assert(/blocked: 1/.test(blocked), `blocked track refused and reported (${blocked})`);
assert((await page.locator(t('chapter-1')).innerText()).includes('🔒'), 'blocked track shows a lock');
await page.locator(t('player-collapse')).click();
await page.locator(t('demo-block')).click();
await sleep(400);

// voice switch keeps the index and rewinds 15 s (clamped to 0 here)
await page.locator(t('demo-play')).click();
await sleep(1500);
const before = await audio();
await page.locator(t('demo-voice')).click();
await sleep(800);
const after = await audio();
s = await state();
assert(s[0] === '1' && after.src !== before.src, `voice switch keeps track index 2 with a different source (${s[0]}; ${before.src.split('/').pop()} → ${after.src.split('/').pop()})`);
// 5 s tracks: position − 15 clamps to 0, then playback resumes for the 800 ms wait
assert(after.t < before.t && after.t <= 1.2, `voice switch rewinds (${before.t.toFixed(1)} → ${after.t.toFixed(1)})`);

// sleep timer 3 s → fade then stop
await page.locator(t('demo-sleep-3s')).click();
await sleep(1200);
a = await audio();
assert(a.vol < 1, `sleep timer fades the volume (${a.vol})`);
await sleep(3000);
a = await audio();
s = await state();
assert(a.paused === true && s[2] === 'paused' && a.vol === 1, `sleep timer stopped playback and restored volume (${s.join(':')}, vol ${a.vol})`);

// playlist end banner after the last track ends
await page.locator(t('demo-expand')).click();
await page.locator(t('player-chapters')).click();
await page.locator(t('chapter-1')).click();
await page.locator(t('player-collapse')).click();
await page.locator(t('demo-play')).click();
await page.evaluate(() => { window.__demoAudio.currentTime = 4.7; });
await page.locator(t('demo-playlist-end')).waitFor({ timeout: 8000 });
assert(true, 'onPlaylistEnd banner after the last track ends');

// reload → load restores the saved position
await page.locator(t('demo-pause')).click().catch(() => {});
await page.evaluate(() => { window.__demoAudio.currentTime = 2; });
await page.locator(t('demo-play')).click();
await sleep(600);
await page.locator(t('demo-pause')).click();
await sleep(300);
const savedBefore = await page.locator(t('demo-saved')).innerText();
await page.reload({ waitUntil: 'networkidle' });
await page.locator(t('demo-state')).waitFor({ timeout: 15000 });
await sleep(800);
s = await state();
const m = savedBefore.match(/"trackIndex":(\d+),"positionSeconds":(\d+)/);
assert(m && s[0] === m[1] && Math.abs(Number(s[1]) - Number(m[2])) < 1, `reload restores the saved position (${savedBefore} → ${s.join(':')})`);

await browser.close();
console.log(failures === 0 ? 'PLAYER-JOURNEY PASS' : `PLAYER-JOURNEY FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
