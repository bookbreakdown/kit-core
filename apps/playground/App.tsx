import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FullPlayerSheet, MiniPlayer } from '@libraryofages/player';
import { HomeScreen } from './src/screens/HomeScreen';
import { ParserDemoScreen } from './src/screens/ParserDemoScreen';
import { ReaderDemoScreen } from './src/screens/ReaderDemoScreen';
import { PlayerDemoScreen } from './src/screens/PlayerDemoScreen';
import { DownloadsDemoScreen } from './src/screens/DownloadsDemoScreen';
import { Providers } from './src/Providers';
import { linking, type RootStackParamList } from './src/navigation';
import { READER_THEMES } from './src/themes';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <Providers>
        <NavigationContainer linking={linking}>
          <StatusBar style="auto" />
          <View style={{ flex: 1 }}>
            <Stack.Navigator>
              <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Kit Playground' }} />
              <Stack.Screen name="ParserDemo" component={ParserDemoScreen} options={{ title: 'Parser demo' }} />
              <Stack.Screen name="ReaderDemo" component={ReaderDemoScreen} options={{ headerShown: false }} />
              <Stack.Screen name="PlayerDemo" component={PlayerDemoScreen} options={{ title: 'Player demo' }} />
              <Stack.Screen name="DownloadsDemo" component={DownloadsDemoScreen} options={{ title: 'Downloads demo' }} />
            </Stack.Navigator>
            <MiniPlayer theme={READER_THEMES.light} />
            <FullPlayerSheet theme={READER_THEMES.light} />
          </View>
        </NavigationContainer>
      </Providers>
    </SafeAreaProvider>
  );
}
