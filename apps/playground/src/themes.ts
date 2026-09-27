import type { ReaderThemes } from '@libraryofages/reader';

/** The app owns its colours; the kit ships none. */
export const READER_THEMES: ReaderThemes = {
  light: { name: 'light', colors: { background: '#fffdf7', text: '#1f1f1f', muted: '#6b6b6b', accent: '#b45309', surface: '#ffffff', border: '#d9d4c7' }, fonts: { serif: 'Georgia, "Times New Roman", serif', sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' } },
  sepia: { name: 'sepia', colors: { background: '#f4ecd8', text: '#3b2f1e', muted: '#7a6a4f', accent: '#8a5a1a', surface: '#efe4cc', border: '#d8c9a8' }, fonts: { serif: 'Georgia, "Times New Roman", serif', sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' } },
  dark: { name: 'dark', colors: { background: '#121212', text: '#e6e6e6', muted: '#9a9a9a', accent: '#f59e0b', surface: '#1e1e1e', border: '#333333' }, fonts: { serif: 'Georgia, "Times New Roman", serif', sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' } },
};
