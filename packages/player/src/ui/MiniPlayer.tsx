import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { usePlayerOptional } from '../PlayerProvider';

/** The strip at the bottom: play/pause, title, thin progress; tap to expand. */
export function MiniPlayer({ theme }: { theme: Theme }) {
  const p = usePlayerOptional();
  if (!p || !p.playlist || !p.loaded || p.expanded) return null;
  const track = p.playlist.tracks[p.index];
  const pct = p.durationSeconds > 0 ? Math.min(100, (p.positionSeconds / p.durationSeconds) * 100) : 0;
  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]} testID="mini-player">
      <View style={[styles.progress, { backgroundColor: theme.colors.border }]}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.colors.accent }]} /></View>
      <View style={styles.row}>
        <Pressable onPress={p.toggle} testID="mini-toggle" accessibilityRole="button" style={styles.button}><Text style={[styles.icon, { color: theme.colors.text }]}>{p.playing ? '❚❚' : '▶'}</Text></Pressable>
        <Pressable onPress={() => p.setExpanded(true)} testID="mini-expand" accessibilityRole="button" style={styles.titles}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>{track?.title ?? ''}</Text>
          <Text numberOfLines={1} style={[styles.sub, { color: theme.colors.muted }]}>{p.playlist.title}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  progress: { height: 2 },
  fill: { height: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 56 },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 18 },
  titles: { flex: 1, marginLeft: 4 },
  title: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
});
