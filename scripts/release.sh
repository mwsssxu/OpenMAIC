#!/bin/bash
# OpenMAIC Business 发布准备脚本
# 用于合并分支和创建发布

set -e

echo "=== OpenMAIC Business 发布准备 ==="
echo ""

# 1. 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "当前分支: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "feat/mobile" ]; then
    echo "错误: 请在 feat/mobile 分支执行此脚本"
    exit 1
fi

# 2. 检查未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "错误: 有未提交的更改，请先提交"
    git status
    exit 1
fi

# 3. 拉取最新代码
echo ""
echo "拉取最新代码..."
git pull origin feat/mobile

# 4. 检查版本信息
VERSION=$(grep "version.*v0" packages/server-python/app/main.py | head -1 | sed "s/.*v0\([0-9]*\).*/v0.\1/")
echo "Backend版本: $VERSION"

# 5. 显示提交统计
echo ""
echo "=== 提交统计 ==="
TOTAL_COMMITS=$(git rev-list --count HEAD)
echo "总提交数: $TOTAL_COMMITS"

AHEAD_MAIN=$(git rev-list --count main..HEAD 2>/dev/null || echo "无法计算")
echo "领先main: $AHEAD_MAIN commits"

# 6. 检查 gh 认证
echo ""
echo "=== GitHub CLI 检查 ==="
if gh auth status &>/dev/null; then
    echo "gh 已认证 ✓"

    # 7. 创建 PR
    echo ""
    echo "是否创建 PR 合并到 main? (y/n)"
    read -r answer

    if [ "$answer" = "y" ]; then
        echo "创建 PR..."
        gh pr create --base main \
            --title "OpenMAIC Business v0.23.0 - Production Ready" \
            --body "$(cat <<'EOF'
## Summary

OpenMAIC Business v0.23.0 商业化扩展版本，生产就绪。

### 主要功能

- **商业闭环修复**: 学习测评、课程推荐、笔记引用
- **企业功能**: 团队管理、课程分配、学习报表
- **支付系统**: Token购买、积分奖励、会员订阅
- **社交功能**: 学习搭子、共享笔记、学习匹配
- **游戏化**: 每日打卡、任务、联赛、成就
- **AI增强**: 视频转课程、AI智能体、编程模板

### 技术指标

| 项目 | 数值 |
|------|------|
| API端点 | 231 |
| 数据库表 | 62 |
| 前端页面 | 67 |
| 迁移文件 | 25 |

### 文档

- [CHANGELOG](CHANGELOG.md)
- [API文档](docs/api/api-documentation.md)
- [部署指南](docs/deployment/deployment-guide.md)
- [生产检查清单](docs/deployment/production-checklist.md)

## Test plan

- [ ] Backend 启动测试
- [ ] 数据库迁移测试
- [ ] API端点验证
- [ ] 前端页面渲染
- [ ] 管理后台登录

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
        echo "PR创建完成"

        # 8. 合并 PR
        echo ""
        echo "是否合并 PR? (y/n)"
        read -r merge_answer

        if [ "$merge_answer" = "y" ]; then
            echo "合并 PR..."
            gh pr merge --merge --delete-branch
            echo "合并完成"

            # 9. 创建 Release
            echo ""
            echo "是否创建 GitHub Release? (y/n)"
            read -r release_answer

            if [ "$release_answer" = "y" ]; then
                echo "创建 Release..."
                gh release create v0.23.0 \
                    --title "OpenMAIC Business v0.23.0" \
                    --notes-file docs/progress/development-complete.md
                echo "Release创建完成"
            fi
        fi
    fi
else
    echo "gh 未认证"
    echo "请执行: gh auth login"
    echo ""
    echo "手动合并步骤:"
    echo "1. gh auth login"
    echo "2. gh pr create --base main"
    echo "3. gh pr merge"
    echo "4. gh release create v0.23.0"
fi

echo ""
echo "=== 发布准备完成 ==="