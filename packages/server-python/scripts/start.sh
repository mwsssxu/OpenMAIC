#!/bin/bash
# OpenMAIC Backend 启动脚本
# FastAPI + PostgreSQL + Redis

set -e

cd "$(dirname "$0")/../server-python"

echo "================================================"
echo "   OpenMAIC Backend 服务启动"
echo "================================================"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose
DOCKER_COMPOSE=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Docker Compose 未安装"
    exit 1
fi

echo "✓ Docker 已安装"
echo "✓ Docker Compose: $DOCKER_COMPOSE"
echo ""

echo "=== 启动选项 ==="
echo ""
echo "请选择启动模式："
echo "  1) 开发模式 - Backend + DB + Redis"
echo "  2) 完整模式 - Backend + DB + Redis + Frontend"
echo "  3) 仅数据库 - PostgreSQL + Redis"
echo "  4) 停止服务"
echo "  5) 查看日志"
echo ""
read -p "输入选择 (1/2/3/4/5): " mode

case $mode in
    1)
        echo "启动开发模式..."
        cd "$(dirname "$0")/../.."
        $DOCKER_COMPOSE up -d
        ;;
    2)
        echo "启动完整模式..."
        cd "$(dirname "$0")/../.."
        $DOCKER_COMPOSE --profile admin --profile main up -d
        ;;
    3)
        echo "仅启动数据库..."
        cd "$(dirname "$0")/../.."
        $DOCKER_COMPOSE up -d postgres redis
        ;;
    4)
        echo "停止服务..."
        cd "$(dirname "$0")/../.."
        $DOCKER_COMPOSE down
        ;;
    5)
        echo "查看日志..."
        cd "$(dirname "$0")/../.."
        $DOCKER_COMPOSE logs -f
        ;;
    *)
        echo "无效选择，启动开发模式..."
        cd "$(dirname "$0")/../.."
        $DOCKER_COMPOSE up -d
        ;;
esac

echo ""
echo "================================================"
echo "   🚀 服务启动完成"
echo "================================================"
echo ""
echo "服务地址："
echo "  Backend API:  http://localhost:8000"
echo "  API文档:      http://localhost:8000/docs"
echo "  PostgreSQL:   localhost:5432"
echo "  Redis:        localhost:6379"
echo ""
echo "================================================"