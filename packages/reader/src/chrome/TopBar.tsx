import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { BAR_HEIGHT, chromeColors } from './styles';

export interface TopBarProps {
  theme: Theme;
  title: string;
  labels: { back: string; contents: string; settings: string };
  onBack?(): void;
  onToc(): void;
  onSettings(): void;
}

export function TopBar({ theme, title, labels, onBack, onToc, onSettings }: TopBarProps) {
  const c = chromeColors(theme);
  return (
    <View style={[styles.bar, { backgroundColor: c.bar, borderBottomColor: c.border }]} testID="reader-topbar">
      <Pressable onPress={onBack} disabled={!onBack} style={styles.button} testID="reader-back" accessibilityRole="button" accessibilityLabel={labels.back}>
        <Text style={[styles.icon, { color: onBack ? c.text : c.muted }]}>‹</Text>
      </Pressable>
      <Text numberOfLines={1} style={[styles.title, { color: c.text }]} testID="reader-title">{title}</Text>
      <Pressable onPress={onToc} style={styles.button} testID="reader-toc-button" accessibilityRole="button" accessibilityLabel={labels.contents}>
        <Text style={[styles.icon, { color: c.text }]}>☰</Text>
      </Pressable>
      <Pressable onPress={onSettings} style={styles.button} testID="reader-settings-button" accessibilityRole="button" accessibilityLabel={labels.settings}>
        <Text style={[styles.aa, { color: c.text }]}>{labels.settings}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, height: BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 26, lineHeight: 30 },
  aa: { fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 15, fontWeight: '600', marginHorizontal: 4 },
});
