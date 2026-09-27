import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { ENGINE_SOURCE, type ReadingPosition } from '@libraryofages/kit-core';
import { bookPercent, formatDuration, locate, wordOffsets } from './bookMath';
import { buildReaderDocument, themeVariables, type HostMessage } from './document';
import { PageHost as DefaultPageHost } from './host';
import type { PageHostHandle } from './host/types';
import { DEFAULT_LABELS } from './labels';
import type { ReaderHandle, ReaderLabels, ReaderProps } from './types';
import { useChapterHtml } from './useChapterHtml';
import { usePosition } from './usePosition';
import { useReaderSettings } from './useReaderSettings';
import { minutesFor, useReadingSpeed } from './useReadingSpeed';
import { BottomBar } from './chrome/BottomBar';
import { Footer, type FooterMode } from './chrome/Footer';
import { FurthestPrompt } from './chrome/FurthestPrompt';
import { InsertPage } from './chrome/InsertPage';
import { NoticeSlot } from './chrome/NoticeSlot';
import { SettingsSheet } from './chrome/SettingsSheet';
import { TocSheet } from './chrome/TocSheet';
import { TopBar } from './chrome/TopBar';

const LAST_PAGE = 1e9;
type Pending = { page?: number; pct?: number } | null;
type Sheet = null | 'toc' | 'settings';

export function furthestDismissedKey(bookId: string): string {
  return `reader.furthest-dismissed.${bookId}`;
}

/**
 * Kindle-feel reader: immersive page host, centre-tap chrome, footer modes, go-to and back,
 * TOC, settings applied live, furthest-position prompt, host insert pages, finish callbacks.
 */
export const Reader = forwardRef<ReaderHandle, ReaderProps>(function Reader(props, ref) {
  const {
    bookId, document, themes, positionStore, settingsStore, furthest = null, title, onBack,
    onPositionChange, onChapterChange, onChapterEnd, onBookEnd, onSelection, renderNotice, renderLocked, insertPages,
    hostComponent,
  } = props;
  const labels: ReaderLabels = useMemo(() => ({ ...DEFAULT_LABELS, ...(props.labels ?? {}) }), [props.labels]);
  const PageHost = hostComponent ?? DefaultPageHost;
  const scheme = useColorScheme();
  const { settings, update: updateSettings, loaded: settingsLoaded } = useReaderSettings(settingsStore);
  const { wpm, sample } = useReadingSpeed(settingsStore);
  const { restored, record } = usePosition(bookId, positionStore, onPositionChange);
  const chapterCount = document.chapters.length;

  const theme = settings.theme === 'system' ? (scheme === 'dark' ? themes.dark : themes.light) : themes[settings.theme];

  const [chapterIndex, setChapterIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);
  const [offsetPct, setOffsetPct] = useState(0);
  const [chrome, setChrome] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [footerMode, setFooterMode] = useState<FooterMode>(0);
  const [backTarget, setBackTarget] = useState<{ chapterIndex: number; page: number } | null>(null);
  const [insert, setInsert] = useState<{ chapter: number; k: number } | null>(null);
  const [started, setStarted] = useState(false);
  const [furthestDismissed, setFurthestDismissed] = useState<string | null | undefined>(undefined);

  const pending = useRef<Pending>(null);
  const host = useRef<PageHostHandle | null>(null);
  const hostReady = useRef(false);
  const bookEnded = useRef(false);
  const shownInserts = useRef(new Set<number>());
  const lastTurnAt = useRef<number | null>(null);
  const state = useRef({ chapterIndex, page, count, offsetPct });
  state.current = { chapterIndex, page, count, offsetPct };

  const htmlFor = useChapterHtml(document, chapterIndex);
  const words = useMemo(() => wordOffsets(document), [document]);

  // --- restore ------------------------------------------------------------------------
  useEffect(() => {
    if (started || restored === undefined || !settingsLoaded) return;
    if (restored && restored.chapterIndex >= 0 && restored.chapterIndex < chapterCount) {
      setChapterIndex(restored.chapterIndex);
      pending.current = restored.pageIndex !== null && restored.pageIndex !== undefined ? { page: restored.pageIndex } : { pct: restored.offsetPct };
    }
    setStarted(true);
  }, [restored, settingsLoaded, started, chapterCount]);

  useEffect(() => {
    let alive = true;
    settingsStore.get(furthestDismissedKey(bookId)).then((v) => { if (alive) setFurthestDismissed(v); }).catch(() => { if (alive) setFurthestDismissed(null); });
    return () => { alive = false; };
  }, [bookId, settingsStore]);

  // --- document per chapter (settings applied live, not by rebuilding) ------------------
  const settingsAtMount = useRef(settings);
  const themeAtMount = useRef(theme);
  const html = useMemo(() => {
    settingsAtMount.current = settings;
    themeAtMount.current = theme;
    return buildReaderDocument({ bodyHtml: htmlFor(chapterIndex), theme, settings, engineSource: ENGINE_SOURCE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIndex, htmlFor, started]);

  useEffect(() => {
    if (!hostReady.current) return;
    if (settings === settingsAtMount.current && theme === themeAtMount.current) return;
    host.current?.send({ cmd: 'setSettings', vars: themeVariables(theme, settings) });
  }, [settings, theme]);

  // --- navigation -----------------------------------------------------------------------
  const goChapter = useCallback((index: number, target: Pending) => {
    if (index < 0 || index >= chapterCount) return;
    hostReady.current = false;
    pending.current = target;
    shownInserts.current.delete(index);
    setInsert(null);
    setSheet(null);
    setChapterIndex(index);
    setPage(0);
    setOffsetPct(0);
    onChapterChange?.(index);
  }, [chapterCount, onChapterChange]);

  const rememberBack = useCallback(() => {
    setBackTarget({ chapterIndex: state.current.chapterIndex, page: state.current.page });
  }, []);

  const jumpTo = useCallback((index: number, offsetPctTarget: number, hideChrome = true) => {
    rememberBack();
    if (hideChrome) setChrome(false);
    if (index === state.current.chapterIndex) host.current?.send({ cmd: 'goToPct', pct: offsetPctTarget });
    else goChapter(index, { pct: offsetPctTarget });
  }, [goChapter, rememberBack]);

  const advanceChapter = useCallback(() => {
    const i = state.current.chapterIndex;
    onChapterEnd?.(i);
    if (i + 1 < chapterCount) {
      setBackTarget(null);
      goChapter(i + 1, { page: 0 });
    } else if (!bookEnded.current) {
      bookEnded.current = true;
      onBookEnd?.();
    }
  }, [chapterCount, goChapter, onChapterEnd, onBookEnd]);

  const crossForward = useCallback(() => {
    setChrome(false);
    setSheet(null);
    const i = state.current.chapterIndex;
    const pages = insertPages?.(i) ?? [];
    if (pages.length > 0 && !shownInserts.current.has(i)) {
      setInsert({ chapter: i, k: 0 });
      return;
    }
    advanceChapter();
  }, [advanceChapter, insertPages]);

  const crossBack = useCallback(() => {
    setChrome(false);
    setSheet(null);
    const i = state.current.chapterIndex;
    if (i > 0) { setBackTarget(null); goChapter(i - 1, { page: LAST_PAGE }); }
  }, [goChapter]);

  const turn = useCallback((direction: 'next' | 'prev') => {
    setChrome(false);
    setSheet(null);
    const { page: p, count: n } = state.current;
    if (direction === 'next') { if (p >= n - 1) crossForward(); else host.current?.send({ cmd: 'next' }); }
    else if (p <= 0) crossBack(); else host.current?.send({ cmd: 'prev' });
  }, [crossBack, crossForward]);

  // --- host messages --------------------------------------------------------------------
  const handleMessage = useCallback((m: HostMessage) => {
    switch (m.type) {
      case 'ready': {
        hostReady.current = true;
        const t = pending.current;
        pending.current = null;
        if (t?.page !== undefined) host.current?.send({ cmd: 'goTo', page: t.page });
        else if (t?.pct !== undefined) host.current?.send({ cmd: 'goToPct', pct: t.pct });
        if (settings !== settingsAtMount.current || theme !== themeAtMount.current) host.current?.send({ cmd: 'setSettings', vars: themeVariables(theme, settings) });
        break;
      }
      case 'page': {
        const prev = state.current;
        const now = Date.now();
        if (m.page === prev.page + 1 && m.count === prev.count && lastTurnAt.current !== null) {
          sample((document.chapters[prev.chapterIndex]?.wordCount ?? 0) / Math.max(m.count, 1), (now - lastTurnAt.current) / 1000);
        }
        lastTurnAt.current = now;
        setPage(m.page);
        setCount(m.count);
        setOffsetPct(m.offsetPct);
        record({ chapterIndex: prev.chapterIndex, offsetPct: m.offsetPct, pageIndex: m.page });
        break;
      }
      case 'tap':
        if (m.zone === 'center') { setChrome((c) => !c); setSheet(null); }
        else { setChrome(false); setSheet(null); }
        break;
      case 'edge':
        if (m.direction === 'next') crossForward(); else crossBack();
        break;
      case 'key':
        turn(m.key === 'ArrowRight' ? 'next' : 'prev');
        break;
      case 'selection':
        onSelection?.(m.action, m.text);
        break;
      case 'error':
        break;
      default:
        break;
    }
  }, [crossBack, crossForward, document, onSelection, record, sample, settings, theme, turn]);
  const handleMessageRef = useRef(handleMessage);
  handleMessageRef.current = handleMessage;
  const onMessage = useCallback((m: HostMessage) => { handleMessageRef.current(m); }, []);

  // The host may re-register its handle on re-render; readiness is reset only by a chapter change.
  const hostRef = useCallback((h: PageHostHandle | null) => { if (h) host.current = h; }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); turn('next'); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); turn('prev'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [turn]);

  // --- handle ---------------------------------------------------------------------------
  useImperativeHandle(ref, () => ({
    goToChapter: (index, pct = 0) => jumpTo(index, pct),
    goToPct: (bookPct) => { const t = locate(document, bookPct); jumpTo(t.chapterIndex, t.offsetPct); },
    toggleChrome: () => setChrome((c) => !c),
    onVolumeKey: (direction) => { if (settings.volumeKeysTurnPages) turn(direction === 'down' ? 'next' : 'prev'); },
  }), [document, jumpTo, settings.volumeKeysTurnPages, turn]);

  // --- derived text ---------------------------------------------------------------------
  const chapter = document.chapters[chapterIndex];
  const bookPct = bookPercent(document, chapterIndex, offsetPct);
  const wordsPerPage = (chapter?.wordCount ?? 0) / Math.max(count, 1);
  const pagesLeft = Math.max(0, count - page - 1);
  const chapterMinutes = minutesFor(pagesLeft * wordsPerPage, wpm);
  const bookMinutes = minutesFor(pagesLeft * wordsPerPage + (words.total - (words.before[chapterIndex] ?? 0) - (chapter?.wordCount ?? 0)), wpm);
  const footerText = footerMode === 0
    ? `${page + 1} of ${count} ${labels.inChapter}`
    : footerMode === 1
      ? `${bookPct}% ${labels.ofBook}`
      : `${formatDuration(chapterMinutes, labels)} ${labels.leftInChapter} · ${formatDuration(bookMinutes, labels)} ${labels.leftInBook}`;

  const describe = useCallback((pct: number) => {
    const t = locate(document, pct);
    if (t.chapterIndex === state.current.chapterIndex) {
      const p = state.current.count <= 1 ? 1 : Math.round((t.offsetPct / 100) * (state.current.count - 1)) + 1;
      return `${labels.chapter} ${t.chapterIndex + 1} · ${labels.page} ${p}`;
    }
    return `${labels.chapter} ${t.chapterIndex + 1} · ${t.offsetPct}%`;
  }, [document, labels]);

  const furthestBeyond = !!furthest && started && furthestDismissed !== undefined
    && (furthest.chapterIndex > chapterIndex || (furthest.chapterIndex === chapterIndex && furthest.offsetPct > offsetPct + 2))
    && furthestDismissed !== JSON.stringify([furthest.chapterIndex, furthest.offsetPct]);

  const dismissFurthest = useCallback(() => {
    if (!furthest) return;
    const v = JSON.stringify([furthest.chapterIndex, furthest.offsetPct]);
    setFurthestDismissed(v);
    void settingsStore.set(furthestDismissedKey(bookId), v);
  }, [bookId, furthest, settingsStore]);

  const locked = renderLocked?.();
  const insertNodes = insert ? (insertPages?.(insert.chapter) ?? []) : [];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]} testID="reader" accessibilityState={{ expanded: chrome }}>
      {started && !locked ? (
        <View style={styles.host} testID="reader-host-slot">
          <PageHost key={`${bookId}:${chapterIndex}`} html={html} onMessage={onMessage} hostRef={hostRef} onSelection={onSelection} />
        </View>
      ) : null}
      {locked ? <View style={styles.host} testID="reader-locked">{locked}</View> : null}

      {insert && insertNodes[insert.k] ? (
        <InsertPage
          onForward={() => {
            if (insert.k + 1 < insertNodes.length) setInsert({ chapter: insert.chapter, k: insert.k + 1 });
            else { shownInserts.current.add(insert.chapter); setInsert(null); advanceChapter(); }
          }}
          onBackward={() => { if (insert.k > 0) setInsert({ chapter: insert.chapter, k: insert.k - 1 }); else setInsert(null); }}
        >
          {insertNodes[insert.k]}
        </InsertPage>
      ) : null}

      {!insert ? <Footer theme={theme} text={footerText} onCycle={() => setFooterMode((m) => ((m + 1) % 3) as FooterMode)} /> : null}

      {chrome && !insert ? (
        <>
          <TopBar theme={theme} title={title ?? document.title} labels={labels} onBack={onBack} onToc={() => setSheet('toc')} onSettings={() => setSheet('settings')} />
          <NoticeSlot>{renderNotice?.()}</NoticeSlot>
          <BottomBar
            theme={theme}
            bookPct={bookPct}
            describe={describe}
            onJump={(pct) => { const t = locate(document, pct); jumpTo(t.chapterIndex, t.offsetPct, false); }}
            backLabel={backTarget ? `${labels.backTo} ${labels.chapter} ${backTarget.chapterIndex + 1} · ${labels.page} ${backTarget.page + 1}` : null}
            onBack={() => {
              if (!backTarget) return;
              const t = backTarget;
              setBackTarget(null);
              if (t.chapterIndex === state.current.chapterIndex) host.current?.send({ cmd: 'goTo', page: t.page });
              else goChapter(t.chapterIndex, { page: t.page });
            }}
          />
        </>
      ) : null}

      {furthestBeyond && !insert && furthest ? (
        <FurthestPrompt
          theme={theme}
          title={labels.furthestTitle}
          body={labels.furthestBody}
          goLabel={labels.go}
          dismissLabel={labels.dismiss}
          onGo={() => { dismissFurthest(); jumpTo(furthest.chapterIndex, furthest.offsetPct); }}
          onDismiss={dismissFurthest}
        />
      ) : null}

      {sheet === 'toc' ? (
        <TocSheet theme={theme} document={document} currentIndex={chapterIndex} backMatterLabel={labels.backMatter} onPick={(i) => jumpTo(i, 0)} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === 'settings' ? (
        <SettingsSheet theme={theme} settings={settings} labels={labels} onChange={updateSettings} onClose={() => setSheet(null)} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  host: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
