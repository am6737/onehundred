const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /supabase-docker\/.*/,
];

// Rive 动画文件按静态资源打包，RivePetRenderer 用 source={require('....riv')} 加载。
config.resolver.assetExts = [...config.resolver.assetExts, 'riv'];

module.exports = config;
