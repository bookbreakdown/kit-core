const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo support (Comeback pattern): watch the workspace root so Metro follows
// the symlinked @libraryofages/* packages and sees edits inside packages/.
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), monorepoRoot]));
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
// Fixture texts are bundled as assets.
config.resolver.assetExts = [...config.resolver.assetExts, 'md'];

module.exports = config;
