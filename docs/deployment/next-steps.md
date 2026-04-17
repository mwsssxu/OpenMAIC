# OpenMAIC Business 下一步操作指南

> **当前状态:** 生产就绪 ✅
> **版本:** v0.23.0
> **分支:** feat/mobile (已同步)

---

## 方案 A: GitHub PR 合并 (推荐)

### 1. GitHub CLI 认证

```bash
gh auth login
# 选择 GitHub.com
# 选择 HTTPS
# 选择 Login with web browser
```

### 2. 创建 PR

```bash
cd /Users/xuning/workspace/project/git/ML/openmaic-business
gh pr create --base main \
    --title "OpenMAIC Business v0.23.0 - Production Ready" \
    --body "见 CHANGELOG.md 和 docs/progress/development-complete.md"
```

### 3. 合并 PR

```bash
gh pr merge --merge --delete-branch
```

### 4. 创建 Release

```bash
gh release create v0.23.0 \
    --title "OpenMAIC Business v0.23.0" \
    --notes "生产就绪版本，详见 CHANGELOG.md"
```

---

## 方案 B: 手动 Git 合并

```bash
# 切换到 main 分支
git checkout main

# 拉取最新
git pull origin main

# 合并 feat/mobile
git merge feat/mobile

# 推送到远程
git push origin main

# 删除开发分支
git branch -d feat/mobile
git push origin --delete feat/mobile

# 创建 tag
git tag v0.23.0
git push origin v0.23.0
```

---

## 方案 C: 使用发布脚本

```bash
cd /Users/xuning/workspace/project/git/ML/openmaic-business
./scripts/release.sh
```

脚本会自动检查状态并引导完成发布流程。

---

## 部署后续步骤

### 1. 生产环境配置

```bash
cp docs/deployment/env-production.template .env.production
# 填入实际配置值
```

### 2. 数据库迁移

```bash
cd packages/server-python
alembic upgrade head
```

### 3. 启动服务

```bash
docker-compose up -d
```

### 4. 健康检查

```bash
curl http://localhost:8000/health
curl http://localhost:3000/health
curl http://localhost:3001/health
```

---

## 检查清单

- [ ] GitHub CLI 认证完成
- [ ] PR 已创建
- [ ] PR 已合并到 main
- [ ] Release 已创建
- [ ] 生产环境已配置
- [ ] 数据库迁移已执行
- [ ] 服务健康检查通过

---

**当前阻塞:** 需要 `gh auth login` 才能创建 PR

**执行命令:** 
```bash
gh auth login
```
认证后自动继续发布流程。