import type { Theme } from '@libraryofages/kit-core';

/** Shared chrome styling derived from the active theme only. */
export function chromeColors(theme: Theme) {
  return {
    bar: theme.colors.surface,
    text: theme.colors.text,
    muted: theme.colors.muted,
    accent: theme.colors.accent,
    border: theme.colors.border,
    page: theme.colors.background,
  };
}

export const BAR_HEIGHT = 52;
export const FOOTER_HEIGHT = 28;
