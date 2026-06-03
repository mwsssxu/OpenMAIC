#!/bin/bash
# 快速诊断脚本 - 检查成就徽章图标问题

echo "================================================"
echo "成就徽章图标诊断"
echo "================================================"

echo ""
echo "【检查1】后端emoji定义状态:"
cd /Users/xuning/workspace/project/git/ML/openmaic-business/packages/server-python
python -c "
import sys
try:
    from app.routes.profile import ACHIEVEMENT_DEFINITIONS
    icons = [ach['icon'] for ach in ACHIEVEMENT_DEFINITIONS]

    # 检查是否是emoji
    emoji_count = sum(1 for icon in icons if any(ord(c) > 127 for c in icon))

    if emoji_count == len(icons):
        print('✅ 后端定义: 全部使用emoji图标')
        print('示例:', icons[:3])
    else:
        print('❌ 后端定义: 使用文本图标名称')
        print('示例:', icons[:3])
        print('需要重新加载Python模块')
except Exception as e:
    print('❌ 错误:', str(e))
"

echo ""
echo "【检查2】服务器运行状态:"
PID=$(lsof -ti:8000 2>/dev/null)
if [ -n "$PID" ]; then
    echo "✅ 服务器运行中: PID=$PID"
    echo "提示: 如果emoji未生效，需要重启服务器"
else
    echo "❌ 服务器未运行"
    echo "需要启动服务器"
fi

echo ""
echo "【检查3】前端判断逻辑:"
FRONTEND_FILE="/Users/xuning/workspace/project/git/ML/openmaic-business/packages/mobile/app/(tabs)/profile.tsx"
if grep -q "achievementEmoji" "$FRONTEND_FILE" 2>/dev/null; then
    if grep -q "commonIonicons" "$FRONTEND_FILE" 2>/dev/null; then
        echo "✅ 前端: 支持emoji显示（优化判断）"
    else
        echo "⚠️  前端: 支持emoji显示（基础判断）"
    fi
else
    echo "❌ 前端: 不支持emoji显示"
fi

echo ""
echo "================================================"
echo "诊断建议"
echo "================================================"

# 根据诊断结果给出建议
if [ -n "$PID" ]; then
    echo ""
    echo "问题分析:"
    echo "后端emoji定义已更新，但服务器可能仍在运行旧代码。"
    echo ""
    echo "解决方案:"
    echo "执行修复脚本重启服务器:"
    echo "  bash scripts/fix_achievement_icons.sh"
    echo ""
    echo "或手动重启:"
    echo "  1. kill $PID"
    echo "  2. python -m uvicorn app.main:app --reload"
fi

echo ""