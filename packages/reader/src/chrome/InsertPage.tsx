import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

export interface InsertPageProps {
  children: ReactNode;
  onForward(): void;
  onBackward(): void;
}

/** A host-provided full-screen page between chapters: forward tap/swipe continues, left-third tap or right swipe goes back. */
export function InsertPage({ children, onForward, onBackward }: InsertPageProps) {
  const [width, setWidth] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <View
      style={StyleSheet.absoluteFill}
      testID="reader-insert-page"
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(e: GestureResponderEvent) => { start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }; }}
      onResponderRelease={(e: GestureResponderEvent) => {
        const s = start.current;
        start.current = null;
        const dx = s ? e.nativeEvent.pageX - s.x : 0;
        const dy = s ? e.nativeEvent.pageY - s.y : 0;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx > 0) onBackward(); else onForward(); return; }
        if (width > 0 && e.nativeEvent.locationX < width / 3) onBackward(); else onForward();
      }}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">{children}</View>
    </View>
  );
}
