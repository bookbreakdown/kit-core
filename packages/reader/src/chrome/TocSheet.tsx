import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BookDocument, Theme } from '@libraryofages/kit-core';
import { Sheet } from './Sheet';
import { chromeColors } from './styles';

export interface TocSheetProps {
  theme: Theme;
  document: BookDocument;
  currentIndex: number;
  backMatterLabel: string;
  onPick(index: number): void;
  onClose(): void;
}

/** Chapter list; the current chapter is marked and back matter sits under a divider. */
export function TocSheet({ theme, document, currentIndex, backMatterLabel, onPick, onClose }: TocSheetProps) {
  const c = chromeColors(theme);
  const finish = document.finishChapterIndex;
  return (
    <Sheet theme={theme} testID="reader-toc" onClose={onClose}>
      {document.chapters.map((ch, i) => {
        const active = i === currentIndex;
        const divider = finish !== null && i === finish + 1;
        return (
          <Fragment key={ch.index}>
            {divider ? (
              <View style={[styles.divider, { borderTopColor: c.border }]} testID="reader-toc-backmatter">
                <Text style={[styles.dividerText, { color: c.muted }]}>{backMatterLabel}</Text>
              </View>
            ) : null}
            <Pressable onPress={() => onPick(i)} testID={`reader-toc-item-${i}`} accessibilityRole="button" aria-selected={active} style={styles.item}>
              <Text style={[styles.itemText, { color: active ? c.accent : c.text, fontWeight: active ? '700' : '400' }]} numberOfLines={2}>{ch.title}</Text>
            </Pressable>
          </Fragment>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 10 },
  itemText: { fontSize: 15 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 10 },
  dividerText: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
});
