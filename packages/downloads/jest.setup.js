// IndexedDB in Node, and stubs for the native-only modules the file-system storage imports.
require('fake-indexeddb/auto');
jest.mock('expo-file-system', () => ({ File: class {}, Directory: class {}, Paths: { document: {}, availableDiskSpace: 0 }, FileMode: {} }));
jest.mock('expo-crypto', () => ({ digest: jest.fn(), CryptoDigestAlgorithm: { SHA256: 'SHA-256' } }));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(async () => ({ type: 'wifi', isConnected: true })), addEventListener: jest.fn(() => () => {}) }));
