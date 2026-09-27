import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Playlist, Track } from '@libraryofages/kit-core';
import { usePlayer } from '@libraryofages/player';
import { assetUri } from '../demoInfra';
import { demoProgress, demoState } from '../Providers';

const PLAYLIST_ID = 'tones';

function tracks(a: string, b: string, blockSecond: boolean): Track[] {
  return [
    { id: 't1', index: 0, title: 'Tone 1', source: { kind: 'url', url: a }, durationSeconds: 5, backMatter: false },
    { id: 't2', index: 1, title: 'Tone 2', source: { kind: 'url', url: b }, durationSeconds: 5, backMatter: false, blocked: blockSecond },
  ];
}

/** Player demo: two 5-second tones; voice B swaps the tones, a toggle blocks track 2, sleep timer in seconds. */
export function PlayerDemoScreen() {
  const p = usePlayer();
  const [urls, setUrls] = useState<{ a: string; b: string } | null>(null);
  const [voice, setVoice] = useState<'A' | 'B'>('A');
  const [blockSecond, setBlockSecond] = useState(false);
  const [saved, setSaved] = useState<string>('-');
  const [ended, setEnded] = useState(false);
  demoState.setEnded = (v) => { demoState.playlistEnded = v; setEnded(v); };

  useEffect(() => { Promise.all([assetUri('audio/tone-a.mp3'), assetUri('audio/tone-b.mp3')]).then(([a, b]) => setUrls({ a, b })).catch(() => {}); }, []);
  useEffect(() => { const id = setInterval(() => setSaved(JSON.stringify(demoProgress.peek(PLAYLIST_ID)) ?? '-'), 300); return () => clearInterval(id); }, []);

  const playlist = useMemo<Playlist | null>(() => urls ? { id: PLAYLIST_ID, title: voice === 'A' ? 'Tones (voice A)' : 'Tones (voice B)', tracks: voice === 'A' ? tracks(urls.a, urls.b, blockSecond) : tracks(urls.b, urls.a, blockSecond), finishTrackIndex: 1 } : null, [urls, voice, blockSecond]);

  useEffect(() => {
    if (!playlist || p.loaded) return;
    void p.load(playlist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  useEffect(() => {
    if (!playlist || !p.loaded) return;
    if (p.playlist?.title !== playlist.title || p.playlist?.tracks[1]?.blocked !== playlist.tracks[1]?.blocked) void p.switchPlaylist(playlist);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist]);

  if (!playlist) return <Text style={styles.status}>Loading fixture audio…</Text>;
  return (
    <ScrollView contentContainerStyle={styles.container} testID="player-demo">
      <Text style={styles.heading}>Player demo</Text>
      <Text testID="demo-state" style={styles.mono}>{`${p.index}:${p.positionSeconds.toFixed(1)}:${p.playing ? 'playing' : 'paused'}:${p.rate}`}</Text>
      <Text testID="demo-saved" style={styles.mono}>saved {saved}</Text>
      {ended ? <Text testID="demo-playlist-end" style={styles.banner}>Playlist end</Text> : null}
      <View style={styles.row}>
        <Btn testID="demo-play" label="Play" onPress={p.play} />
        <Btn testID="demo-pause" label="Pause" onPress={p.pause} />
        <Btn testID="demo-expand" label="Open player" onPress={() => p.setExpanded(true)} />
      </View>
      <View style={styles.row}>
        <Btn testID="demo-block" label={blockSecond ? 'Unblock track 2' : 'Block track 2'} onPress={() => setBlockSecond((v) => !v)} />
        <Btn testID="demo-voice" label={voice === 'A' ? 'Voice B' : 'Voice A'} onPress={() => setVoice((v) => (v === 'A' ? 'B' : 'A'))} />
        <Btn testID="demo-sleep-3s" label="Sleep 3 s" onPress={() => p.setSleepTimer(0.05)} />
      </View>
      <Text testID="demo-blocked" style={styles.mono}>blocked: {p.blockedIndex === null ? '-' : p.blockedIndex}</Text>
    </ScrollView>
  );
}

function Btn({ label, onPress, testID }: { label: string; onPress(): void; testID: string }) {
  return <Pressable onPress={onPress} testID={testID} accessibilityRole="button" style={styles.button}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  status: { padding: 24, fontSize: 16 },
  heading: { fontSize: 24, fontWeight: '700' },
  mono: { fontFamily: 'monospace', fontSize: 13 },
  banner: { color: '#b45309', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#222' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
