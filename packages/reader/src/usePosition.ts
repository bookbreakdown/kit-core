import { useCallback, useEffect, useRef, useState } from 'react';
import type { PositionStore, ReadingPosition } from '@libraryofages/kit-core';

const SAVE_DEBOUNCE_MS = 2000;

/**
 * Restores the saved position once, then records every change: debounced two seconds,
 * flushed immediately on unmount. `restored` is undefined until the store has answered.
 */
export function usePosition(bookId: string, store: PositionStore, onChange?: (p: ReadingPosition) => void) {
  const [restored, setRestored] = useState<ReadingPosition | null | undefined>(undefined);
  const pending = useRef<ReadingPosition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let alive = true;
    setRestored(undefined);
    store.load(bookId).then((p) => { if (alive) setRestored(p ?? null); }).catch(() => { if (alive) setRestored(null); });
    return () => { alive = false; };
  }, [bookId, store]);

  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    void store.save(bookId, p);
  }, [bookId, store]);

  const record = useCallback((p: ReadingPosition) => {
    pending.current = p;
    onChangeRef.current?.(p);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => () => { flush(); }, [flush]);

  return { restored, record, flush };
}
