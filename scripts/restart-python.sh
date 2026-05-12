#!/bin/bash
# 快捷重启脚本 - 仅重启服务不做其他操作

CONTAINER_NAME="openmaic-business-python-server-1"

echo "重启 Python 服务..."
docker restart "$CONTAINER_NAME"

sleep 5
echo "检查状态..."
docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}"

curl -s http://localhost:8000/health && echo " ✅" || echo " ❌ 服务未响应"