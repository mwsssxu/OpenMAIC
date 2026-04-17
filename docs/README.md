# OpenMAIC Business 商业策略研究平台

## 项目概述

OpenMAIC Business 是一个开源的商业策略研究平台，将文档或主题转化为交互式的商业分析课堂体验。平台支持多用户协作学习、AI 驱动的课程生成、实时互动白板等功能。

## 文档导航

### 需求文档 (requirements/)
- [需求概述](requirements/index.md) - 平台整体需求框架
- [主项目需求](requirements/main-project.md) - Next.js Web 应用需求
- [移动端需求](requirements/mobile.md) - Expo React Native App 需求
- [Python 后端需求](requirements/server-python.md) - FastAPI 服务需求
- [协作系统需求](requirements/collaboration.md) - 多用户协作功能需求

### 设计文档 (design/)
- [架构概述](design/overview.md) - 技术架构和设计原则
- [深入设计](design/deep-dive/) - 各子系统详细设计
- [商业模式闭环修复方案](design/business-loop-fixes.md) - 6个断裂点修复设计
- [AI辅助自学平台扩展机会](design/ai-learning-platform-opportunities.md) - 平台发展方向分析

### API 文档 (api/)
- [API 概述](api/overview.md) - API 设计原则和认证
- [Next.js 路由](api/nextjs-routes.md) - Web API 端点
- [Python 路由](api/python-routes.md) - 后端 API 端点
- [数据类型](api/types.md) - 共享类型定义

### 进度文档 (progress/)
- [进度概述](progress/overview.md) - 开发阶段总览
- [Phase 1: 核心重构](progress/main-project-phase1.md) - 主项目核心功能
- [Phase 1 完成报告](phase1-completion-report.md) - Phase 1 完成状态
- [Phase 2: 增值功能](progress/core-features-phase2.md) - Token/积分/问答系统
- [Phase 3: 增强体验](progress/enhancement-phase3.md) - 游戏化/学习搭子
- [Phase 4: 后台管理](progress/admin-phase4.md) - 管理后台开发

### 实现计划 (superpowers/plans/)
- [P0: 商业模式闭环修复](superpowers/plans/2026-04-17-p0-business-loop-fix.md) - 积分比例+会员订阅实现计划

### 开发计划
- [下阶段开发计划](next-phase-plan.md) - P1/P2/P4任务整合

## 技术栈

| 组件 | 技术 |
|------|------|
| Web 应用 | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui |
| 移动应用 | Expo (React Native) + expo-router + Skia |
| Python 后端 | FastAPI + PostgreSQL + Redis + LangChain |
| 状态管理 | Zustand |
| AI 集成 | LangGraph + LiteLLM + Vercel AI SDK |
| 实时通信 | WebSocket + SSE |
| 本地存储 | IndexedDB/Dexie + MMKV |

## 开发阶段

### Phase 1: 核心重构 (预计 8 周)
- 主项目架构重构
- Python 后端搭建
- 移动端核心功能

### Phase 2: 增值功能 (预计 6 周)
- Token/积分系统
- 问答悬赏系统
- 支付流程
- 邀请机制

### Phase 3: 增强体验 (预计 6 周)
- 学习搭子系统
- 学习匹配
- 共享笔记
- 游戏化系统

### Phase 4: 后台管理 (预计 4 周)
- 用户管理
- 内容审核
- 数据统计
- 系统配置

## 快速开始

```bash
# 克隆项目
git clone https://github.com/your-org/openmaic-business.git
cd openmaic-business

# 安装依赖
pnpm install

# 配置环境
cp .env.example .env.local
# 编辑 .env.local 填入 API keys

# 启动开发
pnpm dev
```

## 贡献指南

请参阅 [CONTRIBUTING.md](../CONTRIBUTING.md) 了解如何参与开发。