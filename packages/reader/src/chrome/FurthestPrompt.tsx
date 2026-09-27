import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { chromeColors } from './styles';

export interface FurthestPromptProps {
  theme: Theme;
  title: string;
  body: string;
  goLabel: string;
  dismissLabel: string;
  onGo(): void;
  onDismiss(): void;
}

export function FurthestPrompt({ theme, title, body, goLabel, dismissLabel, onGo, onDismiss }: FurthestPromptProps) {
  const c = chromeColors(theme);
  return (
    <View style={[styles.card, { backgroundColor: c.bar, borderColor: c.border }]} testID="furthest-prompt">
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={[styles.body, { color: c.muted }]}>{body}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onDismiss} testID="furthest-dismiss" accessibilityRole="button" style={[styles.button, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '600' }}>{dismissLabel}</Text>
        </Pressable>
        <Pressable onPress={onGo} testID="furthest-go" accessibilityRole="button" style={[styles.button, { borderColor: c.accent, backgroundColor: c.accent }]}>
          <Text style={{ color: c.page, fontWeight: '600' }}>{goLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 16, right: 16, bottom: 44, padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  button: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
});
