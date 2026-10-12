import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { usePlayerOptional } from '../PlayerProvider';
import { JUMP_SECONDS } from '../types';
import { PauseGlyph, PlayGlyph } from './Glyphs';

/**
 * The strip above the tab bar (Audible style): artwork, chapter and book, back 15, play/pause; tap to expand.
 * `listeningControls` (the reader, where the player shares the screen with the page) adds speed and a
 * Chapters button that opens the full player on its chapter list.
 */
export function MiniPlayer({ theme, listeningControls = false }: { theme: Theme; listeningControls?: boolean }) {
  const p = usePlayerOptional();
  if (!p || !p.playlist || !p.loaded || p.expanded) return null;
  const c = theme.colors;
  const track = p.playlist.tracks[p.index];
  const pct = p.durationSeconds > 0 ? Math.min(100, (p.positionSeconds / p.durationSeconds) * 100) : 0;
  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderTopColor: c.border }]} testID="mini-player">
      <View style={[styles.progress, { backgroundColor: c.border }]}><View style={[styles.fill, { width: `${pct}%`, backgroundColor: c.accent }]} /></View>
      <View style={styles.row}>
        <Pressable onPress={() => p.setExpanded(true)} testID="mini-expand" accessibilityRole="button" accessibilityLabel="Open player" style={styles.expand}>
          {track?.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.art} /> : <View style={[styles.art, { backgroundColor: c.border }]} />}
          <View style={styles.titles}>
            <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{track?.title ?? ''}</Text>
            <Text numberOfLines={1} style={[styles.sub, { color: c.muted }]}>{p.playlist.title}</Text>
          </View>
        </Pressable>
        {listeningControls ? (
          <>
            <Pressable onPress={p.cycleRate} testID="mini-speed" accessibilityRole="button" accessibilityLabel={`Speed ${p.rate}×`} style={[styles.chip, { borderColor: c.border }]}><Text style={[styles.chipText, { color: c.text }]}>{p.rate}×</Text></Pressable>
            <Pressable onPress={() => p.setExpanded(true, 'chapters')} testID="mini-chapters" accessibilityRole="button" style={[styles.chip, { borderColor: c.border }]}><Text style={[styles.chipText, { color: c.text }]}>Chapters</Text></Pressable>
          </>
        ) : null}
        <Pressable onPress={() => p.jump(-JUMP_SECONDS)} testID="mini-back15" accessibilityRole="button" accessibilityLabel={`Back ${JUMP_SECONDS} seconds`} style={styles.button}>
          <Text style={[styles.jump, { color: c.text }]}>−{JUMP_SECONDS}</Text>
        </Pressable>
        <Pressable onPress={p.toggle} testID="mini-toggle" accessibilityRole="button" accessibilityLabel={p.playing ? 'Pause' : 'Play'} style={[styles.play, { backgroundColor: c.accent }]}>
          {p.playing ? <PauseGlyph size={16} color={c.background} /> : <PlayGlyph size={16} color={c.background} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  progress: { height: 2 },
  fill: { height: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 10, height: 60, gap: 6 },
  expand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: '100%' },
  art: { width: 40, height: 40, borderRadius: 6 },
  titles: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12, marginTop: 2 },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  jump: { fontSize: 14, fontWeight: '700' },
  chip: { paddingHorizontal: 10, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  play: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
