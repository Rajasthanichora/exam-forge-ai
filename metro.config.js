const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure TTF fonts are resolvable (for @expo/vector-icons on web)
config.resolver.assetExts.push('ttf');
config.resolver.sourceExts.push('ttf');

module.exports = config;
