import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DownloadsList, useDownloads } from '@libraryofages/downloads';
import type { Playlist } from '@libraryofages/kit-core';
import { usePlayer } from '@libraryofages/player';
import { fixtureManifest, type PolicyMode } from '../demoInfra';
import { demoConnectivity, demoPolicy } from '../Providers';
import { READER_THEMES } from '../themes';

const BOOK = 'treasure-island';

/** Downloads demo: fixture manifest, policy and connectivity toggles, offline read and play. */
export function DownloadsDemoScreen() {
  const d = useDownloads();
  const p = usePlayer();
  const [mode, setMode] = useState<PolicyMode>('valid');
  const [net, setNet] = useState<'wifi' | 'cellular'>('wifi');
  const [readLength, setReadLength] = useState<number | null>(null);
  const [playedFrom, setPlayedFrom] = useState<string>('-');

  const setPolicy = async (m: PolicyMode) => { demoPolicy.mode = m; setMode(m); await d.refreshValidity(); };
  const setNetwork = (t: 'wifi' | 'cellular') => { demoConnectivity.set(t); setNet(t); };
  const offlineRead = async () => { const t = await d.readText(BOOK); setReadLength(t ? t.length : -1); };
  const playOffline = async () => {
    const m = await fixtureManifest();
    const v = m.voices[0];
    const playlist: Playlist = { id: `${BOOK}:${v.voice}`, title: m.title, finishTrackIndex: m.finishChapterIndex, tracks: v.chapters.map((c, i) => ({ id: `${v.voice}-${c.chapterNumber}`, index: i, title: c.title, source: { kind: 'url', url: c.url }, durationSeconds: c.durationSeconds, backMatter: c.backMatter })) };
    const resolved = await d.resolveLocal(playlist.tracks[0].source);
    setPlayedFrom(resolved.kind === 'url' ? resolved.url : resolved.path);
    await p.load(playlist, { trackIndex: 0, positionSeconds: 0 });
    p.play();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} testID="downloads-demo">
      <Text style={styles.heading}>Downloads demo</Text>
      <View style={styles.row}>
        <Btn testID="demo-download-text" label="Download text" onPress={() => void d.downloadText(BOOK)} />
        <Btn testID="demo-download-audio" label="Download audio" onPress={() => void d.downloadAudio(BOOK, 'demo')} />
        <Btn testID="demo-offline-read" label="Offline read" onPress={() => void offlineRead()} />
        <Btn testID="demo-play-offline" label="Play offline" onPress={() => void playOffline()} />
      </View>
      <View style={styles.row}>
        {(['valid', 'lapsed', 'expired'] as PolicyMode[]).map((m) => <Btn key={m} testID={`demo-policy-${m}`} label={`Policy: ${m}${mode === m ? ' ✓' : ''}`} onPress={() => void setPolicy(m)} />)}
      </View>
      <View style={styles.row}>
        <Btn testID="demo-net-wifi" label={`Wi-Fi${net === 'wifi' ? ' ✓' : ''}`} onPress={() => setNetwork('wifi')} />
        <Btn testID="demo-net-cellular" label={`Cellular${net === 'cellular' ? ' ✓' : ''}`} onPress={() => setNetwork('cellular')} />
      </View>
      <Text testID="demo-read-length" style={styles.mono}>read length: {readLength === null ? '-' : readLength}</Text>
      <Text testID="demo-played-from" style={styles.mono}>played from: {playedFrom}</Text>
      <Text testID="demo-connection" style={styles.mono}>connection: {d.connection.type}</Text>
      <View style={styles.list}><DownloadsList theme={READER_THEMES.light} /></View>
    </ScrollView>
  );
}

function Btn({ label, onPress, testID }: { label: string; onPress(): void; testID: string }) {
  return <Pressable onPress={onPress} testID={testID} accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  heading: { fontSize: 24, fontWeight: '700' },
  mono: { fontFamily: 'monospace', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#222' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  list: { minHeight: 200 },
});
