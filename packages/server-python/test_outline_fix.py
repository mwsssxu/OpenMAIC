#!/usr/bin/env python3
"""
测试大纲生成修复效果

验证generate_single_outline是否生成丰富的key_points
"""

import asyncio
import sys
sys.path.insert(0, '/app')

from app.services.generation.outline_generator import generate_single_outline, generate_outline_titles
from app.core.config import settings

async def test_outline_generation():
    """测试大纲生成"""
    requirement = "为初中生创建一个关于光合作用的生物课程"
    language = "zh-CN"
    model = settings.DEFAULT_MODEL
    total_count = 3

    print("=" * 80)
    print("测试大纲生成修复效果")
    print("=" * 80)

    # 1. 生成标题列表
    print("\n[步骤1] 生成标题列表...")
    titles = await generate_outline_titles(requirement, language, model, total_count)
    print(f"✓ 生成了 {len(titles)} 个标题")
    for i, title in enumerate(titles):
        print(f"  #{i+1}: {title.get('title')} ({title.get('type')})")

    # 2. 为每个标题生成完整大纲（修复的关键）
    print("\n[步骤2] 为每个大纲生成详细内容（包含key_points）...")
    for i, outline_info in enumerate(titles):
        print(f"\n处理大纲 #{i+1}: {outline_info.get('title')}")

        outline = await generate_single_outline(
            requirement=requirement,
            outline_info=outline_info,
            order=i + 1,
            language=language,
            model=model,
        )

        print(f"  标题: {outline.title}")
        print(f"  描述: {outline.description}")
        print(f"  key_points数量: {len(outline.key_points)}")

        # 验证key_points质量
        if len(outline.key_points) > 0:
            print("  ✓ key_points内容:")
            for j, point in enumerate(outline.key_points[:5]):  # 只显示前5个
                print(f"    - {point}")

            # 判断是否是模板化内容
            template_keywords = ["概述", "说明", "介绍", "讲解", "分析"]
            is_template = any(kw in outline.key_points[0] for kw in template_keywords) and len(outline.key_points[0]) < 10

            if is_template:
                print("  ❌ WARNING: 可能是模板化内容")
            else:
                print("  ✅ SUCCESS: 内容丰富、具体")
        else:
            print("  ❌ ERROR: 没有生成key_points")

    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_outline_generation())