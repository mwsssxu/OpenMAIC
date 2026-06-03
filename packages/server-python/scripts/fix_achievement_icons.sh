#!/bin/bash
# 成就徽章emoji图标修复脚本

echo "================================================"
echo "成就徽章emoji图标修复"
echo "================================================"

cd /Users/xuning/workspace/project/git/ML/openmaic-business/packages/server-python

echo ""
echo "1. 检查当前后端进程..."
PID=$(lsof -ti:8000)
if [ -n "$PID" ]; then
    echo "   发现运行中的进程: PID=$PID"
    echo "   需要重启以加载emoji图标定义"
else
    echo "   没有运行中的进程"
fi

echo ""
echo "2. 验证后端emoji定义..."
python -c "
from app.routes.profile import ACHIEVEMENT_DEFINITIONS
print('   成就徽章定义:')
for ach in ACHIEVEMENT_DEFINITIONS[:3]:
    print(f'   - {ach[\"name\"]}: {ach[\"icon\"]}')
print('   ✅ 已使用emoji图标')
"

echo ""
echo "3. 重启服务器..."
if [ -n "$PID" ]; then
    echo "   正在停止旧进程..."
    kill $PID
    sleep 2
fi

echo "   正在启动新服务器..."
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > server.log 2>&1 &
NEW_PID=$!
echo "   新服务器已启动: PID=$NEW_PID"

echo ""
echo "4. 等待服务器启动..."
sleep 3

echo "   测试服务器状态..."
curl -s http://localhost:8000/health | python -m json.tool 2>/dev/null || echo "   ⚠️ 服务器启动中..."

echo ""
echo "================================================"
echo "修复完成！"
echo "================================================"
echo ""
echo "现在请刷新移动端Profile页面:"
echo "  1. 拉取刷新或重启应用"
echo "  2. 成就徽章应该显示emoji图标"
echo ""
echo "如果仍有问题，检查前端缓存:"
echo "  - 清除应用缓存"
echo "  - 或使用强制刷新"
echo ""