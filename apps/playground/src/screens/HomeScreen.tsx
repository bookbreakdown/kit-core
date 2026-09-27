import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PACKAGE as KIT_CORE } from '@libraryofages/kit-core';
import { PACKAGE as READER } from '@libraryofages/reader';
import { PACKAGE as PLAYER } from '@libraryofages/player';
import { PACKAGE as DOWNLOADS } from '@libraryofages/downloads';
import type { RootStackParamList } from '../navigation';

const PACKAGES = [KIT_CORE, READER, PLAYER, DOWNLOADS] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container} testID="home">
      <Text style={styles.heading}>Kit Playground</Text>
      {PACKAGES.map((pkg) => (
        <View key={pkg.name} style={styles.card} testID={`pkg-${pkg.name}`}>
          <Text style={styles.name}>{pkg.name}</Text>
          <Text style={styles.version}>{pkg.version}</Text>
        </View>
      ))}
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('ParserDemo')}
        testID="open-parser"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Parser demo</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('ReaderDemo')}
        testID="open-reader"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Reader demo</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate('PlayerDemo')} testID="open-player" accessibilityRole="button">
        <Text style={styles.buttonText}>Player demo</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate('DownloadsDemo')} testID="open-downloads" accessibilityRole="button">
        <Text style={styles.buttonText}>Downloads demo</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  name: { fontSize: 16, fontWeight: '600' },
  version: { fontSize: 14, color: '#666', marginTop: 4 },
  button: { marginTop: 12, padding: 16, borderRadius: 12, backgroundColor: '#222', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
