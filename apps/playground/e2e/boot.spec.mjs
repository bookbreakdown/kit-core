/**
 * Driven boot journey for the playground's web export.
 *
 *   npx expo export --platform web        (in apps/playground)
 *   npx serve dist -l 4173                (background)
 *   node e2e/boot.spec.mjs                (uses the Playwright installed in /var/www/openshelf)
 *
 * Exits non-zero on any failed assertion. Screenshots land beside this file.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const require = createRequire('/var/www/openshelf/package.json');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLAYGROUND_URL || 'http://127.0.0.1:4173';
const expected = JSON.parse(
  readFileSync(join(here, '..', '..', '..', 'packages', 'kit-core', 'fixtures', 'expected', 'treasure-island.json'), 'utf8'),
);
const EXPECTED_COUNT = expected.chapters.length;
const EXPECTED_FIRST_TITLE = expected.chapters[0].title;
const PACKAGES = ['@libraryofages/kit-core', '@libraryofages/reader', '@libraryofages/player', '@libraryofages/downloads'];

let failures = 0;
function assert(cond, msg) {
  console.log(`${cond ? 'ASSERT-OK ' : 'ASSERT-FAIL'} ${msg}`);
  if (!cond) failures += 1;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on('pageerror', (e) => { console.log('PAGE-ERROR', e.message); failures += 1; });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.getByText('Kit Playground').first().waitFor({ timeout: 15000 });
const homeText = await page.locator('body').innerText();
for (const name of PACKAGES) assert(homeText.includes(name), `home shows ${name}`);
for (const name of PACKAGES) {
  const pkg = JSON.parse(readFileSync(join(here, '..', '..', '..', 'packages', name.split('/')[1], 'package.json'), 'utf8'));
  assert(homeText.includes(pkg.version), `home shows ${name} version ${pkg.version}`);
}
await page.screenshot({ path: join(here, 'home.png'), fullPage: true });

await page.getByText('Parser demo').first().click();
await page.getByText(/\d+ chapters/).waitFor({ timeout: 20000 });
const demoText = await page.locator('body').innerText();
assert(demoText.includes(`${EXPECTED_COUNT} chapters`), `parser demo shows "${EXPECTED_COUNT} chapters"`);
assert(demoText.includes(EXPECTED_FIRST_TITLE), `parser demo lists first title "${EXPECTED_FIRST_TITLE}"`);
assert(/parser/.test(page.url()), `URL is the /parser route (${page.url()})`);
await page.screenshot({ path: join(here, 'parser-demo.png'), fullPage: true });

// Deep link straight to the demo route.
await page.goto(BASE + '/parser', { waitUntil: 'networkidle' });
await page.getByText(/\d+ chapters/).waitFor({ timeout: 20000 });
assert(true, 'deep link /parser opens the demo directly');

await browser.close();
console.log(failures === 0 ? 'BOOT-JOURNEY PASS' : `BOOT-JOURNEY FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
