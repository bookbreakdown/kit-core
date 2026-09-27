import { createRef, useEffect } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { BookDocument, PositionStore, ReadingPosition } from '@libraryofages/kit-core';
import { Reader } from '../Reader';
import type { HostMessage } from '../document';
import type { PageHostHandle, PageHostProps } from '../host/types';
import type { ReaderHandle, ReaderThemes, SettingsStore } from '../types';

// --- fakes ----------------------------------------------------------------------------
const hostApi: { onMessage: ((m: HostMessage) => void) | null; sent: unknown[]; mounts: number } = { onMessage: null, sent: [], mounts: 0 };

function FakeHost({ onMessage, hostRef }: PageHostProps) {
  hostApi.onMessage = onMessage;
  useEffect(() => {
    hostApi.mounts += 1;
    const handle: PageHostHandle = { send: (cmd) => { hostApi.sent.push(cmd); } };
    hostRef?.(handle);
    return () => { hostRef?.(null); };
  }, [hostRef]);
  return <Text testID="fake-host">host</Text>;
}

function memorySettings(initial: Record<string, string> = {}): SettingsStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, get: async (k) => data.get(k) ?? null, set: async (k, v) => { data.set(k, v); } };
}

function memoryPositions(initial: ReadingPosition | null = null): PositionStore & { saved: ReadingPosition[] } {
  const saved: ReadingPosition[] = [];
  return { saved, load: async () => initial, save: async (_id, p) => { saved.push(p); } };
}

const theme = (name: string) => ({ name, colors: { background: `bg-${name}`, text: `t-${name}`, muted: `m-${name}`, accent: `a-${name}`, surface: `s-${name}`, border: `b-${name}` }, fonts: { serif: 'serif', sans: 'sans' } });
const themes: ReaderThemes = { light: theme('light'), sepia: theme('sepia'), dark: theme('dark') };

const document: BookDocument = {
  title: 'Three',
  chapters: [
    { index: 0, title: 'One', markdown: '### One\n\n' + 'alpha '.repeat(400), wordCount: 401 },
    { index: 1, title: 'Two', markdown: '### Two\n\n' + 'beta '.repeat(400), wordCount: 401 },
    { index: 2, title: 'Notes', markdown: '### Notes\n\n' + 'gamma '.repeat(100), wordCount: 101 },
  ],
  finishChapterIndex: 1,
};

const msg = (m: HostMessage) => act(() => { hostApi.onMessage?.(m); });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const ready = async () => { await settle(); await waitFor(() => expect(hostApi.onMessage).not.toBeNull()); msg({ type: 'ready' }); };

beforeEach(() => { hostApi.onMessage = null; hostApi.sent = []; hostApi.mounts = 0; });

function mount(extra: Partial<React.ComponentProps<typeof Reader>> = {}, settings = memorySettings(), positions = memoryPositions()) {
  const ref = createRef<ReaderHandle>();
  const utils = render(
    <Reader ref={ref} bookId="b1" document={document} themes={themes} positionStore={positions} settingsStore={settings} hostComponent={FakeHost} {...extra} />,
  );
  return { ...utils, ref, settings, positions };
}

// --- tests ----------------------------------------------------------------------------
test('footer shows "2 of 5 in chapter" after page messages, and cycles modes on tap', async () => {
  const { getByTestId } = mount();
  await ready();
  msg({ type: 'page', page: 1, count: 5, offsetPct: 25 });
  expect(getByTestId('reader-footer-text').props.children).toBe('2 of 5 in chapter');
  fireEvent.press(getByTestId('reader-footer'));
  expect(getByTestId('reader-footer-text').props.children).toBe('11% of book');
  fireEvent.press(getByTestId('reader-footer'));
  expect(String(getByTestId('reader-footer-text').props.children)).toMatch(/^about \d+ min left in chapter · about \d+ min left in book$/);
});

test('chrome is hidden by default; a centre tap shows the top bar; a right tap hides it', async () => {
  const { queryByTestId, getByTestId } = mount();
  await ready();
  expect(queryByTestId('reader-topbar')).toBeNull();
  msg({ type: 'tap', zone: 'center' });
  expect(getByTestId('reader-topbar')).toBeTruthy();
  expect(getByTestId('reader-bottombar')).toBeTruthy();
  msg({ type: 'tap', zone: 'right' });
  expect(queryByTestId('reader-topbar')).toBeNull();
});

test('crossing the last page moves to the next chapter (onChapterEnd) and onBookEnd fires exactly once', async () => {
  const onChapterEnd = jest.fn();
  const onBookEnd = jest.fn();
  const onChapterChange = jest.fn();
  const { getByTestId } = mount({ onChapterEnd, onBookEnd, onChapterChange });
  await ready();
  msg({ type: 'page', page: 4, count: 5, offsetPct: 100 });
  msg({ type: 'edge', direction: 'next' });
  expect(onChapterEnd).toHaveBeenCalledWith(0);
  expect(onChapterChange).toHaveBeenCalledWith(1);
  await waitFor(() => expect(hostApi.mounts).toBe(2));
  msg({ type: 'ready' });
  expect(hostApi.sent).toContainEqual({ cmd: 'goTo', page: 0 });
  msg({ type: 'page', page: 0, count: 3, offsetPct: 0 });
  expect(getByTestId('reader-footer-text').props.children).toBe('1 of 3 in chapter');
  // back-crossing lands on the previous chapter's last page
  msg({ type: 'edge', direction: 'prev' });
  await waitFor(() => expect(hostApi.mounts).toBe(3));
  msg({ type: 'ready' });
  expect(hostApi.sent[hostApi.sent.length - 1]).toEqual({ cmd: 'goTo', page: 1e9 });
  // to the end of the book
  msg({ type: 'page', page: 4, count: 5, offsetPct: 100 });
  msg({ type: 'edge', direction: 'next' });
  await waitFor(() => expect(hostApi.mounts).toBe(4));
  msg({ type: 'ready' });
  msg({ type: 'page', page: 2, count: 3, offsetPct: 100 });
  msg({ type: 'edge', direction: 'next' });
  await waitFor(() => expect(hostApi.mounts).toBe(5));
  msg({ type: 'ready' });
  msg({ type: 'page', page: 1, count: 2, offsetPct: 100 });
  msg({ type: 'edge', direction: 'next' });
  msg({ type: 'edge', direction: 'next' });
  expect(onBookEnd).toHaveBeenCalledTimes(1);
  expect(onChapterEnd).toHaveBeenLastCalledWith(2);
});

test('settings persist through the store and are applied live to the host', async () => {
  const { getByTestId, settings } = mount();
  await ready();
  msg({ type: 'tap', zone: 'center' });
  fireEvent.press(getByTestId('reader-settings-button'));
  fireEvent.press(getByTestId('settings-font-up'));
  await waitFor(() => expect(settings.data.get('reader.settings')).toContain('"fontSize":19'));
  fireEvent.press(getByTestId('settings-theme-dark'));
  await waitFor(() => expect(settings.data.get('reader.settings')).toContain('"theme":"dark"'));
  const last = hostApi.sent[hostApi.sent.length - 1] as { cmd: string; vars: string };
  expect(last.cmd).toBe('setSettings');
  expect(last.vars).toContain('--size: 19px');
  expect(last.vars).toContain('--bg: bg-dark');
  expect(getByTestId('reader').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: 'bg-dark' })]));
});

test('restore: a saved page index is applied on ready; positions are recorded from page messages', async () => {
  const positions = memoryPositions({ chapterIndex: 1, offsetPct: 50, pageIndex: 3 });
  const onPositionChange = jest.fn();
  const { getByTestId } = mount({ onPositionChange }, memorySettings(), positions);
  await ready();
  expect(hostApi.sent).toContainEqual({ cmd: 'goTo', page: 3 });
  msg({ type: 'page', page: 3, count: 6, offsetPct: 60 });
  expect(onPositionChange).toHaveBeenCalledWith({ chapterIndex: 1, offsetPct: 60, pageIndex: 3 });
  expect(getByTestId('reader-footer-text').props.children).toBe('4 of 6 in chapter');
});

test('the furthest prompt renders when ahead, Go jumps there, and a dismissal is remembered', async () => {
  const settings = memorySettings();
  const furthest = { chapterIndex: 2, offsetPct: 0, pageIndex: null };
  const first = mount({ furthest }, settings);
  await ready();
  msg({ type: 'page', page: 0, count: 5, offsetPct: 0 });
  await waitFor(() => expect(first.getByTestId('furthest-prompt')).toBeTruthy());
  fireEvent.press(first.getByTestId('furthest-dismiss'));
  expect(first.queryByTestId('furthest-prompt')).toBeNull();
  await waitFor(() => expect(settings.data.get('reader.furthest-dismissed.b1')).toBe('[2,0]'));
  first.unmount();

  hostApi.onMessage = null;
  const second = mount({ furthest }, settings);
  await ready();
  msg({ type: 'page', page: 0, count: 5, offsetPct: 0 });
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  expect(second.queryByTestId('furthest-prompt')).toBeNull();
  second.unmount();

  hostApi.onMessage = null;
  const third = mount({ furthest: { chapterIndex: 2, offsetPct: 40, pageIndex: null }, onChapterChange: jest.fn() }, settings);
  await ready();
  msg({ type: 'page', page: 0, count: 5, offsetPct: 0 });
  await waitFor(() => expect(third.getByTestId('furthest-prompt')).toBeTruthy());
  fireEvent.press(third.getByTestId('furthest-go'));
  await waitFor(() => expect(hostApi.mounts).toBe(4));
  msg({ type: 'ready' });
  expect(hostApi.sent[hostApi.sent.length - 1]).toEqual({ cmd: 'goToPct', pct: 40 });
  expect(third.queryByTestId('reader-topbar')).toBeNull();
  msg({ type: 'tap', zone: 'center' });
  expect(third.getByTestId('reader-back-pill')).toBeTruthy();
});

test('TOC marks back matter after finishChapterIndex and jumps; insert pages show between chapters; locked replaces the host', async () => {
  const insertPages = (i: number) => (i === 0 ? [<Text key="ad" testID="host-page">Host page</Text>] : []);
  const { getByTestId, queryByTestId, rerender } = mount({ insertPages });
  await ready();
  msg({ type: 'tap', zone: 'center' });
  fireEvent.press(getByTestId('reader-toc-button'));
  expect(getByTestId('reader-toc-backmatter')).toBeTruthy();
  const item0 = getByTestId('reader-toc-item-0').props;
  expect(item0['aria-selected'] === true || item0.accessibilityState?.selected === true).toBe(true);
  fireEvent.press(getByTestId('reader-toc-item-1'));
  await waitFor(() => expect(hostApi.mounts).toBe(2));
  msg({ type: 'ready' });
  expect(hostApi.sent[hostApi.sent.length - 1]).toEqual({ cmd: 'goToPct', pct: 0 });
  // back to chapter 0 and past its end: the host page appears, then chapter 1
  msg({ type: 'page', page: 0, count: 3, offsetPct: 0 });
  msg({ type: 'edge', direction: 'prev' });
  await waitFor(() => expect(hostApi.mounts).toBe(3));
  msg({ type: 'ready' });
  msg({ type: 'page', page: 2, count: 3, offsetPct: 100 });
  msg({ type: 'edge', direction: 'next' });
  expect(getByTestId('host-page')).toBeTruthy();
  expect(hostApi.mounts).toBe(3);
  fireEvent(getByTestId('reader-insert-page'), 'responderRelease', { nativeEvent: { pageX: 300, pageY: 10, locationX: 300 } });
  await waitFor(() => expect(hostApi.mounts).toBe(4));
  expect(queryByTestId('host-page')).toBeNull();
  rerender(<Reader bookId="b1" document={document} themes={themes} positionStore={memoryPositions()} settingsStore={memorySettings()} hostComponent={FakeHost} renderLocked={() => <Text testID="locked">Locked</Text>} />);
  await settle();
  expect(getByTestId('locked')).toBeTruthy();
  expect(queryByTestId('fake-host')).toBeNull();
});

test('volume keys turn pages only when enabled; the handle exposes goToPct by book percent', async () => {
  const settings = memorySettings({ 'reader.settings': JSON.stringify({ volumeKeysTurnPages: true }) });
  const { ref } = mount({}, settings);
  await ready();
  msg({ type: 'page', page: 1, count: 5, offsetPct: 25 });
  act(() => ref.current!.onVolumeKey('down'));
  expect(hostApi.sent[hostApi.sent.length - 1]).toEqual({ cmd: 'next' });
  act(() => ref.current!.onVolumeKey('up'));
  expect(hostApi.sent[hostApi.sent.length - 1]).toEqual({ cmd: 'prev' });
  act(() => ref.current!.goToPct(60));
  await waitFor(() => expect(hostApi.mounts).toBe(2));
  msg({ type: 'ready' });
  const last = hostApi.sent[hostApi.sent.length - 1] as { cmd: string; pct: number };
  expect(last.cmd).toBe('goToPct');
  expect(last.pct).toBeGreaterThan(0);
});
