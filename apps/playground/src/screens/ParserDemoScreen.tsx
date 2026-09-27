import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { parseBook, type BookDocument } from '@libraryofages/kit-core';
import { loadFixture } from '../fixtures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TREASURE_ISLAND = require('../../assets/fixtures/treasure-island.md') as number;

type State =
  | { status: 'loading' }
  | { status: 'ready'; doc: BookDocument }
  | { status: 'error'; message: string };

export function ParserDemoScreen() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadFixture(TREASURE_ISLAND)
      .then((raw) => {
        if (!cancelled) setState({ status: 'ready', doc: parseBook(raw, 'Treasure Island') });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') return <Text style={styles.status}>Loading fixture…</Text>;
  if (state.status === 'error') return <Text style={styles.status} testID="parser-error">{state.message}</Text>;

  const { doc } = state;
  return (
    <View style={styles.container} testID="parser-demo">
      <Text style={styles.heading} testID="chapter-count">{doc.chapters.length} chapters</Text>
      <FlatList
        data={doc.chapters}
        keyExtractor={(c) => String(c.index)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.words}>{item.wordCount} words</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  status: { padding: 24, fontSize: 16 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 16, flex: 1 },
  words: { fontSize: 14, color: '#666', marginLeft: 12 },
});
