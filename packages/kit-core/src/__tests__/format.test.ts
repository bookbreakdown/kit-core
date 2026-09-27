import { formatBytes, formatClock, wordCount } from '../format';

describe('formatClock (port of AudioPlayerBar.fmt)', () => {
  it.each([
    [NaN, '0:00'],
    [0, '0:00'],
    [59, '0:59'],
    [61, '1:01'],
    [3600, '1:00:00'],
    [3661, '1:01:01'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatClock(input)).toBe(expected);
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1572864, '1.5 MB'],
    [2469606195, '2.3 GB'],
  ])('formats %p as %p', (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe('wordCount', () => {
  it('is 0 for empty input', () => {
    expect(wordCount('')).toBe(0);
  });
  it('splits on any whitespace and ignores empties', () => {
    expect(wordCount('a  b\n\nc')).toBe(3);
  });
});
