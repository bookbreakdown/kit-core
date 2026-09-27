import { useEffect, useRef } from 'react';
import type { HostMessage } from '../document';
import type { PageHostProps } from './types';

/** Web host: a sandboxed iframe with srcdoc and a postMessage bridge. */
export function PageHost({ html, onMessage, hostRef, style }: PageHostProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const hostRefRef = useRef(hostRef);
  hostRefRef.current = hostRef;

  useEffect(() => {
    const el = frame.current;
    if (!el) return undefined;
    const handler = (e: MessageEvent) => {
      if (e.source !== el.contentWindow) return;
      try {
        const m = (typeof e.data === 'string' ? JSON.parse(e.data) : e.data) as HostMessage;
        if (m && typeof m === 'object' && 'type' in m) onMessageRef.current(m);
      } catch {
        // not ours
      }
    };
    window.addEventListener('message', handler);
    hostRefRef.current?.({ send: (cmd) => el.contentWindow?.postMessage(JSON.stringify(cmd), '*') });
    return () => {
      window.removeEventListener('message', handler);
      hostRefRef.current?.(null);
    };
  }, []);

  // Expo web renders through react-dom, so a DOM iframe is a legal child here.
  return (
    <iframe
      ref={frame}
      srcDoc={html}
      sandbox="allow-scripts"
      title="reader"
      data-testid="reader-host"
      style={{ border: 0, width: '100%', height: '100%', display: 'block', background: 'transparent', ...(style as object) }}
    />
  );
}
