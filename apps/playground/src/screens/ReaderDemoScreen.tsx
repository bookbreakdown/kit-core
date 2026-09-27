import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { parseBook, type BookDocument, type ReadingPosition } from '@libraryofages/kit-core';
import { Reader, type ReaderHandle } from '@libraryofages/reader';
import { loadFixture } from '../fixtures';
import type { RootStackParamList } from '../navigation';
import { makePositionStore, makeSettingsStore } from '../stores';
import { READER_THEMES } from '../themes';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TREASURE_ISLAND = require('../../assets/fixtures/treasure-island.md') as number;
const BOOK_ID = 'treasure-island';

type State =
  | { status: 'loading' }
  | { status: 'ready'; doc: BookDocument }
  | { status: 'error'; message: string };

type Props = NativeStackScreenProps<RootStackParamList, 'ReaderDemo'>;

/** Reader demo: the treasure-island fixture with the last chapter treated as back matter. */
export function ReaderDemoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [furthestOn, setFurthestOn] = useState(false);
  const [bookEnded, setBookEnded] = useState(false);
  const [chapterEnds, setChapterEnds] = useState<number[]>([]);
  const [position, setPosition] = useState<ReadingPosition | null>(null);
  const reader = useRef<ReaderHandle | null>(null);
  const settingsStore = useMemo(() => makeSettingsStore('playground'), []);
  const positionStore = useMemo(() => makePositionStore('playground'), []);

  useEffect(() => {
    let cancelled = false;
    loadFixture(TREASURE_ISLAND)
      .then((raw) => {
        if (cancelled) return;
        const parsed = parseBook(raw, 'Treasure Island');
        setState({ status: 'ready', doc: { ...parsed, finishChapterIndex: Math.max(0, parsed.chapters.length - 2) } });
      })
      .catch((e: unknown) => { if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) }); });
    return () => { cancelled = true; };
  }, []);

  if (state.status === 'loading') return <Text style={styles.status}>Loading fixture…</Text>;
  if (state.status === 'error') return <Text style={styles.status} testID="reader-demo-error">{state.message}</Text>;

  const { doc } = state;
  const furthest: ReadingPosition | null = furthestOn && position
    ? { chapterIndex: Math.min(doc.chapters.length - 1, position.chapterIndex + 2), offsetPct: 0, pageIndex: null }
    : furthestOn ? { chapterIndex: 2, offsetPct: 0, pageIndex: null } : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="reader-demo">
      <View style={styles.demoBar} testID="demo-bar">
        <Pressable onPress={() => navigation.goBack()} testID="demo-exit" accessibilityRole="button"><Text style={styles.demoText}>Exit</Text></Pressable>
        <Pressable onPress={() => setFurthestOn((v) => !v)} testID="demo-furthest" accessibilityRole="button" accessibilityState={{ checked: furthestOn }}>
          <Text style={styles.demoText}>Furthest: {furthestOn ? 'on' : 'off'}</Text>
        </Pressable>
        <Text style={styles.demoText} testID="demo-chapter-ends">ends: {chapterEnds.join(',') || '-'}</Text>
        {bookEnded ? <Text style={[styles.demoText, styles.bookEnd]} testID="demo-book-end">Book end</Text> : null}
      </View>
      <View style={styles.reader}>
        <Reader
          ref={reader}
          bookId={BOOK_ID}
          document={doc}
          themes={READER_THEMES}
          positionStore={positionStore}
          settingsStore={settingsStore}
          furthest={furthest}
          title={doc.title}
          onBack={() => navigation.goBack()}
          onPositionChange={setPosition}
          onChapterEnd={(i) => { setChapterEnds((prev) => [...prev, i]); if (i === doc.finishChapterIndex) setBookEnded(true); }}
          onBookEnd={() => setBookEnded(true)}
          renderNotice={() => <View style={styles.notice} testID="demo-notice"><Text style={styles.noticeText}>Demo notice: shown only with the chrome</Text></View>}
          insertPages={(i) => (i === 0 ? [
            <View key="host" style={styles.hostPage} testID="demo-host-page"><Text style={styles.hostPageText}>Host page</Text><Text style={styles.hostPageHint}>Tap or swipe forward to continue</Text></View>,
          ] : [])}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  status: { padding: 24, fontSize: 16 },
  demoBar: { height: 36, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12, backgroundColor: '#111' },
  demoText: { color: '#ddd', fontSize: 12 },
  bookEnd: { color: '#f59e0b', fontWeight: '700' },
  reader: { flex: 1 },
  notice: { backgroundColor: '#fde68a', padding: 8, alignItems: 'center' },
  noticeText: { color: '#3b2f1e', fontSize: 12 },
  hostPage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' },
  hostPageText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  hostPageHint: { color: '#cbd5e1', fontSize: 14, marginTop: 8 },
});
