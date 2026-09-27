export const PACKAGE = { name: '@libraryofages/kit-core', version: '0.0.3' } as const;

export * from './types';
export { formatBytes, formatClock, wordCount } from './format';
export { EmptyBookError, parseBook, preClean, splitChapters } from './parse-book';
export type { RawChapter } from './parse-book';
export { ENGINE_SOURCE } from './page-engine/engine-source';
export type { PageEngine, PageEngineOptions, TapZone } from '../page-engine/engine';
