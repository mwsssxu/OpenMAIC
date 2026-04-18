#!/bin/bash
# OpenMAIC 移动端启动脚本

set -e

echo "================================================"
echo "   OpenMAIC Mobile 启动"
echo "================================================"
echo ""

# 进入移动端目录
cd packages/mobile

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，请先安装 pnpm"
    echo "   npm install -g pnpm"
    exit 1
fi

echo "✓ pnpm 已安装"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo ""
    echo "=== 安装依赖 ==="
    pnpm install
fi

echo ""
echo "=== 检查 Backend 连接 ==="
echo ""

# 检查 Backend 是否运行
BACKEND_URL="http://localhost:8000"
BACKEND_STATUS=$(curl -s $BACKEND_URL/health 2>/dev/null || echo "offline")

if [ "$BACKEND_STATUS" = "offline" ]; then
    echo "⚠️  Backend 未运行，请先启动 Backend:"
    echo "   cd packages/server-python"
    echo "   docker-compose up -d"
    echo "   或"
    echo "   uvicorn app.main:app --reload"
    echo ""
    echo "按 Ctrl+C 退出，或按 Enter 继续..."
    read -r
fi

echo ""
echo "=== 选择启动模式 ==="
echo ""
echo "  1) Expo Go (推荐) - 在手机/模拟器运行"
echo "  2) iOS 模拟器"
echo "  3) Android 模拟器"
echo "  4) Web 版本"
echo "  5) 清除缓存并启动"
echo ""
read -p "输入选择 (1/2/3/4/5): " mode

case $mode in
    1)
        echo ""
        echo "启动 Expo 开发服务器..."
        echo ""
        echo "请使用 Expo Go App 扫码连接："
        echo "  - iOS: App Store 搜索 'Expo Go'"
        echo "  - Android: Google Play 搜索 'Expo Go'"
        echo ""
        pnpm expo start
        ;;
    2)
        echo ""
        echo "启动 iOS 模拟器..."
        if command -v xcode-select &> /dev/null; then
            pnpm expo start --ios
        else
            echo "❌ Xcode 未安装，请先安装 Xcode"
            echo "   macOS: App Store 安装 Xcode"
        fi
        ;;
    3)
        echo ""
        echo "启动 Android 模拟器..."
        echo "请确保 Android Studio 已安装并有运行的模拟器"
        pnpm expo start --android
        ;;
    4)
        echo ""
        echo "启动 Web 版本..."
        pnpm expo start --web
        ;;
    5)
        echo ""
        echo "清除缓存并启动..."
        pnpm expo start --clear
        ;;
    *)
        echo ""
        echo "启动 Expo 开发服务器..."
        pnpm expo start
        ;;
esac

echo ""
echo "================================================"
echo "   常用快捷键"
echo "================================================"
echo ""
echo "  i - 打开 iOS 模拟器"
echo "  a - 打开 Android 模拟器"
echo "  w - 打开 Web 版本"
echo "  r - 重载应用"
echo "  m - 打开开发菜单"
echo "  j - 打开调试器"
echo "  ? - 显示帮助"
echo ""
echo "================================================"