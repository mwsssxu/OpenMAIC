const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspace
config.watchFolders = [monorepoRoot];

// 关闭 package exports 解析 — datetimepicker 8.4.4 没有 exports 字段，
// metro 的 unstable_enablePackageExports 会导致它无法 fallback 到 main
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
