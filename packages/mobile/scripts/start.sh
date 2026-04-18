#!/bin/bash
# OpenMAIC Mobile App 启动脚本
# React Native + Expo 项目

set -e

cd "$(dirname "$0")"

echo "================================================"
echo "   OpenMAIC Mobile App 启动"
echo "================================================"
echo ""

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，请先安装"
    echo "   npm install -g pnpm"
    exit 1
fi

echo "✓ pnpm 已安装"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    pnpm install
fi

# 检查 Expo CLI
echo "检查 Expo..."
if ! command -v npx &> /dev/null; then
    echo "❌ npx 未安装"
    exit 1
fi

echo ""
echo "=== 启动选项 ==="
echo ""
echo "请选择启动模式："
echo "  1) 开发模式 - Expo 开发服务器"
echo "  2) Web 模式 - 在浏览器中预览"
echo "  3) Android - 启动 Android 模拟器"
echo "  4) iOS - 启动 iOS 模拟器"
echo "  5) 清理缓存 - 清除 Metro bundler 缓存"
echo ""
read -p "输入选择 (1/2/3/4/5): " mode

case $mode in
    1)
        echo "启动 Expo 开发服务器..."
        npx expo start
        ;;
    2)
        echo "启动 Web 模式..."
        npx expo start --web
        ;;
    3)
        echo "启动 Android..."
        npx expo start --android
        ;;
    4)
        echo "启动 iOS..."
        npx expo start --ios
        ;;
    5)
        echo "清理缓存..."
        rm -rf .expo node_modules/.cache
        npx expo start --clear
        ;;
    *)
        echo "无效选择，启动开发模式..."
        npx expo start
        ;;
esac

echo ""
echo "================================================"
echo "   📱 Expo 开发服务器已启动"
echo "================================================"
echo ""
echo "使用说明："
echo "  • 在浏览器打开 http://localhost:8081"
echo "  • 使用 Expo Go App 扫描二维码"
echo "  • 按 'w' 打开 Web 版本"
echo "  • 按 'a' 打开 Android"
echo "  • 按 'i' 打开 iOS"
echo ""
echo "================================================"