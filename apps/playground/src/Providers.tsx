import { useMemo, useState, type ReactNode } from 'react';
import { DownloadsProvider, useDownloads } from '@libraryofages/downloads';
import { HtmlAudioEngine, PlayerProvider, createEngine } from '@libraryofages/player';
import { Platform } from 'react-native';
import { DemoConnectivity, fixtureManifest, policyFor, progressStore, type PolicyMode } from './demoInfra';
import { READER_THEMES } from './themes';

export const demoConnectivity = new DemoConnectivity();
export const demoPolicy: { mode: PolicyMode } = { mode: 'valid' };
export const demoProgress = progressStore('playground');
export const demoState: { playlistEnded: boolean; setEnded?: (v: boolean) => void } = { playlistEnded: false };

declare global { interface Window { __demoAudio?: HTMLAudioElement } }

function engineFactory() {
  if (Platform.OS === 'web') {
    return new HtmlAudioEngine(() => { const a = new Audio(); window.__demoAudio = a; return a; });
  }
  return createEngine();
}

function PlayerWithDownloads({ children }: { children: ReactNode }) {
  const d = useDownloads();
  const [, setEnded] = useState(false);
  demoState.setEnded = (v) => { demoState.playlistEnded = v; setEnded(v); };
  return (
    <PlayerProvider theme={READER_THEMES.light} progressStore={demoProgress} resolveSource={d.resolveLocal} engineFactory={engineFactory} onPlaylistEnd={() => demoState.setEnded?.(true)}>
      {children}
    </PlayerProvider>
  );
}

/** Downloads outside, player inside, so the player resolves local files through the downloads engine. */
export function Providers({ children }: { children: ReactNode }) {
  const policy = useMemo(() => policyFor(() => demoPolicy.mode), []);
  return (
    <DownloadsProvider theme={READER_THEMES.light} validityPolicy={policy} fetchManifest={() => fixtureManifest()} connectivity={demoConnectivity}>
      <PlayerWithDownloads>{children}</PlayerWithDownloads>
    </DownloadsProvider>
  );
}
