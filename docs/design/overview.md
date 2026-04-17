# 架构概述

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     用户层 (User Layer)                      │
│   Web Browser    │    Mobile App    │    Admin Dashboard    │
└─────────────────────────────────────────────────────────────┘
                              ↓ ↑ HTTPS/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                     应用层 (Application Layer)               │
│   Next.js SSR    │    Expo App      │    FastAPI Backend    │
└─────────────────────────────────────────────────────────────┘
                              ↓ ↑ REST/SSE/WS
┌─────────────────────────────────────────────────────────────┐
│                     服务层 (Service Layer)                   │
│   LLM Service    │    TTS Service   │    Payment Service    │
│   LangGraph      │    LiteLLM       │    OSS Storage        │
└─────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                     数据层 (Data Layer)                      │
│   PostgreSQL     │    Redis Cache   │    IndexedDB/MMKV     │
└─────────────────────────────────────────────────────────────┘
```

## 子系统划分

### 1. 主项目 (packages/main-project)

| 组件 | 说明 |
|------|------|
| Next.js 16 App Router | SSR/SSG 服务端渲染 |
| React 19 组件 | UI 组件库 |
| Zustand Store | 状态管理 |
| LangGraph 编排 | 多智能体讨论 |
| Vercel AI SDK | LLM 统一调用 |
| WebSocket Client | 实时协作 |

### 2. 移动端 (packages/mobile)

| 组件 | 说明 |
|------|------|
| Expo App | React Native 框架 |
| expo-router | 文件路由 |
| Skia Canvas | 高性能渲染 |
| MMKV Storage | 本地存储 |
| SecureStore | Token 存储 |

### 3. Python 后端 (packages/server-python)

| 组件 | 说明 |
|------|------|
| FastAPI Routes | REST API 端点 |
| LangChain Services | LLM 集成服务 |
| LangGraph Orchestration | 多智能体编排 |
| PostgreSQL Models | ORM 数据模型 |
| Redis Manager | 缓存 + WebSocket 状态 |

### 4. 协作系统

| 组件 | 说明 |
|------|------|
| WebSocket Server | 实时通信 |
| CRDT Engine | 冲突解决 |
| Redis Pub/Sub | 消息分发 |

## 数据流设计

### 课程生成流程

```
用户上传文档 → FastAPI 解析 → LangChain 分析 → 生成大纲
→ SSE 推送进度 → 逐场景生成（幻灯片、问答、互动）
→ TTS 合成 → 存储到 PostgreSQL → 推送完成通知
```

### 课程播放流程

```
用户请求播放 → Next.js 加载课程数据 → Zustand 初始化状态
→ 播放引擎启动 → 场景渲染 → 白板初始化 → 笔记同步
```

### 多智能体讨论流程

```
用户发起讨论 → LangGraph 状态机启动 → 角色 A 发言
→ SSE 流式推送 → 角色 B 回应 → 用户参与 → 循环讨论
```

### 协作流程

```
用户 A 绘制白板 → WebSocket 发送操作 → CRDT 合并
→ Redis 广播 → 用户 B/C 收到 → 白板更新
```

### Token/积分流程

```
用户购买 Token → 微信/支付宝支付 → FastAPI 验证
→ PostgreSQL 更新余额 → 推送通知
```

## 技术选型理由

| 技术 | 选型理由 |
|------|---------|
| Next.js 16 | App Router SSR、Vercel 部署友好 |
| React 19 | 最新性能优化、并发渲染 |
| Zustand | 轻量级状态管理、无 Provider |
| LangGraph | 多智能体编排、状态机驱动 |
| LiteLLM | 统一 LLM 接口、支持多提供商 |
| Expo | React Native 开发友好、跨平台 |
| Skia | 高性能 Canvas 渲染 |
| FastAPI | 异步 Python、高性能 API |
| PostgreSQL | 关系型数据、JSONB 支持 |
| Redis | 缓存 + WebSocket 状态 |
| CRDT (Yjs) | 冲突解决、实时协作 |

## 设计原则

### 1. 模块化设计

- 各子系统独立开发、独立部署
- API 契约驱动开发
- 共享类型定义

### 2. 数据隔离

- 用户私有数据严格隔离
- 协作数据按课堂隔离
- API 层权限验证

### 3. 性能优化

- SSR 首屏优化
- 缓存策略（Redis + IndexedDB）
- 代码分割（Next.js 自动）
- Skia 高性能渲染

### 4. 安全设计

- JWT Token 认证
- HTTPS 通信加密
- API 权限验证
- 数据加密存储

### 5. 可扩展性

- LLM 提供商抽象
- 支付网关抽象
- WebSocket 连接池
- Redis 消息队列

## 部署架构

### Vercel 部署（Next.js）

| 环境 | 说明 |
|------|------|
| Production | 自动部署 main 分支 |
| Preview | 自动部署 PR |

### Docker 部署（FastAPI）

```yaml
services:
  fastapi:
    build: ./packages/server-python
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgres://...
      REDIS_URL: redis://...
  postgres:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7
```

### Expo 发布（Mobile）

| 平台 | 发布方式 |
|------|---------|
| iOS | Expo EAS Build + App Store |
| Android | Expo EAS Build + Play Store |

## 监控与日志

| 指标 | 工具 |
|------|------|
| API 性能 | Vercel Analytics |
| 错误追踪 | Sentry |
| WebSocket 状态 | Redis Metrics |
| 数据库性能 | PostgreSQL Logs |