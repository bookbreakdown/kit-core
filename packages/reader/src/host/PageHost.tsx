import { useCallback, useRef, type ComponentRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { HostMessage } from '../document';
import type { PageHostProps } from './types';

/** Android host: react-native-webview with the same JSON bridge. */
export function PageHost({ html, onMessage, hostRef, style, onSelection }: PageHostProps) {
  type WebViewRef = ComponentRef<typeof WebView>;
  const ref = useRef<WebViewRef | null>(null);

  const handleMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as HostMessage;
      onMessage(m);
    } catch {
      // ignore
    }
  }, [onMessage]);

  const setRef = useCallback((w: WebViewRef | null) => {
    ref.current = w;
    hostRef?.(w ? { send: (cmd) => w.injectJavaScript(`window.__apply(${JSON.stringify(cmd)}); true;`) } : null);
  }, [hostRef]);

  return (
    <WebView
      ref={setRef}
      source={{ html }}
      originWhitelist={['*']}
      onMessage={handleMessage}
      scrollEnabled={false}
      bounces={false}
      allowsLinkPreview={false}
      setSupportMultipleWindows={false}
      javaScriptEnabled
      domStorageEnabled={false}
      style={[{ flex: 1, backgroundColor: 'transparent' }, style as object]}
      menuItems={[{ label: 'Copy', key: 'copy' }, { label: 'Share', key: 'share' }, { label: 'Define', key: 'define' }]}
      onCustomMenuSelection={(e: { nativeEvent: { label: string; selectedText: string } }) => {
        const { label, selectedText } = e.nativeEvent;
        const action = (label || '').toLowerCase() as 'copy' | 'share' | 'define';
        onSelection?.(action, selectedText || '');
      }}
    />
  );
}
