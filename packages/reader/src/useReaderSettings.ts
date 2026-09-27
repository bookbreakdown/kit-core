import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReaderSettings, SettingsStore } from './types';

export const SETTINGS_KEY = 'reader.settings';

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'system',
  fontSize: 18,
  fontFamily: 'serif',
  lineSpacing: 2,
  margins: 2,
  align: 'left',
  brightness: 1,
  volumeKeysTurnPages: false,
};

export const FONT_SIZE_RANGE = { min: 12, max: 32, step: 1 } as const;
export const BRIGHTNESS_RANGE = { min: 0.3, max: 1, step: 0.1 } as const;

export function clampSettings(input: Partial<ReaderSettings>): ReaderSettings {
  const s = { ...DEFAULT_SETTINGS, ...input };
  s.fontSize = Math.max(FONT_SIZE_RANGE.min, Math.min(FONT_SIZE_RANGE.max, Math.round(s.fontSize)));
  s.brightness = Math.max(BRIGHTNESS_RANGE.min, Math.min(BRIGHTNESS_RANGE.max, Math.round(s.brightness * 10) / 10));
  return s;
}

/** Typography and theme settings, persisted as one JSON record in the host's store. */
export function useReaderSettings(store: SettingsStore) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    store.get(SETTINGS_KEY).then((raw) => {
      if (!alive.current) return;
      if (raw) {
        try { setSettings(clampSettings(JSON.parse(raw) as Partial<ReaderSettings>)); } catch { /* fall back to defaults */ }
      }
      setLoaded(true);
    }).catch(() => { if (alive.current) setLoaded(true); });
    return () => { alive.current = false; };
  }, [store]);

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = clampSettings({ ...prev, ...patch });
      void store.set(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, [store]);

  return { settings, update, loaded };
}
