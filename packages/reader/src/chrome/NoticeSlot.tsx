import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BAR_HEIGHT } from './styles';

/** Host notices render here, under the top bar, and only while chrome is shown — never over the page. */
export function NoticeSlot({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <View style={styles.slot} testID="reader-notice" pointerEvents="box-none">{children}</View>;
}

const styles = StyleSheet.create({ slot: { position: 'absolute', top: BAR_HEIGHT, left: 0, right: 0 } });
