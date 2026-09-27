import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { formatBytes, type Theme } from '@libraryofages/kit-core';
import { useDownloads } from '../DownloadsProvider';
import type { DownloadItem } from '../types';

function stateLabel(i: DownloadItem): string {
  if (i.waitingForWifi) return 'Waiting for Wi-Fi';
  switch (i.state) {
    case 'queued': return 'Queued';
    case 'downloading': return `Downloading ${Math.round(i.progress * 100)}%`;
    case 'paused': return 'Paused';
    case 'ready': return 'Downloaded';
    case 'update-available': return 'Update available';
    case 'locked': return i.lockedReason === 'expired' ? 'Expired — reconnect to renew' : i.lockedReason === 'lapsed' ? 'Supporter access lapsed' : 'Locked';
    case 'failed': return `Failed${i.error ? `: ${i.error}` : ''}`;
    default: return i.state;
  }
}

function Row({ item, theme }: { item: DownloadItem; theme: Theme }) {
  const d = useDownloads();
  const c = theme.colors;
  const busy = item.state === 'queued' || item.state === 'downloading';
  return (
    <View style={[styles.row, { borderBottomColor: c.border }]} testID={`download-${item.key}`}>
      <View style={styles.rowTop}>
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{item.title}{item.voice ? ` · ${item.voice}` : ''}</Text>
        <Text style={[styles.size, { color: c.muted }]} testID={`download-${item.key}-size`}>{formatBytes(item.byteSize)}</Text>
      </View>
      <Text style={[styles.state, { color: item.state === 'failed' || item.state === 'locked' ? c.accent : c.muted }]} testID={`download-${item.key}-state`}>{stateLabel(item)}</Text>
      {busy || item.state === 'paused' ? <View style={[styles.bar, { backgroundColor: c.border }]}><View style={[styles.fill, { width: `${Math.round(item.progress * 100)}%`, backgroundColor: c.accent }]} /></View> : null}
      <View style={styles.actions}>
        {item.state === 'downloading' || (item.state === 'queued' && !item.waitingForWifi) ? <Action label="Pause" onPress={() => void d.pause(item.key)} theme={theme} testID={`download-${item.key}-pause`} /> : null}
        {item.state === 'paused' || (item.state === 'queued' && item.waitingForWifi) ? <Action label="Resume" onPress={() => void d.resume(item.key)} theme={theme} testID={`download-${item.key}-resume`} /> : null}
        {busy ? <Action label="Cancel" onPress={() => void d.cancel(item.key)} theme={theme} testID={`download-${item.key}-cancel`} /> : null}
        {item.state === 'failed' ? <Action label="Retry" onPress={() => void d.retry(item.key)} theme={theme} testID={`download-${item.key}-retry`} /> : null}
        {item.state === 'update-available' ? <Action label="Update" onPress={() => { void d.remove(item.key).then(() => (item.kind === 'text' ? d.downloadText(item.id) : d.downloadAudio(item.id, item.voice ?? ''))); }} theme={theme} testID={`download-${item.key}-update`} /> : null}
        <Action label="Delete" onPress={() => void d.remove(item.key)} theme={theme} testID={`download-${item.key}-delete`} />
      </View>
    </View>
  );
}

function Action({ label, onPress, theme, testID }: { label: string; onPress(): void; theme: Theme; testID: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} accessibilityRole="button" style={[styles.action, { borderColor: theme.colors.border }]}>
      <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** Books and Audiobooks with size, state, progress and actions; storage totals and the two settings. */
export function DownloadsList({ theme }: { theme: Theme }) {
  const d = useDownloads();
  const c = theme.colors;
  const books = d.list.filter((i) => i.kind === 'text');
  const audio = d.list.filter((i) => i.kind === 'audio');
  return (
    <ScrollView testID="downloads-list" contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.headerText, { color: c.text }]} testID="downloads-used">{formatBytes(d.usedBytes)} used</Text>
        <Text style={[styles.headerText, { color: c.muted }]} testID="downloads-free">{d.freeBytes === null ? 'free space unknown' : `${formatBytes(d.freeBytes)} free`}</Text>
      </View>
      <View style={styles.setting}><Text style={{ color: c.text }}>Download audio on Wi-Fi only</Text><Switch value={d.settings.wifiOnly} onValueChange={(v) => void d.setSettings({ wifiOnly: v })} testID="downloads-wifi-only" /></View>
      <View style={styles.setting}><Text style={{ color: c.text }}>Auto-download the next chapter</Text><Switch value={d.settings.autoDownloadNext} onValueChange={(v) => void d.setSettings({ autoDownloadNext: v })} testID="downloads-auto-next" /></View>
      <Text style={[styles.group, { color: c.muted }]}>Books</Text>
      {books.length === 0 ? <Text style={[styles.empty, { color: c.muted }]}>No downloaded books</Text> : books.map((i) => <Row key={i.key} item={i} theme={theme} />)}
      <Text style={[styles.group, { color: c.muted }]}>Audiobooks</Text>
      {audio.length === 0 ? <Text style={[styles.empty, { color: c.muted }]}>No downloaded audiobooks</Text> : audio.map((i) => <Row key={i.key} item={i} theme={theme} />)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1 },
  headerText: { fontSize: 13, fontWeight: '600' },
  setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  group: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  empty: { fontSize: 13, paddingVertical: 8 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  size: { fontSize: 12 },
  state: { fontSize: 12 },
  bar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  action: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
});
