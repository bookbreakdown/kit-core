import { useCallback, useEffect, useRef } from 'react';
import type { BookDocument } from '@libraryofages/kit-core';
import { renderChapterHtml } from './markdown';

/** Memoised chapter HTML; the chapter after the current one is rendered ahead of time. */
export function useChapterHtml(document: BookDocument, currentIndex: number) {
  const cache = useRef(new Map<number, string>());
  const docRef = useRef(document);
  if (docRef.current !== document) {
    docRef.current = document;
    cache.current = new Map();
  }

  const htmlFor = useCallback((index: number): string => {
    const hit = cache.current.get(index);
    if (hit !== undefined) return hit;
    const chapter = document.chapters[index];
    const html = chapter ? renderChapterHtml(chapter.markdown) : '';
    cache.current.set(index, html);
    return html;
  }, [document]);

  useEffect(() => {
    if (currentIndex + 1 >= document.chapters.length) return undefined;
    const id = setTimeout(() => { htmlFor(currentIndex + 1); }, 50);
    return () => clearTimeout(id);
  }, [currentIndex, document, htmlFor]);

  return htmlFor;
}
