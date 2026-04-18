#!/bin/bash
# OpenMAIC Business 重启脚本

set -e

echo "================================================"
echo "   OpenMAIC Business 服务重启"
echo "================================================"
echo ""

# 选择重启模式
echo "请选择重启模式："
echo "  1) 重启所有服务"
echo "  2) 仅重启Backend"
echo "  3) 重启并重建容器"
echo ""
read -p "输入选择 (1/2/3): " mode

case $mode in
    1)
        echo "重启所有服务..."
        docker-compose restart
        ;;
    2)
        echo "重启Backend..."
        docker-compose restart python-server
        ;;
    3)
        echo "重建并重启..."
        docker-compose down
        docker-compose up -d --build
        ;;
    *)
        echo "无效选择，重启所有服务..."
        docker-compose restart
        ;;
esac

echo ""
echo "等待服务就绪..."
sleep 10

# 健康检查
echo ""
echo "=== 健康检查 ==="

BACKEND_STATUS=$(curl -s http://localhost:8000/health 2>/dev/null || echo "offline")
if [ "$BACKEND_STATUS" != "offline" ]; then
    echo "✓ Backend: http://localhost:8000"
else
    echo "⚠️  Backend 启动中..."
fi

echo ""
echo "================================================"
echo "   重启完成！"
echo "================================================"