import { addEventListener, fetch as netInfoFetch } from '@react-native-community/netinfo';
import type { ConnectionState, ConnectionType, Connectivity } from './Connectivity';

function map(type: string, connected: boolean | null): ConnectionState {
  const t: ConnectionType = type === 'wifi' ? 'wifi' : type === 'cellular' ? 'cellular' : type === 'ethernet' ? 'ethernet' : type === 'none' ? 'none' : type === 'unknown' ? 'unknown' : 'other';
  return { online: connected !== false && t !== 'none', type: t };
}

/** Android: @react-native-community/netinfo. */
export function createConnectivity(): Connectivity {
  return {
    async current() { const s = await netInfoFetch(); return map(s.type, s.isConnected); },
    subscribe(handler) { return addEventListener((s) => handler(map(s.type, s.isConnected))); },
  };
}
