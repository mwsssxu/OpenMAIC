#!/bin/bash
# OpenMAIC 强制启动脚本（使用 3030 端口）

cd ~/.openclaw/workspace/openmaic-local

echo "🚀 OpenMAIC 启动中..."
echo ""

# 设置代理
export HTTP_PROXY=http://127.0.0.1:16006
export HTTPS_PROXY=http://127.0.0.1:16006
export NO_PROXY=localhost,127.0.0.1

# 设置端口
export PORT=3030

echo "📍 代理：http://127.0.0.1:16006"
echo "📍 端口：3030"
echo ""

# 检查并终止占用 3000 端口的旧进程（如果有）
echo "🔍 检查端口..."
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "⚠️  端口 3000 被占用，但不影响 3030 端口启动"
fi

# 检查 3030 端口
if lsof -ti:3030 >/dev/null 2>&1; then
    echo "❌ 端口 3030 已被占用！"
    echo "   终止旧进程..."
    kill -9 $(lsof -ti:3030) 2>/dev/null
    sleep 1
fi

echo "✅ 端口 3030 已准备就绪"
echo ""

# 启动服务（强制使用 3030 端口）
echo "🚀 启动 Next.js 开发服务器..."
pnpm next dev -p 3030
