import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmptyBookError, parseBook, preClean, splitChapters } from '../parse-book';

const FIXTURES = join(__dirname, '..', '..', 'fixtures');
const SLUGS = [
  'treasure-island',
  '1-enoch',
  '1-esdras',
  'baled-hay-a-drier-book-than-walt-whitman-s-leaves-o-grass',
  '1-enoch-a-summary',
];

function fixture(slug: string): string {
  return readFileSync(join(FIXTURES, `${slug}.md`), 'utf8');
}
function expected(slug: string): { chapters: { title: string; content: string }[] } {
  return JSON.parse(readFileSync(join(FIXTURES, 'expected', `${slug}.json`), 'utf8'));
}

describe('splitChapters(preClean()) equals the web reader output', () => {
  it.each(SLUGS)('%s', (slug) => {
    const got = splitChapters(preClean(fixture(slug)));
    const want = expected(slug).chapters;
    // eslint-disable-next-line no-console
    console.log(`${slug}: ${got.length} chapters (expected file: ${want.length})`);
    expect(got).toEqual(want);
  });
});

describe('parseBook', () => {
  it('falls back to a single chapter titled with the fallback when there are no headings', () => {
    const doc = parseBook(fixture('1-enoch-a-summary'), 'Summary Title');
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].title).toBe('Summary Title');
    expect(doc.chapters[0].index).toBe(0);
    expect(doc.chapters[0].wordCount).toBeGreaterThan(0);
  });

  it('throws EmptyBookError on whitespace-only input', () => {
    expect(() => parseBook('   ', 'x')).toThrow(EmptyBookError);
  });

  it('reports the expected chapter count and positive word counts for treasure-island', () => {
    const doc = parseBook(fixture('treasure-island'), 'Treasure Island');
    expect(doc.chapters).toHaveLength(expected('treasure-island').chapters.length);
    for (const ch of doc.chapters) expect(ch.wordCount).toBeGreaterThan(0);
    expect(doc.chapters.map((c) => c.index)).toEqual(doc.chapters.map((_, i) => i));
    expect(doc.finishChapterIndex).toBeNull();
  });
});
