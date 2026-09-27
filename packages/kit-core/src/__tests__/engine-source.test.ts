import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENGINE_SOURCE } from '../page-engine/engine-source';

test('the injected engine source equals page-engine/engine.js', () => {
  const file = readFileSync(join(__dirname, '..', '..', 'page-engine', 'engine.js'), 'utf8');
  expect(ENGINE_SOURCE).toBe(file);
  expect(ENGINE_SOURCE).toContain('export function createPageEngine');
});
