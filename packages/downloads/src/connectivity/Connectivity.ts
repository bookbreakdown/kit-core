export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'other' | 'none' | 'unknown';
export interface ConnectionState { online: boolean; type: ConnectionType }

export interface Connectivity {
  current(): Promise<ConnectionState>;
  subscribe(handler: (state: ConnectionState) => void): () => void;
}

/** Wi-Fi-only treats ethernet as fine and the unknown type as Wi-Fi (browsers rarely say). */
export function allowsLargeTransfer(state: ConnectionState): boolean {
  return state.online && state.type !== 'cellular';
}
