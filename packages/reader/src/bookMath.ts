import type { BookDocument } from '@libraryofages/kit-core';

/** Cumulative word counts so book percent and time-left can be computed without the DOM. */
export function wordOffsets(document: BookDocument): { before: number[]; total: number } {
  const before: number[] = [];
  let sum = 0;
  for (const c of document.chapters) { before.push(sum); sum += Math.max(0, c.wordCount); }
  return { before, total: sum };
}

export function bookPercent(document: BookDocument, chapterIndex: number, offsetPct: number): number {
  const { before, total } = wordOffsets(document);
  if (total <= 0) return 0;
  const chapter = document.chapters[chapterIndex];
  const words = (before[chapterIndex] ?? 0) + (chapter ? chapter.wordCount * (offsetPct / 100) : 0);
  return Math.max(0, Math.min(100, Math.round((words / total) * 100)));
}

/** Inverse of bookPercent: the chapter and in-chapter percent a book percent lands on. */
export function locate(document: BookDocument, bookPct: number): { chapterIndex: number; offsetPct: number } {
  const { before, total } = wordOffsets(document);
  const n = document.chapters.length;
  if (n === 0) return { chapterIndex: 0, offsetPct: 0 };
  const target = (Math.max(0, Math.min(100, bookPct)) / 100) * total;
  for (let i = 0; i < n; i += 1) {
    const wc = document.chapters[i].wordCount;
    const end = before[i] + wc;
    if (target <= end || i === n - 1) {
      const within = wc > 0 ? ((target - before[i]) / wc) * 100 : 0;
      return { chapterIndex: i, offsetPct: Math.max(0, Math.min(100, Math.round(within))) };
    }
  }
  return { chapterIndex: n - 1, offsetPct: 100 };
}

export function formatDuration(minutes: number, l: { about: string; lessThanAMinute: string; hourShort: string; minuteShort: string }): string {
  if (minutes < 1) return l.lessThanAMinute;
  const m = Math.round(minutes);
  if (m < 60) return `${l.about} ${m} ${l.minuteShort}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${l.about} ${h} ${l.hourShort}` : `${l.about} ${h} ${l.hourShort} ${rest} ${l.minuteShort}`;
}
