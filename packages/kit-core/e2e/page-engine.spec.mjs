/**
 * Drives page-engine/harness.html (served from packages/kit-core on :4175) with the
 * Playwright installed in /var/www/openshelf. Exits non-zero on any failed assertion.
 */
import { createRequire } from 'node:module';
const require = createRequire('/var/www/openshelf/package.json');
const { chromium } = require('playwright');

const BASE = process.env.HARNESS_URL || 'http://127.0.0.1:4175/packages/kit-core/page-engine/harness.html';
let failures = 0;
const assert = (cond, msg) => { console.log(`${cond ? 'ASSERT-OK ' : 'ASSERT-FAIL'} ${msg}`); if (!cond) failures++; };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', e => { console.log('PAGE-ERROR', e.message); failures++; });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.harnessReady && window.engine && window.engine.count > 0);
await page.waitForTimeout(300);

const count = await page.evaluate(() => window.engine.count);
assert(count > 1, `chapter 1 paginates into ${count} pages at 390x844`);
assert(await page.evaluate(() => window.engine.page) === 0, 'starts on page 0');

await page.evaluate(() => window.engine.next());
assert(await page.evaluate(() => window.engine.page) === 1, 'next() → page 1');
assert((await page.locator('#pos').innerText()) === `2/${count}`, 'onPage fired with 2/N');

await page.evaluate(() => window.engine.goToPct(50));
const pct = await page.evaluate(() => window.engine.offsetPct());
assert(Math.abs(pct - 50) <= Math.ceil(100 / count), `goToPct(50) → offsetPct ${pct} within one page`);

// Font change keeps the passage (from a full middle page).
await page.evaluate(() => window.engine.goTo(2));
const before = await page.evaluate(() => window.firstVisibleText());
await page.fill('#font', '28');
await page.dispatchEvent('#font', 'input');
await page.waitForTimeout(150);
const after = await page.evaluate(() => window.firstVisibleText());
const countLarge = await page.evaluate(() => window.engine.count);
assert(countLarge > count, `28px yields more pages (${countLarge} > ${count})`);
assert(before.length > 0 && after.length > 0 && (after.startsWith(before.slice(0, 20)) || before.startsWith(after.slice(0, 20))), `first visible text kept across font change ("${before}" → "${after}")`);
await page.fill('#font', '18');
await page.dispatchEvent('#font', 'input');
await page.waitForTimeout(150);

// Tap zones (mouse click without drag).
await page.evaluate(() => window.engine.goTo(2));
const box = await page.locator('#container').boundingBox();
await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
assert(await page.evaluate(() => window.engine.page) === 3, 'tap right third → next page');
await page.mouse.click(box.x + box.width * 0.1, box.y + box.height / 2);
assert(await page.evaluate(() => window.engine.page) === 2, 'tap left third → previous page');
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);
assert((await page.locator('#tap').innerText()) === 'center', 'centre tap reports center');
assert(await page.evaluate(() => window.engine.page) === 2, 'centre tap does not turn');

// Swipe left → next.
const p0 = await page.evaluate(() => window.engine.page);
await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5); // establishes touch capability
await page.evaluate(() => window.engine.goTo(2));
await page.evaluate(({ x, y }) => {
  const el = document.getElementById('container');
  const t = (type, cx) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchstart' ? [new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })] : [], changedTouches: [new Touch({ identifier: 1, target: el, clientX: cx, clientY: y })] }));
  t('touchstart', x + 150); t('touchend', x + 20);
}, { x: box.x, y: box.y + box.height / 2 });
assert(await page.evaluate(() => window.engine.page) === 3, 'swipe left → next page');

// Keyboard, from a middle page (the swipe above may have landed on the last page).
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await page.evaluate(() => window.engine.goTo(1));
await page.keyboard.press('ArrowRight');
assert(await page.evaluate(() => window.engine.page) === 2, 'ArrowRight → next');
await page.keyboard.press('ArrowLeft');
assert(await page.evaluate(() => window.engine.page) === 1, 'ArrowLeft → previous');

// Resize keeps the passage (from a full middle page).
await page.evaluate(() => window.engine.goTo(2));
await page.waitForTimeout(100);
const beforeResize = await page.evaluate(() => window.firstVisibleText());
await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(600);
const countWide = await page.evaluate(() => window.engine.count);
const afterResize = await page.evaluate(() => window.firstVisibleText());
assert(countWide !== count, `resize to 768 changes the page count (${count} → ${countWide})`);
assert(afterResize.startsWith(beforeResize.slice(0, 20)) || beforeResize.startsWith(afterResize.slice(0, 20)), `first visible text kept across resize ("${beforeResize}" → "${afterResize}")`);

await browser.close();
console.log(failures === 0 ? 'PAGE-ENGINE PASS' : `PAGE-ENGINE FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
