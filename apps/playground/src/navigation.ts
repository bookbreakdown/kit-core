import type { LinkingOptions } from '@react-navigation/native';

export type RootStackParamList = {
  Home: undefined;
  ParserDemo: undefined;
  ReaderDemo: undefined;
  PlayerDemo: undefined;
  DownloadsDemo: undefined;
};

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['kitplayground://', 'http://localhost:4173', 'http://127.0.0.1:4173'],
  config: {
    screens: {
      Home: '',
      ParserDemo: 'parser',
      ReaderDemo: 'reader',
      PlayerDemo: 'player',
      DownloadsDemo: 'downloads',
    },
  },
};
