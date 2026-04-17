# OpenMAIC 管理后台

基于 Next.js 16 + React 19 的管理后台系统。

## 功能

- 用户管理：列表、详情、操作（禁用/调整积分）
- 内容审核：问题、回答、笔记审核
- 数据统计：用户统计、课程统计、经济统计
- 系统配置：LLM配置、价格配置、规则配置
- 操作日志：管理员操作记录

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建
pnpm build

# 启动生产服务
pnpm start
```

## 配置

创建 `.env.local` 配置后端 API 地址：

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
ADMIN_SECRET_KEY=your-admin-secret-key
```

## 目录结构

```
app/
├── (dashboard)/       # 仪表盘布局
│   ├── users/         # 用户管理
│   ├── content/       # 内容审核
│   ├── statistics/    # 数据统计
│   ├── settings/      # 系统配置
│   └── logs/          # 操作日志
├── login/             # 登录页面
└── layout.tsx         # 根布局
lib/
├── api-client/        # API 客户端
├── auth/              # 认证逻辑
└── store/             # 状态管理
components/
├── sidebar/           # 侧边导航
├── charts/            # 统计图表
└── tables/            # 数据表格
```

## 页面路由

| 路径 | 功能 |
|------|------|
| `/login` | 管理员登录 |
| `/` | 仪表盘总览 |
| `/users` | 用户列表 |
| `/users/{id}` | 用户详情 |
| `/content/questions` | 问题审核 |
| `/content/answers` | 回答审核 |
| `/content/notes` | 笔记审核 |
| `/statistics/users` | 用户统计 |
| `/statistics/classrooms` | 课程统计 |
| `/statistics/economy` | 经济统计 |
| `/settings/llm` | LLM 配置 |
| `/settings/pricing` | 价格配置 |
| `/settings/rules` | 规则配置 |
| `/logs` | 操作日志 |