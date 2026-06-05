const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspace: 让 metro 监听 monorepo root 的变化
config.watchFolders = [monorepoRoot];

module.exports = config;
