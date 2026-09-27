import { Pressable, StyleSheet, Text } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import { FOOTER_HEIGHT, chromeColors } from './styles';

export type FooterMode = 0 | 1 | 2;

export interface FooterProps {
  theme: Theme;
  text: string;
  onCycle(): void;
}

/** The immersive one-line footer: tap cycles page / percent / time-left. */
export function Footer({ theme, text, onCycle }: FooterProps) {
  const c = chromeColors(theme);
  return (
    <Pressable onPress={onCycle} style={styles.footer} testID="reader-footer" accessibilityRole="button">
      <Text style={[styles.text, { color: c.muted }]} testID="reader-footer-text">{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, height: FOOTER_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 12 },
});
