import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { readAsStringAsync } from 'expo-file-system/legacy';

/** Loads a bundled fixture text as a string on web and native. */
export async function loadFixture(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    if (!res.ok) throw new Error(`fixture fetch failed: HTTP ${res.status}`);
    return res.text();
  }
  const uri = asset.localUri ?? asset.uri;
  return readAsStringAsync(uri);
}
