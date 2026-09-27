import type { BookDocument, Chapter } from './types';
import { wordCount } from './format';

export class EmptyBookError extends Error {
  constructor() {
    super('Empty book text');
    this.name = 'EmptyBookError';
  }
}

/**
 * The three replacements the web reader applies before parsing
 * (resources/js/pages/ReaderPage.jsx), in the same order:
 *   1. strip ``` fences (with an optional language tag),
 *   2. strip leading whitespace on every line,
 *   3. drop a single leading `## ` heading line.
 */
export function preClean(raw: string): string {
  let md = raw;
  md = md.replace(/```\w*\n?/g, '');
  md = md.replace(/^[ \t]+/gm, '');
  md = md.replace(/^##\s[^\n]+\n+/, '');
  return md;
}

export interface RawChapter {
  title: string;
  content: string;
}

/** Port of the web `parseChapters()` in resources/js/lib/api.js. */
export function splitChapters(markdown: string): RawChapter[] {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const chapters: RawChapter[] = [];
  let current: RawChapter | null = null;

  for (const line of lines) {
    const match = line.match(/^###\s+(.+)/);
    if (match) {
      if (current) chapters.push(current);
      current = { title: match[1].trim(), content: '' };
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) chapters.push(current);

  return chapters.map((ch) => ({ ...ch, content: ch.content.trim() }));
}

export function parseBook(raw: string, fallbackTitle: string): BookDocument {
  if (!raw || !raw.trim()) throw new EmptyBookError();
  const md = preClean(raw);
  const parsed = splitChapters(md);
  const rawChapters: RawChapter[] =
    parsed.length > 0 ? parsed : [{ title: fallbackTitle, content: md }];

  const chapters: Chapter[] = rawChapters.map((ch, index) => ({
    index,
    title: ch.title,
    markdown: ch.content,
    wordCount: wordCount(ch.content),
  }));

  return { title: fallbackTitle, chapters, finishChapterIndex: null };
}
