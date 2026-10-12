import { View } from 'react-native';

/**
 * Player icons drawn with plain Views: text glyphs (▶ ❚❚ ⌄ ⏮) render differently per device font
 * (some as emoji), and the kit carries no icon library.
 */
export function PlayGlyph({ size, color }: { size: number; color: string }) {
  const h = size * 0.9;
  return <View style={{ width: 0, height: 0, marginLeft: size * 0.12, borderTopWidth: h / 2, borderBottomWidth: h / 2, borderLeftWidth: h * 0.85, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color }} />;
}

export function PauseGlyph({ size, color }: { size: number; color: string }) {
  const bar = { width: size * 0.26, height: size * 0.85, borderRadius: size * 0.06, backgroundColor: color };
  return <View style={{ flexDirection: 'row', gap: size * 0.2 }}><View style={bar} /><View style={bar} /></View>;
}

/** Two strokes meeting at a point, rotated: a chevron (down) or a cross (close). */
function Strokes({ size, color, angles, chevron }: { size: number; color: string; angles: [number, number]; chevron?: boolean }) {
  const len = chevron ? size * 0.62 : size * 0.9;
  const t = Math.max(2, size * 0.11);
  const offset = chevron ? len * 0.3 : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: len, height: t, borderRadius: t / 2, backgroundColor: color, transform: [{ translateX: -offset }, { rotate: `${angles[0]}deg` }] }} />
      <View style={{ position: 'absolute', width: len, height: t, borderRadius: t / 2, backgroundColor: color, transform: [{ translateX: offset }, { rotate: `${angles[1]}deg` }] }} />
    </View>
  );
}

export function ChevronDownGlyph({ size, color }: { size: number; color: string }) {
  return <Strokes size={size} color={color} angles={[40, -40]} chevron />;
}

export function CloseGlyph({ size, color }: { size: number; color: string }) {
  return <Strokes size={size} color={color} angles={[45, -45]} />;
}

/** Previous/next chapter: a bar beside a triangle. */
export function SkipGlyph({ size, color, direction }: { size: number; color: string; direction: 'prev' | 'next' }) {
  const h = size * 0.75;
  const tri = <View style={{ width: 0, height: 0, borderTopWidth: h / 2, borderBottomWidth: h / 2, borderTopColor: 'transparent', borderBottomColor: 'transparent', ...(direction === 'next' ? { borderLeftWidth: h * 0.8, borderLeftColor: color } : { borderRightWidth: h * 0.8, borderRightColor: color }) }} />;
  const bar = <View style={{ width: size * 0.13, height: h, borderRadius: 1, backgroundColor: color }} />;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>{direction === 'next' ? <>{tri}{bar}</> : <>{bar}{tri}</>}</View>;
}
