const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure TTF fonts are resolvable (for @expo/vector-icons on web)
config.resolver.assetExts.push('ttf');
config.resolver.sourceExts.push('ttf');

// WASM support for expo-sqlite web worker
config.resolver.assetExts.push('wasm');
config.resolver.sourceExts.push('wasm');

module.exports = config;
