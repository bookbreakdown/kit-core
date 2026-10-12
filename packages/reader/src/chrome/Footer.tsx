import { Pressable, StyleSheet, Text } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { FOOTER_HEIGHT, chromeColors } from './styles';

export type FooterMode = 0 | 1 | 2;

export interface FooterProps {
  theme: Theme;
  /** Left side: time left in book, time left in chapter, or page in chapter (tap cycles). */
  text: string;
  /** Right side, always shown: percent through the book. */
  percent: string;
  bottomInset?: number;
  onCycle(): void;
}

/** The immersive one-line footer, laid out as Kindle's: "4 hrs 28 mins left in book" on the left, "1%" on the right. */
export function Footer({ theme, text, percent, bottomInset = 0, onCycle }: FooterProps) {
  const c = chromeColors(theme);
  return (
    <Pressable onPress={onCycle} style={[styles.footer, { bottom: bottomInset }]} testID="reader-footer" accessibilityRole="button">
      <Text style={[styles.text, { color: c.muted }]} numberOfLines={1} testID="reader-footer-text">{text}</Text>
      <Text style={[styles.text, { color: c.muted }]} testID="reader-footer-percent">{percent}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, height: FOOTER_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  text: { fontSize: 12 },
});
