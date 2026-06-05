const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// pnpm workspace
config.watchFolders = [monorepoRoot];

// 关闭 exports 解析 — datetimepicker 没有 exports 字段
config.resolver.unstable_enablePackageExports = false;

// pnpm 符号链接：显式映射包的真实路径到 extraNodeModules
// metro 默认不会 follow pnpm 的深层符号链接到 .pnpm 目录
const datetimepickerRealPath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/@react-native-community/datetimepicker')
);

config.resolver.extraNodeModules = {
  '@react-native-community/datetimepicker': datetimepickerRealPath,
};

module.exports = config;