import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { formatClock, type Theme } from '@libraryofages/kit-core';
import { usePlayer } from '../PlayerProvider';
import { JUMP_SECONDS, SPEEDS } from '../types';
import { ChapterList } from './ChapterList';

const SLEEP_OPTIONS: Array<{ label: string; value: number | 'end-of-chapter' | null }> = [
  { label: '15 min', value: 15 }, { label: '30 min', value: 30 }, { label: '45 min', value: 45 }, { label: '60 min', value: 60 }, { label: 'End of chapter', value: 'end-of-chapter' }, { label: 'Off', value: null },
];

function Seek({ theme }: { theme: Theme }) {
  const p = usePlayer();
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const pct = drag ?? (p.durationSeconds > 0 ? Math.min(1, p.positionSeconds / p.durationSeconds) : 0);
  const at = (e: GestureResponderEvent) => Math.max(0, Math.min(1, e.nativeEvent.locationX / Math.max(1, width)));
  return (
    <View>
      <View
        style={styles.seekHit}
        testID="seek-track"
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setDrag(at(e))}
        onResponderMove={(e) => setDrag(at(e))}
        onResponderRelease={(e) => { const f = at(e); setDrag(null); p.seek(f * p.durationSeconds); }}
        onResponderTerminate={() => setDrag(null)}
      >
        <View style={[styles.seekTrack, { backgroundColor: theme.colors.border }]} pointerEvents="none"><View style={[styles.seekFill, { width: `${pct * 100}%`, backgroundColor: theme.colors.accent }]} /></View>
        <View style={[styles.thumb, { left: `${pct * 100}%`, backgroundColor: theme.colors.accent }]} pointerEvents="none" />
      </View>
      <View style={styles.times}>
        <Text style={[styles.time, { color: theme.colors.muted }]} testID="time-elapsed">{formatClock(p.positionSeconds)}</Text>
        <Text style={[styles.time, { color: theme.colors.muted }]} testID="time-remaining">-{formatClock(Math.max(0, p.durationSeconds - p.positionSeconds))}</Text>
      </View>
    </View>
  );
}

/** The full player: artwork, title, seek, ±15, prev/next, speed, sleep timer, chapters, voices. */
export function FullPlayerSheet({ theme }: { theme: Theme }) {
  const p = usePlayer();
  const [panel, setPanel] = useState<null | 'chapters' | 'sleep' | 'voices'>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  // A panel left open (e.g. after a refused chapter) must not survive a collapse.
  useEffect(() => { if (!p.expanded) setPanel(null); }, [p.expanded]);
  if (!p.playlist || !p.expanded) return null;
  const track = p.playlist.tracks[p.index];
  const c = theme.colors;
  const sleepLabel = p.sleepTimer.setting === null ? 'Sleep' : p.sleepTimer.setting === 'end-of-chapter' ? 'End of chapter' : formatClock(Math.max(0, Math.round(((p.sleepTimer.endsAt ?? now) - now) / 1000)));
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background }]} testID="full-player">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.top}>
          <Pressable onPress={() => p.setExpanded(false)} testID="player-collapse" accessibilityRole="button" style={styles.iconButton}><Text style={[styles.icon, { color: c.text }]}>⌄</Text></Pressable>
          <Text numberOfLines={1} style={[styles.book, { color: c.muted }]}>{p.playlist.title}</Text>
          <Pressable onPress={() => void p.close()} testID="player-close" accessibilityRole="button" style={styles.iconButton}><Text style={[styles.icon, { color: c.text }]}>✕</Text></Pressable>
        </View>
        {track?.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.art} /> : <View style={[styles.art, { backgroundColor: c.surface }]} />}
        <Text numberOfLines={2} style={[styles.title, { color: c.text }]} testID="player-title">{track?.title ?? ''}</Text>
        {p.blockedIndex !== null ? <Text style={[styles.blocked, { color: c.accent }]} testID="player-blocked">This chapter is not available</Text> : null}
        <Seek theme={theme} />
        <View style={styles.controls}>
          <Pressable onPress={p.skipPrev} testID="player-prev" accessibilityRole="button" style={styles.iconButton}><Text style={[styles.icon, { color: c.text }]}>⏮</Text></Pressable>
          <Pressable onPress={() => p.jump(-JUMP_SECONDS)} testID="player-back15" accessibilityRole="button" style={styles.iconButton}><Text style={[styles.small, { color: c.text }]}>−15</Text></Pressable>
          <Pressable onPress={p.toggle} testID="player-toggle" accessibilityRole="button" accessibilityState={{ selected: p.playing }} style={[styles.play, { backgroundColor: c.accent }]}><Text style={[styles.playIcon, { color: c.background }]}>{p.playing ? '❚❚' : '▶'}</Text></Pressable>
          <Pressable onPress={() => p.jump(JUMP_SECONDS)} testID="player-fwd15" accessibilityRole="button" style={styles.iconButton}><Text style={[styles.small, { color: c.text }]}>+15</Text></Pressable>
          <Pressable onPress={p.skipNext} testID="player-next" accessibilityRole="button" style={styles.iconButton}><Text style={[styles.icon, { color: c.text }]}>⏭</Text></Pressable>
        </View>
        <View style={styles.secondary}>
          <Pressable onPress={p.cycleRate} testID="player-speed" accessibilityRole="button" style={[styles.chip, { borderColor: c.border }]}><Text style={{ color: c.text, fontWeight: '600' }}>{p.rate}×</Text></Pressable>
          <Pressable onPress={() => setPanel(panel === 'sleep' ? null : 'sleep')} testID="player-sleep" accessibilityRole="button" style={[styles.chip, { borderColor: c.border }]}><Text style={{ color: p.sleepTimer.setting === null ? c.text : c.accent, fontWeight: '600' }}>{sleepLabel}</Text></Pressable>
          <Pressable onPress={() => setPanel(panel === 'chapters' ? null : 'chapters')} testID="player-chapters" accessibilityRole="button" style={[styles.chip, { borderColor: c.border }]}><Text style={{ color: c.text, fontWeight: '600' }}>Chapters</Text></Pressable>
          {p.voices.length > 0 ? <Pressable onPress={() => setPanel(panel === 'voices' ? null : 'voices')} testID="player-voices" accessibilityRole="button" style={[styles.chip, { borderColor: c.border }]}><Text style={{ color: c.text, fontWeight: '600' }}>Narrator</Text></Pressable> : null}
        </View>
        {panel === 'sleep' ? (
          <View style={styles.panel} testID="sleep-menu">
            {SLEEP_OPTIONS.map((o) => (
              <Pressable key={o.label} onPress={() => { p.setSleepTimer(o.value); setPanel(null); }} testID={`sleep-${String(o.value)}`} accessibilityRole="button" style={[styles.option, { borderBottomColor: c.border }]}>
                <Text style={{ color: o.value === p.sleepTimer.setting ? c.accent : c.text }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {panel === 'chapters' ? <ChapterList theme={theme} onPicked={() => setPanel(null)} /> : null}
        {panel === 'voices' ? (
          <View style={styles.panel} testID="voice-menu">
            {p.voices.map((v) => (
              <Pressable key={v.id} onPress={() => { p.switchVoice(v.id); setPanel(null); }} testID={`voice-${v.id}`} accessibilityRole="button" style={[styles.option, { borderBottomColor: c.border }]}><Text style={{ color: c.text }}>{v.label}</Text></Pressable>
            ))}
          </View>
        ) : null}
        {SPEEDS.length ? null : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  top: { flexDirection: 'row', alignItems: 'center' },
  book: { flex: 1, textAlign: 'center', fontSize: 13 },
  art: { width: 220, height: 220, borderRadius: 12, alignSelf: 'center' },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  blocked: { textAlign: 'center', fontSize: 13 },
  seekHit: { height: 32, justifyContent: 'center' },
  seekTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  seekFill: { height: 4 },
  thumb: { position: 'absolute', top: 7, width: 18, height: 18, borderRadius: 9, marginLeft: -9 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 24 },
  small: { fontSize: 14, fontWeight: '600' },
  play: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  playIcon: { fontSize: 26 },
  secondary: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  panel: { marginTop: 4 },
  option: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
