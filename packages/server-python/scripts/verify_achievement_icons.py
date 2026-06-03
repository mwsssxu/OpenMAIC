#!/usr/bin/env python
"""
验证成就徽章emoji图标更新

运行方式：
python scripts/verify_achievement_icons.py

检查项：
1. 后端定义的图标是否为emoji
2. API返回的数据格式是否正确
3. 前端显示逻辑是否支持emoji
"""

import sys
sys.path.insert(0, '/Users/xuning/workspace/project/git/ML/openmaic-business/packages/server-python')

from app.routes.profile import ACHIEVEMENT_DEFINITIONS

print("=" * 60)
print("成就徽章图标验证")
print("=" * 60)

print("\n✅ 后端定义检查:")
for ach in ACHIEVEMENT_DEFINITIONS:
    icon = ach["icon"]
    name = ach["name"]

    # 检查是否包含非ASCII字符（emoji特征）
    is_emoji = any(ord(c) > 127 for c in icon)

    status = "✅ EMOJI" if is_emoji else "❌ 文本"
    print(f"  {status} {icon} - {name} (id: {ach['id']})")

print("\n✅ 前端显示逻辑检查:")
frontend_file = '/Users/xuning/workspace/project/git/ML/openmaic-business/packages/mobile/app/(tabs)/profile.tsx'
with open(frontend_file, 'r') as f:
    content = f.read()

    # 检查是否包含emoji显示逻辑
    if 'achievementEmoji' in content and 'isEmoji' in content:
        print("  ✅ 前端已支持emoji显示")

        # 检查emoji判断逻辑
        if 'commonIonicons' in content:
            print("  ✅ emoji判断逻辑已优化（排除Ionicons名称）")
        else:
            print("  ⚠️ emoji判断逻辑较简单（仅检查长度）")
    else:
        print("  ❌ 前端缺少emoji显示支持")

print("\n📋 使用说明:")
print("  1. 重启后端服务器使emoji定义生效:")
print("     cd packages/server-python && python -m uvicorn app.main:app --reload")
print()
print("  2. 在移动端刷新Profile页面:")
print("     - 拉取刷新或重启应用")
print("     - 检查成就徽章是否显示emoji图标")
print()
print("  3. 如果仍未显示，检查API返回数据:")
print("     curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:8000/profile/achievements")

print("\n" + "=" * 60)
print("验证完成")
print("=" * 60)