# 管理后台开发计划

## Overview

OpenMAIC 管理后台提供运营数据可视化、用户管理、课程管理、财务管理等功能。本文档规划 Web 端管理后台的开发方案。

## Current State Analysis

### Backend (已完成)

- `/admin/stats` - Dashboard 统计数据
- `/admin/users` - 用户列表与管理
- `/admin/courses` - 课程管理
- `/admin/economy` - 经济系统监控
- `/admin/logs` - 操作日志
- `/admin/auth` - 管理员认证 (JWT + RBAC)

### Database Models (已存在)

- `Admin` - 管理员账户
- `AdminRole` - 角色
- `AdminRoleAssignment` - 角色分配
- `AdminPermission` - 权限
- `AdminSession` - 会话管理
- `LoginLog` - 登录日志

## Tech Stack Decision

### Option A: React Admin (推荐)

- 使用 `react-admin` 框架
- 优点: 开箱即用的管理后台组件、内置 CRUD、数据表格、图表集成
- 缺点: 需要学习框架 API
- 适合: 快速开发标准管理功能

### Option B: 自定义 React + Tailwind

- 使用 React + Tailwind CSS + Chart.js
- 优点: 完全自定义、灵活性高
- 缺点: 需要手动实现所有组件
- 适合: 需要独特 UI 设计的场景

### 决策: 使用 React Admin

理由: 管理后台功能标准化程度高，React Admin 能大幅缩短开发时间，且与现有 FastAPI 后端对接简单。

## Architecture

```
packages/admin-web/
├── src/
│   ├── App.tsx              # 主应用入口
│   ├── authProvider.ts      # 认证 Provider
│   ├── dataProvider.ts      # API 数据 Provider
│   ├── resources/
│   │   ├── users/           # 用户管理
│   │   ├── courses/         # 课程管理
│   │   ├── economy/         # 经济系统
│   │   ├── logs/            # 操作日志
│   │   └── admins/          # 管理员管理
│   ├── dashboard/           # Dashboard 页面
│   └── components/          # 共享组件
├── package.json
└── vite.config.ts
```

## Implementation Plan

### Phase 1: Infrastructure (Day 1)

1. 创建 `packages/admin-web` 目录
2. 安装 React Admin + Vite
3. 配置 `dataProvider` 连接 FastAPI
4. 实现 `authProvider` (JWT 认证)
5. 创建登录页面

### Phase 2: Dashboard (Day 2)

1. Dashboard 统计卡片:
   - 用户总数/今日新增/今日活跃
   - 课程总数/今日生成
   - 今日收入/Token 采购/积分发放
2. 图表:
   - 用户增长趋势 (折线图)
   - 课程生成分布 (柱状图)
   - 收入趋势 (折线图)
3. 快捷操作入口

### Phase 3: User Management (Day 3)

1. 用户列表页:
   - 搜索 (email/nickname)
   - 筛选 (tier/status)
   - 分页
2. 用户详情页:
   - 基本信息
   - Token/积分余额
   - 课程完成记录
   - 活跃度统计
3. 用户操作:
   - 调整积分/Token
   - 修改订阅状态
   - 禁用/启用账户

### Phase 4: Course Management (Day 4)

1. 课程列表:
   - 搜索标题
   - 按用户筛选
   - 查看生成状态
2. 课程详情:
   - 场景列表
   - 用户完成率
   - 评分统计

### Phase 5: Economy & Logs (Day 5)

1. 经济监控:
   - Token 交易流水
   - 积分交易流水
   - 支付订单记录
2. 操作日志:
   - 管理员操作记录
   - 登录日志查询

### Phase 6: Admin Management (Day 6)

1. 管理员列表
2. 角色管理
3. 权限配置
4. 会话管理

## API Endpoints Required

已存在的端点:
- `GET /admin/stats` - Dashboard 统计
- `GET /admin/users` - 用户列表
- `GET /admin/users/{id}` - 用户详情
- `PUT /admin/users/{id}` - 更新用户
- `GET /admin/courses` - 课程列表
- `GET /admin/economy` - 经济数据
- `GET /admin/logs` - 操作日志

需补充的端点:
- `POST /admin/users/{id}/adjust-balance` - 调整余额
- `GET /admin/users/{id}/courses` - 用户课程详情
- `GET /admin/economy/transactions` - 交易流水
- `GET /admin/admins` - 管理员列表
- `POST /admin/admins` - 创建管理员

## UI/UX Design

- 主题: 现代简洁风格，参考 Ant Design Pro
- 颜色: 白色背景 + 蓝色强调色
- 响应式: 优先桌面端，移动端可用
- 语言: 支持中文/英文切换

## Security Requirements

1. JWT 认证 + 8小时会话过期
2. RBAC 权限控制:
   - `super_admin`: 所有权限
   - `admin`: 用户管理、课程查看
   - `viewer`: 只读访问
3. 操作审计日志
4. HTTPS + CORS 白名单

## Testing Strategy

1. 单元测试: 关键组件测试
2. E2E 测试: 登录流程、核心操作
3. API 集成测试: 后端联调

## Timeline Summary

| Phase | Duration | Tasks |
|-------|----------|-------|
| 1 | Day 1 | 项目搭建、认证 |
| 2 | Day 2 | Dashboard |
| 3 | Day 3 | 用户管理 |
| 4 | Day 4 | 课程管理 |
| 5 | Day 5 | 经济/日志 |
| 6 | Day 6 | 管理员管理 |
| **Total** | **6 days** | |

## Why: 业务规模增长需要集中化的运营管理工具

## How to apply: 按阶段顺序开发，每阶段完成后进行测试验收