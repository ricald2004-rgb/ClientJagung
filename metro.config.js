const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tambahkan dukungan ekstensi .bin untuk model TensorFlow
config.resolver.assetExts.push('bin');

module.exports = config;
