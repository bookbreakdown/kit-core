// The native track-player module has no Jest implementation; tests inject a fake engine.
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {},
  Event: {}, Capability: {}, AppKilledPlaybackBehavior: {}, State: {},
  setupPlayer: jest.fn(), registerPlaybackService: jest.fn(), addEventListener: jest.fn(() => ({ remove() {} })),
}));
