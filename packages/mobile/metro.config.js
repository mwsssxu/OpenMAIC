const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspace + shamefully-hoist: 包在 root node_modules
config.watchFolders = [monorepoRoot];

// expo-router 入口：Metro dev server 默认用 index.js
// 确保 index.js → expo-router/entry 正确链接
config.resolver.mainFields = ['react-native', 'browser', 'main'];

// 启用 exports 解析（expo-router 入口依赖它）
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'default'];

module.exports = config;
