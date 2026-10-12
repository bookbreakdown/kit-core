import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import type { ReaderAction } from '../types';
import { BAR_HEIGHT, chromeColors } from './styles';

export interface TopBarProps {
  theme: Theme;
  title: string;
  labels: { back: string; contents: string; settings: string };
  onBack?(): void;
  onToc(): void;
  onSettings(): void;
  topInset?: number;
  actions?: ReaderAction[];
}

export function TopBar({ theme, title, labels, onBack, onToc, onSettings, topInset = 0, actions = [] }: TopBarProps) {
  const c = chromeColors(theme);
  return (
    <View style={[styles.bar, { backgroundColor: c.bar, borderBottomColor: c.border, paddingTop: topInset, height: BAR_HEIGHT + topInset }]} testID="reader-topbar">
      <Pressable onPress={onBack} disabled={!onBack} style={styles.button} testID="reader-back" accessibilityRole="button" accessibilityLabel={labels.back}>
        <Text style={[styles.icon, { color: onBack ? c.text : c.muted }]}>‹</Text>
      </Pressable>
      <Text numberOfLines={1} style={[styles.title, { color: c.text }]} testID="reader-title">{title}</Text>
      {actions.map((a) => (
        <Pressable key={a.key} onPress={a.onPress} style={[styles.action, { borderColor: a.active ? c.accent : c.border }]} testID={`reader-action-${a.key}`} accessibilityRole="button" accessibilityLabel={a.label} accessibilityState={{ selected: !!a.active }}>
          <Text style={[styles.actionText, { color: a.active ? c.accent : c.text }]} numberOfLines={1}>{a.label}</Text>
        </Pressable>
      ))}
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
  action: { height: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2 },
  actionText: { fontSize: 13, fontWeight: '600' },
  title: { flex: 1, fontSize: 15, fontWeight: '600', marginHorizontal: 4 },
});
