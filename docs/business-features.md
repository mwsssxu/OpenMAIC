# OpenMAIC Business 功能扩展

> 基于 OpenMAIC 的商业化功能模块
> **版本:** v0.23.0 | **API端点:** 231个 | **数据库表:** 62张

---

## 🎯 Business 版本新增功能

### 一、商业闭环修复

| 功能 | 描述 | 状态 |
|------|------|------|
| 学习效果测评 | 量化知识掌握度（精通/熟练/掌握/了解） | ✅ |
| 课程推荐系统 | 完成后推荐后续路径 | ✅ |
| 笔记引用 | 关联课程内容片段 | ✅ |
| 笔记提醒 | 完成后引导记录笔记 | ✅ |

### 二、企业功能

| 功能 | 描述 |
|------|------|
| 企业账户 | 创建/配置企业账户 |
| 团队管理 | 邀请成员、角色分配 |
| 课程分配 | 企业专属课程、必修标记 |
| 学习报表 | 团队学习统计、排名 |

### 三、支付系统

| 功能 | 描述 |
|------|------|
| Token购买 | 多种套餐选择 |
| 积分系统 | 任务奖励、签到奖励 |
| 会员订阅 | 多级会员权益 |
| 问答悬赏 | 悬赏奖励分配 |

### 四、社交功能

| 功能 | 描述 |
|------|------|
| 学习搭子 | 6种类型AI搭子 |
| 共享笔记 | 发布/购买，70/30分成 |
| 学习匹配 | 智能匹配学习伙伴 |
| 分享卡片 | 成就/课程完成分享 |

### 五、游戏化激励

| 功能 | 描述 |
|------|------|
| 每日打卡 | 递增奖励（连续7天） |
| 每日任务 | 6种任务类型 |
| 联赛等级 | 7级联赛系统 |
| 成就系统 | 多维度成就解锁 |

### 六、AI增强功能

| 功能 | 描述 |
|------|------|
| 视频转课程 | YouTube/Bilibili解析 |
| AI智能体 | 孔子/苏格拉底/达芬奇 |
| 编程模板 | 代码练习、自动评分 |
| 学习深度 | skim/understand/master分层 |

---

## 📊 技术指标

| 项目 | 数值 |
|------|------|
| Backend版本 | v0.23.0 |
| API端点 | 231 |
| 数据库表 | 62 |
| 迁移文件 | 25 |
| 路由模块 | 37 |
| 前端页面 | 67 |
| ORM模型 | 80+ |

---

## 🚀 快速开始

### Docker部署

```bash
# 复制环境配置
cp docs/deployment/env-production.template .env.local

# 填入配置（至少需要数据库、Redis、LLM密钥）

# 启动服务
docker-compose up -d
```

### 数据库初始化

```bash
cd packages/server-python
alembic upgrade head
```

### 管理后台

访问 http://localhost:3001 登录管理后台

---

## 📁 项目结构

```
packages/
├── server-python/        # FastAPI Backend (v0.23.0)
│   ├── app/routes/       # 37个路由模块
│   ├── app/db/           # 80+ ORM模型
│   └── alembic/          # 25个迁移文件
│
├── admin/                # Next.js管理后台
│   └── app/              # 16个页面
│
├── main-project/         # Next.js主应用
│   └── app/              # 14个页面
│
├── mobile/               # React Native移动端
│   ├── app/              # 18个页面
│   └── lib/api-client/   # 931行API客户端
│
└── docs/                 # 文档
    ├── api/              # API文档
    ├── deployment/       # 部署指南
    ├── performance/      # 性能优化
    └── progress/         # 进度报告
```

---

## 🔧 环境配置

必需配置：

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# Redis
REDIS_URL=redis://host:6379/0

# 安全
SECRET_KEY=your-secret-key

# LLM（至少一个）
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# CORS
ALLOWED_ORIGINS=["https://yourdomain.com"]
```

可选配置：

```env
# OSS存储
OSS_ACCESS_KEY_ID=...
OSS_BUCKET=...

# OAuth
APPLE_CLIENT_ID=...
GOOGLE_CLIENT_ID=...

# 支付
WECHAT_PAY_MCHID=...
ALIPAY_APP_ID=...
```

---

## 📖 文档链接

| 文档 | 位置 |
|------|------|
| API文档 | docs/api/api-documentation.md |
| 部署指南 | docs/deployment/deployment-guide.md |
| 环境配置 | docs/deployment/env-production.template |
| 数据库SQL | docs/deployment/database-init.sql |
| 性能优化 | docs/performance/database-optimization.md |
| 完成报告 | docs/progress/final-report.md |

---

## 📈 开发进度

| Phase | 状态 |
|-------|------|
| Phase 1 核心重构 | ✅ |
| Phase 2 增值功能 | ✅ |
| Phase 3 增强体验 | ✅ |
| P1 商业闭环 | ✅ |
| P2 AI扩展 | ✅ |
| P4 后台管理 | ✅ |
| Phase 5 前端适配 | ✅ |
| Phase 6 性能优化 | ✅ |

---

## 🤝 基于原项目

本项目基于 [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 进行商业化扩展。

原项目功能：
- AI课程生成
- 多智能体课堂
- 白板与TTS
- 幻灯片导出

Business新增：
- 支付系统
- 企业功能
- 社交功能
- 游戏化激励

---

## 📄 许可证

原项目: AGPL-3.0
Business扩展: 需联系获取商业许可

---

**状态:** 生产就绪 ✅
**版本:** v0.23.0
**更新:** 2026-04-17