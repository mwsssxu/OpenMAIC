#!/bin/bash
# OpenMAIC 后台服务重启脚本
# 用法: ./scripts/restart-backend.sh

cd "$(dirname "$0")/.."

echo "============================================================"
echo "OpenMAIC 后台服务重启"
echo "============================================================"

# 重启 Python 服务
echo ""
echo "重启 Python 服务..."
docker compose restart python-server

# 等待服务启动
echo ""
echo "等待服务启动..."
sleep 3

# 检查健康状态
echo ""
echo "检查健康状态..."
for i in {1..10}; do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ 服务健康检查通过"
    break
  fi
  echo "等待健康检查... ($i/10)"
  sleep 2
done

# 显示日志
echo ""
echo "============================================================"
echo "服务日志（最近 20 行）:"
echo "============================================================"
docker logs --tail 20 openmaic-python-server-1

echo ""
echo "============================================================"
echo "重启完成"
echo "============================================================"