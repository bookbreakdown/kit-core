import type { Theme } from '@libraryofages/kit-core';
import type { ReaderSettings } from './types';

/**
 * The HTML document a PageHost loads: theme as CSS variables, typography from the settings,
 * the column container the engine expects, and the bridge that turns engine events into
 * messages and host commands into engine calls. Works inside an iframe (web) or a WebView.
 */
export interface ReaderDocumentInput {
  bodyHtml: string;
  theme: Theme;
  settings: ReaderSettings;
  engineSource: string;
  /** Optional extra CSS the host wants inside the page (fonts, print tweaks). */
  extraCss?: string;
}

export type HostMessage =
  | { type: 'ready' }
  | { type: 'page'; page: number; count: number; offsetPct: number }
  | { type: 'tap'; zone: 'left' | 'center' | 'right' }
  | { type: 'edge'; direction: 'next' | 'prev' }
  | { type: 'key'; key: 'ArrowLeft' | 'ArrowRight' }
  | { type: 'selection'; action: 'copy' | 'share' | 'define'; text: string }
  | { type: 'error'; message: string };

export type HostCommand =
  | { cmd: 'next' }
  | { cmd: 'prev' }
  | { cmd: 'goTo'; page: number }
  | { cmd: 'goToPct'; pct: number }
  | { cmd: 'relayout' }
  | { cmd: 'setSettings'; vars: string }
  | { cmd: 'setBody'; bodyHtml: string };

const LINE_HEIGHTS = { 1: 1.5, 2: 1.8, 3: 2.1 } as const;
const MARGINS = { 1: 12, 2: 24, 3: 36 } as const;

export function themeVariables(theme: Theme, settings: ReaderSettings): string {
  const family = settings.fontFamily === 'serif' ? theme.fonts.serif : settings.fontFamily === 'sans' ? theme.fonts.sans : 'system-ui, sans-serif';
  return [
    `--bg: ${theme.colors.background}`,
    `--fg: ${theme.colors.text}`,
    `--muted: ${theme.colors.muted}`,
    `--accent: ${theme.colors.accent}`,
    `--font: ${family}`,
    `--size: ${settings.fontSize}px`,
    `--leading: ${LINE_HEIGHTS[settings.lineSpacing] ?? 1.8}`,
    `--margin: ${MARGINS[settings.margins] ?? 24}px`,
    `--align: ${settings.align === 'justify' ? 'justify' : 'left'}`,
    `--dim: ${Math.max(0, Math.min(1, 1 - settings.brightness))}`,
  ].join('; ');
}

export function buildReaderDocument(input: ReaderDocumentInput): string {
  const vars = themeVariables(input.theme, input.settings);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { ${vars}; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--fg); overflow: hidden; -webkit-text-size-adjust: 100%; }
  #container { position: absolute; inset: 0; overflow: hidden; }
  #column { height: 100%; box-sizing: border-box; padding-top: 1.5rem; padding-bottom: 1.5rem; font-family: var(--font); font-size: var(--size); line-height: var(--leading); text-align: var(--align); }
  /* Page margins live on the blocks, so each column fragment keeps them and pages stay exactly one width apart. */
  #column > * { margin-left: var(--margin); margin-right: var(--margin); }
  #column p, #column li, #column blockquote { text-align: var(--align); }
  #column h1, #column h2, #column h3 { text-align: center; }
  .mb-4 { margin-top: 0; margin-bottom: 1em; } .mb-1 { margin-bottom: 0.25em; }
  .text-3xl { font-size: 1.6em; } .text-2xl { font-size: 1.4em; } .text-xl { font-size: 1.2em; } .text-lg { font-size: 1.1em; }
  .font-bold { font-weight: 700; } .font-semibold { font-weight: 600; } .italic { font-style: italic; } .opacity-80 { opacity: .8; }
  .mt-8 { margin-top: 2em; } .mb-6 { margin-bottom: 1.5em; } .mt-6 { margin-top: 1.5em; } .mb-3 { margin-bottom: .75em; } .mt-4 { margin-top: 1em; } .mb-2 { margin-bottom: .5em; } .my-4 { margin-top: 1em; margin-bottom: 1em; } .my-8 { margin-top: 2em; margin-bottom: 2em; }
  .pl-4 { padding-left: 1em; } .pl-6 { padding-left: 1.5em; } .list-disc { list-style: disc; } .list-decimal { list-style: decimal; }
  .border-l-2 { border-left: 2px solid currentColor; opacity: .85; }
  #dim { position: absolute; inset: 0; background: black; opacity: var(--dim); pointer-events: none; }
  ${input.extraCss || ''}
</style></head>
<body>
<div id="container"><div id="column">${input.bodyHtml}</div></div>
<div id="dim"></div>
<script type="module">
${input.engineSource}
const post = (m) => {
  const s = JSON.stringify(m);
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(s);
  else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
};
const container = document.getElementById('container');
let engine;
try {
  engine = createPageEngine(container, {
    onPage: (page, count, offsetPct) => post({ type: 'page', page, count, offsetPct }),
    onTap: (zone) => post({ type: 'tap', zone }),
    onEdge: (direction) => post({ type: 'edge', direction }),
    keyboard: false,
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); post({ type: 'key', key: e.key }); }
  });
  engine.layout();
  post({ type: 'ready' });
} catch (e) { post({ type: 'error', message: String(e && e.message || e) }); }
window.engine = engine;
function apply(cmd) {
  if (!engine) return;
  switch (cmd.cmd) {
    case 'next': engine.next(); break;
    case 'prev': engine.prev(); break;
    case 'goTo': engine.goTo(cmd.page); break;
    case 'goToPct': engine.goToPct(cmd.pct); break;
    case 'relayout': engine.relayoutKeepingPosition(); break;
    case 'setSettings': document.documentElement.style.cssText = cmd.vars; engine.relayoutKeepingPosition(); break;
    case 'setBody': document.getElementById('column').innerHTML = cmd.bodyHtml; engine.layout(); break;
  }
}
window.__apply = apply;
window.addEventListener('message', (e) => { try { apply(typeof e.data === 'string' ? JSON.parse(e.data) : e.data); } catch {} });
document.addEventListener('message', (e) => { try { apply(JSON.parse(e.data)); } catch {} });
</script>
</body></html>`;
}
