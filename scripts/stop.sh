#!/bin/bash
# OpenMAIC Business 停止脚本

set -e

echo "================================================"
echo "   OpenMAIC Business 服务停止"
echo "================================================"
echo ""

# 检查运行中的服务
RUNNING=$(docker-compose ps --services --filter "status=running" 2>/dev/null | wc -l)

if [ "$RUNNING" -eq 0 ]; then
    echo "没有运行中的服务"
    exit 0
fi

echo "当前运行的服务:"
docker-compose ps
echo ""

# 选择停止模式
echo "请选择停止模式："
echo "  1) 停止所有服务"
echo "  2) 停止并清理数据"
echo "  3) 仅停止Backend"
echo ""
read -p "输入选择 (1/2/3): " mode

case $mode in
    1)
        echo "停止所有服务..."
        docker-compose down
        echo "✓ 服务已停止"
        ;;
    2)
        echo "警告：这将删除所有数据！"
        read -p "确认删除? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo "停止服务并清理数据..."
            docker-compose down -v
            echo "✓ 服务已停止，数据已清理"
        else
            echo "取消操作"
        fi
        ;;
    3)
        echo "停止Backend..."
        docker-compose stop python-server
        echo "✓ Backend已停止"
        ;;
    *)
        echo "无效选择"
        ;;
esac

echo ""
echo "================================================"