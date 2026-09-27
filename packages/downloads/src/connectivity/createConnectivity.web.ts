import type { ConnectionState, ConnectionType, Connectivity } from './Connectivity';

type NavConnection = { type?: string; addEventListener?(t: string, h: () => void): void; removeEventListener?(t: string, h: () => void): void };

function read(): ConnectionState {
  if (typeof navigator === 'undefined') return { online: true, type: 'unknown' };
  const conn = (navigator as Navigator & { connection?: NavConnection }).connection;
  const raw = conn?.type;
  const type: ConnectionType = raw === 'wifi' ? 'wifi' : raw === 'cellular' ? 'cellular' : raw === 'ethernet' ? 'ethernet' : raw === 'none' ? 'none' : raw ? 'other' : 'unknown';
  return { online: navigator.onLine !== false, type };
}

/** Web: navigator.onLine plus the Network Information API when the browser offers it. */
export function createConnectivity(): Connectivity {
  return {
    async current() { return read(); },
    subscribe(handler) {
      if (typeof window === 'undefined') return () => {};
      const fire = () => handler(read());
      window.addEventListener('online', fire);
      window.addEventListener('offline', fire);
      const conn = (navigator as Navigator & { connection?: NavConnection }).connection;
      conn?.addEventListener?.('change', fire);
      return () => { window.removeEventListener('online', fire); window.removeEventListener('offline', fire); conn?.removeEventListener?.('change', fire); };
    },
  };
}
