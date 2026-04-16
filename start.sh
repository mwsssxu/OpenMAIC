#!/bin/bash
# OpenMAIC 快速启动脚本

cd ~/.openclaw/workspace/openmaic-local

echo "🚀 OpenMAIC 本地服务启动中..."
echo ""

# 设置代理
export HTTP_PROXY=http://127.0.0.1:16006
export HTTPS_PROXY=http://127.0.0.1:16006
export NO_PROXY=localhost,127.0.0.1

echo "📍 代理：http://127.0.0.1:16006"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js >= 20"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装，执行：npm install -g pnpm"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，安装依赖中..."
    pnpm install
fi

# 检查配置
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local 不存在，请配置 API Key"
    echo "   编辑：~/.openclaw/workspace/openmaic-local/.env.local"
    exit 1
fi

# 启动服务
echo "✅ 启动服务..."
echo "📍 访问地址：http://localhost:3030"
echo "📍 端口：3030"
echo ""

# 使用 -p 参数指定端口
PORT=3030 pnpm dev
