import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { FOOTER_HEIGHT, chromeColors } from './styles';

export interface BottomBarProps {
  theme: Theme;
  /** Current position as percent of the book. */
  bookPct: number;
  /** Text for the bubble at a candidate percent. */
  describe(bookPct: number): string;
  onJump(bookPct: number): void;
  backLabel: string | null;
  onBack(): void;
}

/** Go-to slider by book percent with a live bubble, plus the "back to" pill after a jump. */
export function BottomBar({ theme, bookPct, describe, onJump, backLabel, onBack }: BottomBarProps) {
  const c = chromeColors(theme);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? bookPct;

  useEffect(() => { setDrag(null); }, [bookPct]);

  const pctFromEvent = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    return Math.max(0, Math.min(100, Math.round((x / Math.max(width, 1)) * 100)));
  };

  return (
    <View style={[styles.bar, { backgroundColor: c.bar, borderTopColor: c.border }]} testID="reader-bottombar">
      {backLabel ? (
        <Pressable onPress={onBack} style={[styles.pill, { borderColor: c.border, backgroundColor: c.page }]} testID="reader-back-pill" accessibilityRole="button">
          <Text style={[styles.pillText, { color: c.text }]}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <Text style={[styles.bubble, { color: c.text }]} testID="reader-goto-bubble">{describe(shown)}</Text>
      <View
        style={styles.trackHit}
        testID="reader-goto-track"
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setDrag(pctFromEvent(e))}
        onResponderMove={(e) => setDrag(pctFromEvent(e))}
        onResponderRelease={(e) => { const p = pctFromEvent(e); setDrag(null); onJump(p); }}
        onResponderTerminate={() => setDrag(null)}
      >
        <View style={[styles.track, { backgroundColor: c.border }]} pointerEvents="none">
          <View style={[styles.fill, { width: `${shown}%`, backgroundColor: c.accent }]} />
        </View>
        <View style={[styles.thumb, { left: `${shown}%`, backgroundColor: c.accent }]} pointerEvents="none" testID="reader-goto-thumb" />
      </View>
      <Text style={[styles.pct, { color: c.muted }]} testID="reader-goto-pct">{shown}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: FOOTER_HEIGHT, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  bubble: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 6 },
  trackHit: { height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  thumb: { position: 'absolute', top: 7, width: 18, height: 18, borderRadius: 9, marginLeft: -9 },
  pct: { fontSize: 11, textAlign: 'right', marginTop: 2 },
  pill: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
  pillText: { fontSize: 13, fontWeight: '600' },
});
