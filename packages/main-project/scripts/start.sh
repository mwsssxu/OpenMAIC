#!/bin/bash
# OpenMAIC Main App 启动脚本
# Next.js 前端项目

set -e

cd "$(dirname "$0")/../main-project"

echo "================================================"
echo "   OpenMAIC Main App 启动"
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

echo ""
echo "=== 启动选项 ==="
echo ""
echo "请选择启动模式："
echo "  1) 开发模式 - Next.js 开发服务器"
echo "  2) 生产构建 - 构建生产版本"
echo "  3) 生产启动 - 启动生产服务器"
echo "  4) 清理缓存 - 删除 .next 和 node_modules/.cache"
echo ""
read -p "输入选择 (1/2/3/4): " mode

case $mode in
    1)
        echo "启动开发服务器..."
        pnpm dev
        ;;
    2)
        echo "构建生产版本..."
        pnpm build
        ;;
    3)
        echo "启动生产服务器..."
        pnpm start
        ;;
    4)
        echo "清理缓存..."
        rm -rf .next node_modules/.cache
        ;;
    *)
        echo "无效选择，启动开发模式..."
        pnpm dev
        ;;
esac

echo ""
echo "================================================"
echo "   🖥️ Next.js 服务已启动"
echo "================================================"
echo ""
echo "服务地址："
echo "  Main App: http://localhost:3000"
echo ""
echo "================================================"