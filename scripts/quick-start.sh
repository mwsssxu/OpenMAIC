#!/bin/bash
# OpenMAIC Business 快速启动脚本
# 一键启动所有服务

set -e

echo "================================================"
echo "   OpenMAIC Business v0.23.0 快速启动"
echo "================================================"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose (支持新旧两种命令格式)
DOCKER_COMPOSE=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Docker Compose 未安装，请先安装"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✓ Docker 已安装"
echo "✓ Docker Compose 已安装 ($DOCKER_COMPOSE)"
echo ""

# 检查环境配置
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  环境配置文件不存在，创建默认配置..."
    cp docs/deployment/env-production.template "$ENV_FILE" 2>/dev/null || cp .env.example "$ENV_FILE"
    echo ""
    echo "📝 已创建 $ENV_FILE，请编辑填入以下必需配置："
    echo "   - SECRET_KEY (安全密钥)"
    echo "   - OPENAI_API_KEY 或 ANTHROPIC_API_KEY (LLM密钥)"
    echo ""
    echo "生成 SECRET_KEY 命令："
    echo "   openssl rand -hex 32"
    echo ""
fi

# 检查必需环境变量
check_required_env() {
    local missing=0

    # 检查 SECRET_KEY
    if grep -q "YOUR_SECRET_KEY_HERE" "$ENV_FILE" 2>/dev/null || \
       ! grep -q "SECRET_KEY=" "$ENV_FILE" 2>/dev/null; then
        echo "❌ SECRET_KEY 未配置"
        missing=1
    fi

    # 检查 LLM 密钥
    if ! grep -qE "(OPENAI_API_KEY=sk-|ANTHROPIC_API_KEY=sk-ant-)" "$ENV_FILE" 2>/dev/null; then
        echo "⚠️  LLM API密钥未配置（至少需要一个）"
    fi

    return $missing
}

echo "=== 配置检查 ==="
if [ -f "$ENV_FILE" ]; then
    check_required_env || true
fi

echo ""
echo "=== 启动服务 ==="
echo ""

# 选择启动模式
echo "请选择启动模式："
echo "  1) 开发模式 - Backend + Database + Redis"
echo "  2) 完整模式 - Backend + Database + Redis + Frontend"
echo "  3) 生产模式 - 使用生产配置启动"
echo ""
read -p "输入选择 (1/2/3): " mode

case $mode in
    1)
        echo "启动开发模式..."
        $DOCKER_COMPOSE up -d
        ;;
    2)
        echo "启动完整模式..."
        $DOCKER_COMPOSE --profile admin --profile main up -d
        ;;
    3)
        echo "启动生产模式..."
        # 检查生产配置
        if [ ! -f ".env.production" ]; then
            echo "⚠️  .env.production 不存在，使用 .env.local"
            cp "$ENV_FILE" .env.production
        fi
        $DOCKER_COMPOSE -f docker-compose.yml -f docker-compose.prod.yml up -d --build
        ;;
    *)
        echo "无效选择，启动开发模式..."
        $DOCKER_COMPOSE up -d
        ;;
esac

echo ""
echo "=== 等待服务就绪 ==="
echo ""

# 等待数据库
echo "等待 PostgreSQL..."
sleep 10
until $DOCKER_COMPOSE exec -T postgres pg_isready -U maic -d maic 2>/dev/null; do
    echo "数据库未就绪，等待..."
    sleep 5
done
echo "✓ PostgreSQL 就绪"

# 执行迁移
echo ""
echo "=== 数据库迁移 ==="
echo ""
$DOCKER_COMPOSE exec -T python-server alembic upgrade head || echo "迁移已在之前完成"

# 健康检查
echo ""
echo "=== 健康检查 ==="
echo ""

sleep 5

# Backend
BACKEND_STATUS=$(curl -s http://localhost:8000/health 2>/dev/null || echo "offline")
if [ "$BACKEND_STATUS" != "offline" ]; then
    echo "✓ Backend: http://localhost:8000"
else
    echo "⚠️  Backend 启动中..."
fi

# Frontend (如果启动)
if $DOCKER_COMPOSE ps main 2>/dev/null | grep -q "running"; then
    echo "✓ Main App: http://localhost:3000"
fi

if $DOCKER_COMPOSE ps admin 2>/dev/null | grep -q "running"; then
    echo "✓ Admin: http://localhost:3001"
fi

echo ""
echo "================================================"
echo "   🎉 启动完成！"
echo "================================================"
echo ""
echo "服务地址："
echo "  Backend API:  http://localhost:8000"
echo "  API文档:      http://localhost:8000/docs"
echo "  主应用:       http://localhost:3000 (完整模式)"
echo "  管理后台:     http://localhost:3001 (完整模式)"
echo ""
echo "数据库："
echo "  PostgreSQL:   localhost:5432 (用户: maic, 密码: password)"
echo "  Redis:        localhost:6379"
echo ""
echo "常用命令："
echo "  查看日志:     $DOCKER_COMPOSE logs -f"
echo "  停止服务:     $DOCKER_COMPOSE down"
echo "  重启服务:     $DOCKER_COMPOSE restart"
echo "  进入Backend:  $DOCKER_COMPOSE exec python-server bash"
echo ""
echo "================================================"