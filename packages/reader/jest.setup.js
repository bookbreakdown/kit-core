// The WebView native module does not exist under Jest; tests inject a fake page host.
jest.mock('react-native-webview', () => {
  const React = require('react');
  return { WebView: React.forwardRef(() => null) };
});
