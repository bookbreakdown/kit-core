/**
 * Driven Reader journey on the playground's web export (FR-READ-11..16, 18, onBookEnd,
 * onChapterEnd, insertPages, timings).
 *
 *   npx expo export --platform web        (in apps/playground)
 *   npx serve dist -l 4173                (background)
 *   node e2e/reader.spec.mjs
 *
 * Exits non-zero on any failed assertion. Screenshots land beside this file.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/var/www/openshelf/package.json');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYGROUND_URL || 'http://127.0.0.1:4173';
const DARK_BG = 'rgb(18, 18, 18)'; // READER_THEMES.dark.colors.background

let failures = 0;
function assert(cond, msg) {
  console.log(`${cond ? 'ASSERT-OK ' : 'ASSERT-FAIL'} ${msg}`);
  if (!cond) failures += 1;
}
const t = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', (e) => { console.log('PAGE-ERROR', e.message); failures += 1; });

/** The live reader iframe (a new one per chapter). */
async function frame() {
  for (let i = 0; i < 100; i += 1) {
    const frames = page.frames().filter((f) => f !== page.mainFrame());
    const f = frames[frames.length - 1];
    if (f) {
      const ok = await f.evaluate(() => !!(window.engine && window.engine.count > 0 && document.getElementById('column').textContent.length > 0)).catch(() => false);
      if (ok) return f;
    }
    await sleep(50);
  }
  throw new Error('reader frame never became ready');
}
const footer = async () => (await page.locator(t('reader-footer-text')).innerText()).trim();
const firstVisible = (f) => f.evaluate(() => {
  const r = document.caretRangeFromPoint(40, 60);
  const node = r && r.startContainer;
  const text = node ? (node.textContent || '') : '';
  return text.trim().slice(0, 30);
});
async function hostBox() { return page.locator(t('reader-host')).boundingBox(); }
async function tapZone(zone) {
  const b = await hostBox();
  const x = zone === 'left' ? b.x + b.width * 0.15 : zone === 'right' ? b.x + b.width * 0.85 : b.x + b.width / 2;
  await page.mouse.click(x, b.y + b.height / 2);
  await sleep(150);
}
async function swipeLeft(f) {
  await f.evaluate(() => {
    const c = document.getElementById('container');
    const mk = (type, x) => new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: c, clientX: x, clientY: 400 })], changedTouches: [new Touch({ identifier: 1, target: c, clientX: x, clientY: 400 })] });
    c.dispatchEvent(mk('touchstart', 300));
    c.dispatchEvent(mk('touchend', 100));
  });
  await sleep(150);
}
const pageOf = (text) => Number((text.match(/^(\d+) of (\d+)/) || [])[1]);
const countOf = (text) => Number((text.match(/^(\d+) of (\d+)/) || [])[2]);

// ---------------------------------------------------------------------------------------
await page.goto(BASE + '/reader', { waitUntil: 'networkidle' });
await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('playground:')) localStorage.removeItem(k); });
await page.reload({ waitUntil: 'networkidle' });
let f = await frame();
await sleep(300);
let ft = await footer();
assert((await page.locator(t('reader-topbar')).count()) === 0, 'FR-READ-11: opens immersive (no top bar)');
assert(pageOf(ft) === 1 && countOf(ft) > 1, `footer "${ft}" is page 1 of N with N > 1`);
await page.screenshot({ path: join(here, 'reader-immersive.png') });

await tapZone('center');
assert((await page.locator(t('reader-topbar')).count()) === 1, 'FR-READ-11: centre tap shows the top bar');
assert((await page.locator(t('demo-notice')).count()) === 1, 'FR-READ-18: host notice renders with the chrome');
await page.screenshot({ path: join(here, 'reader-chrome.png') });
await tapZone('right');
ft = await footer();
assert(pageOf(ft) === 2, `FR-READ-12: right tap → page 2 ("${ft}")`);
assert((await page.locator(t('reader-topbar')).count()) === 0, 'right tap hides the chrome');
assert((await page.locator(t('demo-notice')).count()) === 0, 'FR-READ-18: notice never shows over the page');
await swipeLeft(f);
ft = await footer();
assert(pageOf(ft) === 3, `FR-READ-12: swipe left → page 3 ("${ft}")`);
await page.keyboard.press('ArrowRight');
await sleep(150);
ft = await footer();
assert(pageOf(ft) === 4, `keyboard ArrowRight → page 4 ("${ft}")`);
await tapZone('left');
ft = await footer();
assert(pageOf(ft) === 3, `left tap → page 3 ("${ft}")`);

// footer modes
await page.locator(t('reader-footer')).click();
ft = await footer();
assert(/^\d+% of book$/.test(ft), `FR-READ-13: footer mode 2 "${ft}"`);
await page.locator(t('reader-footer')).click();
ft = await footer();
assert(/about \d+ (min|hr)/.test(ft) && /left in chapter/.test(ft) && /left in book/.test(ft), `FR-READ-13: footer mode 3 "${ft}"`);
await page.locator(t('reader-footer')).click();
ft = await footer();
assert(/in chapter$/.test(ft), `footer cycles back to pages ("${ft}")`);

// settings: font 18 → 28 keeps the passage; dark theme reaches the page
await tapZone('center');
await page.locator(t('reader-settings-button')).click();
const before = await firstVisible(f);
const countBefore = await f.evaluate(() => window.engine.count);
for (let i = 0; i < 10; i += 1) await page.locator(t('settings-font-up')).click();
await sleep(400);
const after = await firstVisible(f);
const countAfter = await f.evaluate(() => window.engine.count);
const sizeAfter = await f.evaluate(() => getComputedStyle(document.getElementById('column')).fontSize);
assert(sizeAfter === '28px', `FR-READ-14: font size applied live (${sizeAfter})`);
assert(countAfter > countBefore, `larger font → more pages (${countBefore} → ${countAfter})`);
// CSS columns cannot begin a page at an arbitrary character, so the guarantee is that the line
// the reader was looking at is still on the visible page (its top line may be up to a page earlier).
const passageVisible = await f.evaluate((needle) => {
  const c = document.getElementById('container'); const r = c.getBoundingClientRect();
  const walker = document.createTreeWalker(document.getElementById('column'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode; const i = n.textContent.indexOf(needle);
    if (i < 0) continue;
    const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, Math.min(n.length, i + needle.length));
    for (const rect of rg.getClientRects()) if (rect.left >= r.left - 1 && rect.right <= r.right + 1 && rect.top >= r.top - 1 && rect.bottom <= r.bottom + 1) return true;
  }
  return false;
}, before.slice(0, 20));
assert(before.length > 0 && passageVisible, `FR-READ-14: passage preserved across font change ("${before}" still on the page; top line now "${after}")`);
await page.locator(t('settings-theme-dark')).click();
await sleep(200);
const bodyBg = await f.evaluate(() => getComputedStyle(document.body).backgroundColor);
assert(bodyBg === DARK_BG, `FR-READ-14: dark theme reaches the page (${bodyBg})`);
await page.screenshot({ path: join(here, 'reader-settings.png') });
await page.locator(t('settings-theme-light')).click();
await page.locator(t('reader-settings-scrim')).click();
await sleep(100);

// go-to slider by book percent and the back pill
ft = await footer();
const bubbleBefore = await page.locator(t('reader-goto-bubble')).innerText();
const track = await page.locator(t('reader-goto-track')).boundingBox();
await page.mouse.click(track.x + track.width * 0.5, track.y + track.height / 2);
await sleep(600);
f = await frame();
await sleep(200);
const bubbleAfter = await page.locator(t('reader-goto-bubble')).innerText();
assert(/^Chapter \d+/.test(bubbleAfter) && bubbleAfter !== bubbleBefore, `FR-READ-15: go-to 50% → bubble "${bubbleAfter}" (was "${bubbleBefore}")`);
const pct = await page.locator(t('reader-goto-pct')).innerText();
assert(Math.abs(Number(pct.replace('%', '')) - 50) <= 5, `slider sits near 50% (${pct})`);
assert((await page.locator(t('reader-back-pill')).count()) === 1, 'FR-READ-15: back pill shown after a jump');
await page.locator(t('reader-back-pill')).click();
await sleep(600);
f = await frame();
await sleep(200);
const ftBack = await footer();
assert(ftBack === ft, `FR-READ-15: back pill returns exactly ("${ftBack}" == "${ft}")`);

// TOC: back-matter divider and a jump
await page.locator(t('reader-toc-button')).click();
assert((await page.locator(t('reader-toc-backmatter')).count()) === 1, 'TOC shows the "Back matter" divider');
assert((await page.locator(t('reader-toc-item-0')).getAttribute('aria-selected')) === 'true', 'TOC marks the current chapter');
const chapterOpenStart = Date.now();
await page.locator(t('reader-toc-item-1')).click();
f = await frame();
const chapterOpenMs = Date.now() - chapterOpenStart;
await sleep(200);
await tapZone('center');
await page.locator(t('reader-toc-button')).click();
assert((await page.locator(t('reader-toc-item-1')).getAttribute('aria-selected')) === 'true', 'TOC jump lands on chapter 2');
await page.locator(t('reader-toc-scrim')).click();
await tapZone('center');
assert(chapterOpenMs < 500, `PERF: chapter open ${chapterOpenMs} ms < 500 ms`);

// page-turn timing (engine-level, 20 consecutive next() calls)
const turnAvg = await f.evaluate(() => {
  window.engine.goTo(0);
  const t0 = performance.now();
  for (let i = 0; i < 20; i += 1) window.engine.next();
  return (performance.now() - t0) / 20;
});
assert(turnAvg < 100, `PERF: page turn average ${turnAvg.toFixed(2)} ms < 100 ms`);

// furthest prompt → Go
await page.locator(t('demo-furthest')).click();
await page.locator(t('furthest-prompt')).waitFor({ timeout: 5000 });
assert(true, 'FR-READ-16: furthest prompt appears when another device is ahead');
await page.locator(t('furthest-go')).click();
await sleep(600);
f = await frame();
await sleep(200);
await tapZone('center');
await page.locator(t('reader-toc-button')).click();
assert((await page.locator(t('reader-toc-item-3')).getAttribute('aria-selected')) === 'true', 'FR-READ-16: Go lands on the furthest chapter (chapter 4)');
await page.locator(t('reader-toc-scrim')).click();
await tapZone('center');
await page.locator(t('demo-furthest')).click();

// reload restores the position (saved to localStorage by the demo store)
await sleep(2500);
const ftBeforeReload = await footer();
await page.reload({ waitUntil: 'networkidle' });
f = await frame();
await sleep(500);
const ftAfterReload = await footer();
assert(ftAfterReload === ftBeforeReload, `position restored after reload ("${ftAfterReload}" == "${ftBeforeReload}")`);

// insert page after chapter 0, then chapter 1
await tapZone('center');
await page.locator(t('reader-toc-button')).click();
await page.locator(t('reader-toc-item-0')).click();
f = await frame();
await sleep(200);
await f.evaluate(() => window.engine.goTo(1e9));
await sleep(100);
await tapZone('right');
await page.locator(t('demo-host-page')).waitFor({ timeout: 5000 });
assert(true, 'insertPages: host page shown after chapter 1 ends');
await page.locator(t('reader-insert-page')).click({ position: { x: 300, y: 400 } });
await sleep(600);
f = await frame();
await sleep(200);
assert((await page.locator(t('demo-host-page')).count()) === 0, 'host page dismissed by a forward tap');
await tapZone('center');
await page.locator(t('reader-toc-button')).click();
assert((await page.locator(t('reader-toc-item-1')).getAttribute('aria-selected')) === 'true', 'after the host page the reader is on chapter 2');
const endsText = await page.locator(t('demo-chapter-ends')).innerText();
assert(/0/.test(endsText), `onChapterEnd(0) fired (${endsText})`);

// end of the last main-text chapter → Book end
const lastMain = await page.locator(t('reader-toc-backmatter')).evaluate((el) => {
  const prev = el.previousElementSibling; return prev ? Number(prev.getAttribute('data-testid').split('-').pop()) : -1;
});
await page.locator(t(`reader-toc-item-${lastMain}`)).click();
f = await frame();
await sleep(200);
await f.evaluate(() => window.engine.goTo(1e9));
await sleep(100);
await page.keyboard.press('ArrowRight');
await page.locator(t('demo-book-end')).waitFor({ timeout: 5000 });
assert(true, `Book end banner after the last main-text chapter (${lastMain + 1})`);

await browser.close();
console.log(failures === 0 ? 'READER-JOURNEY PASS' : `READER-JOURNEY FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
