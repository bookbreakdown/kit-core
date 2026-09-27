import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { chromeColors } from './styles';

/** A bottom sheet drawn inside the reader (no Modal so it works identically under test and on web). */
export function Sheet({ theme, testID, onClose, children }: { theme: Theme; testID: string; onClose(): void; children: ReactNode }) {
  const c = chromeColors(theme);
  return (
    <View style={StyleSheet.absoluteFill} testID={testID}>
      <Pressable style={styles.scrim} onPress={onClose} testID={`${testID}-scrim`} accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: c.bar, borderTopColor: c.border }]}>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { maxHeight: '70%', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderTopWidth: StyleSheet.hairlineWidth },
  content: { padding: 16, gap: 12 },
});
