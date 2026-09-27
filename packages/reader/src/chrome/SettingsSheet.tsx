import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Theme } from '@libraryofages/kit-core';
import type { ReaderLabels, ReaderSettings } from '../types';
import { BRIGHTNESS_RANGE, FONT_SIZE_RANGE } from '../useReaderSettings';
import { Sheet } from './Sheet';
import { chromeColors } from './styles';

export interface SettingsSheetProps {
  theme: Theme;
  settings: ReaderSettings;
  labels: ReaderLabels;
  onChange(patch: Partial<ReaderSettings>): void;
  onClose(): void;
}

function Row({ label, children, color }: { label: string; children: React.ReactNode; color: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color }]}>{label}</Text>
      <View style={styles.controls}>{children}</View>
    </View>
  );
}

function Choice<T extends string | number>({ value, options, onPick, theme, testPrefix }: { value: T; options: { v: T; label: string }[]; onPick(v: T): void; theme: Theme; testPrefix: string }) {
  const c = chromeColors(theme);
  return (
    <View style={styles.choices}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <Pressable key={String(o.v)} onPress={() => onPick(o.v)} testID={`${testPrefix}-${o.v}`} accessibilityRole="button" aria-selected={active}
            style={[styles.chip, { borderColor: active ? c.accent : c.border, backgroundColor: active ? c.accent : c.page }]}>
            <Text style={{ color: active ? c.page : c.text, fontSize: 13, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stepper({ value, display, onDown, onUp, theme, testPrefix }: { value: number; display: string; onDown(): void; onUp(): void; theme: Theme; testPrefix: string }) {
  const c = chromeColors(theme);
  return (
    <View style={styles.choices}>
      <Pressable onPress={onDown} testID={`${testPrefix}-down`} accessibilityRole="button" style={[styles.chip, { borderColor: c.border, backgroundColor: c.page }]}><Text style={{ color: c.text, fontSize: 16 }}>−</Text></Pressable>
      <Text style={[styles.value, { color: c.text }]} testID={`${testPrefix}-value`} accessibilityValue={{ now: value }}>{display}</Text>
      <Pressable onPress={onUp} testID={`${testPrefix}-up`} accessibilityRole="button" style={[styles.chip, { borderColor: c.border, backgroundColor: c.page }]}><Text style={{ color: c.text, fontSize: 16 }}>+</Text></Pressable>
    </View>
  );
}

/** Every FR-READ-14 control; each change is applied live by the Reader through `setSettings`. */
export function SettingsSheet({ theme, settings, labels, onChange, onClose }: SettingsSheetProps) {
  const c = chromeColors(theme);
  return (
    <Sheet theme={theme} testID="reader-settings" onClose={onClose}>
      <Row label={labels.theme} color={c.muted}>
        <Choice theme={theme} testPrefix="settings-theme" value={settings.theme} onPick={(v) => onChange({ theme: v })}
          options={[{ v: 'light', label: 'Light' }, { v: 'sepia', label: 'Sepia' }, { v: 'dark', label: 'Dark' }, { v: 'system', label: 'System' }]} />
      </Row>
      <Row label={labels.fontSize} color={c.muted}>
        <Stepper theme={theme} testPrefix="settings-font" value={settings.fontSize} display={`${settings.fontSize}`}
          onDown={() => onChange({ fontSize: settings.fontSize - FONT_SIZE_RANGE.step })} onUp={() => onChange({ fontSize: settings.fontSize + FONT_SIZE_RANGE.step })} />
      </Row>
      <Row label={labels.font} color={c.muted}>
        <Choice theme={theme} testPrefix="settings-family" value={settings.fontFamily} onPick={(v) => onChange({ fontFamily: v })}
          options={[{ v: 'serif', label: 'Serif' }, { v: 'sans', label: 'Sans' }, { v: 'system', label: 'System' }]} />
      </Row>
      <Row label={labels.spacing} color={c.muted}>
        <Choice theme={theme} testPrefix="settings-spacing" value={settings.lineSpacing} onPick={(v) => onChange({ lineSpacing: v })}
          options={[{ v: 1 as const, label: '1' }, { v: 2 as const, label: '2' }, { v: 3 as const, label: '3' }]} />
      </Row>
      <Row label={labels.margins} color={c.muted}>
        <Choice theme={theme} testPrefix="settings-margins" value={settings.margins} onPick={(v) => onChange({ margins: v })}
          options={[{ v: 1 as const, label: '1' }, { v: 2 as const, label: '2' }, { v: 3 as const, label: '3' }]} />
      </Row>
      <Row label={labels.align} color={c.muted}>
        <Choice theme={theme} testPrefix="settings-align" value={settings.align} onPick={(v) => onChange({ align: v })}
          options={[{ v: 'left', label: 'Left' }, { v: 'justify', label: 'Justify' }]} />
      </Row>
      <Row label={labels.brightness} color={c.muted}>
        <Stepper theme={theme} testPrefix="settings-brightness" value={settings.brightness} display={`${Math.round(settings.brightness * 100)}%`}
          onDown={() => onChange({ brightness: settings.brightness - BRIGHTNESS_RANGE.step })} onUp={() => onChange({ brightness: settings.brightness + BRIGHTNESS_RANGE.step })} />
      </Row>
      <Row label={labels.volumeKeys} color={c.muted}>
        <Switch value={settings.volumeKeysTurnPages} onValueChange={(v) => onChange({ volumeKeysTurnPages: v })} testID="settings-volume-keys" />
      </Row>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  controls: { flexDirection: 'row', alignItems: 'center' },
  choices: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, minWidth: 36, alignItems: 'center' },
  value: { fontSize: 15, fontWeight: '600', minWidth: 44, textAlign: 'center' },
});
