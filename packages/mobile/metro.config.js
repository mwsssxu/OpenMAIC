const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspace + shamefully-hoist: 包在 root node_modules
config.watchFolders = [monorepoRoot];

// 关闭 exports 解析 — datetimepicker 没有 exports 字段
config.resolver.unstable_enablePackageExports = false;

module.exports = config;