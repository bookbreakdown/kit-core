import { ENGINE_SOURCE } from '@libraryofages/kit-core';
import { buildReaderDocument, themeVariables } from '../document';
import { renderChapterHtml } from '../markdown';
import type { ReaderSettings } from '../types';

const theme = { name: 't', colors: { background: 'paper', text: 'ink', muted: 'ash', accent: 'ember', surface: 'card', border: 'line' }, fonts: { serif: 'Georgia, serif', sans: 'Inter, sans-serif' } };
const settings: ReaderSettings = { theme: 'light', fontSize: 20, fontFamily: 'serif', lineSpacing: 2, margins: 2, align: 'left', brightness: 1, volumeKeysTurnPages: false };

test('renderChapterHtml gives the web reader element classes', () => {
  const html = renderChapterHtml('### A\n\nb\n\n> q\n\n- x\n');
  expect(html).toContain('<h3 class="text-xl font-semibold text-center mt-6 mb-3">A</h3>');
  expect(html).toContain('<p class="mb-4">b</p>');
  expect(html).toContain('<blockquote class="border-l-2');
  expect(html).toContain('<ul class="list-disc pl-6 mb-4">');
  expect(html).toContain('<li class="mb-1">');
});

test('buildReaderDocument carries theme, typography and the engine', () => {
  const doc = buildReaderDocument({ bodyHtml: '<p class="mb-4">hello</p>', theme, settings, engineSource: ENGINE_SOURCE });
  expect(doc).toContain('--bg: paper');
  expect(doc).toContain('--size: 20px');
  expect(doc).toContain('--font: Georgia, serif');
  expect(doc).toContain('--leading: 1.8');
  expect(doc).toContain('export function createPageEngine'.replace('export ', '').slice(0, 10)); // engine present
  expect(doc).toContain(ENGINE_SOURCE.slice(200, 260));
  expect(doc).toContain('<div id="container"><div id="column"><p class="mb-4">hello</p></div></div>');
});

test('themeVariables maps brightness to a dim overlay and family choices', () => {
  expect(themeVariables(theme, { ...settings, brightness: 0.6 })).toContain('--dim: 0.4');
  expect(themeVariables(theme, { ...settings, fontFamily: 'sans' })).toContain('--font: Inter, sans-serif');
  expect(themeVariables(theme, { ...settings, fontFamily: 'system' })).toContain('--font: system-ui');
});
