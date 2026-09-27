import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatClock, type Theme } from '@libraryofages/kit-core';
import { usePlayer } from '../PlayerProvider';

/** The playlist's tracks; blocked ones show a lock and report through `onTrackBlocked` when tapped. */
export function ChapterList({ theme, onPicked }: { theme: Theme; onPicked?(): void }) {
  const p = usePlayer();
  if (!p.playlist) return null;
  return (
    <ScrollView testID="chapter-list" style={styles.list}>
      {p.playlist.tracks.map((t, i) => {
        const active = i === p.index;
        return (
          <Pressable key={t.id} onPress={() => { p.goTo(i); if (!t.blocked) onPicked?.(); }} testID={`chapter-${i}`} accessibilityRole="button" accessibilityState={{ selected: active, disabled: !!t.blocked }} style={[styles.row, { borderBottomColor: theme.colors.border }]}>
            <Text numberOfLines={1} style={[styles.title, { color: t.blocked ? theme.colors.muted : active ? theme.colors.accent : theme.colors.text, fontWeight: active ? '700' : '400' }]}>{t.title}</Text>
            <Text style={[styles.meta, { color: theme.colors.muted }]}>{t.blocked ? '🔒' : formatClock(t.durationSeconds)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 360 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 15 },
  meta: { fontSize: 12, marginLeft: 12 },
});
