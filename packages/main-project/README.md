# OpenMAIC 主项目

基于 Next.js 16 + React 19 + Tailwind CSS 4 的多智能体交互课堂前端。

## 功能

- 用户认证（登录、注册、Token 刷新）
- 课程列表、创建、播放
- WebSocket 多人课堂协作
- 白板实时同步（CRDT）
- Token/积分余额实时显示
- 活泼渐变配色风格

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建
pnpm build

# 运行生产服务器
pnpm start

# E2E 测试
pnpm test:e2e
```

## 配置

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:8000
```

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # 认证页面（登录、注册）
│   ├── (main)/             # 主页面（首页、课程）
│   └── globals.css         # 全局样式
├── components/             # React 组件
│   ├── collaboration/      # 协作组件（白板、聊天）
│   └── ui/                 # UI 基础组件
└── lib/                    # 核心逻辑
    ├── stores/             # Zustand 状态管理
    ├── websocket/          # WebSocket 客户端
    ├── api-client.ts       # Python 后端 API 客户端
    └── auth-context.tsx    # 认证 Context
tests/e2e/                  # Playwright E2E 测试
```

## 页面路由

| 路径 | 功能 |
|------|------|
| `/` | 首页 |
| `/login` | 登录 |
| `/register` | 注册 |
| `/classrooms` | 课程列表 |
| `/classrooms/create` | 创建课程 |
| `/classrooms/[id]` | 课程播放 |

## 状态管理

使用 Zustand 管理状态：

- `useUserStore` - 用户状态、Token/积分余额
- `useClassroomStore` - 课程列表、当前课程
- `usePlaybackStore` - 播放状态、场景索引、白板元素、笔记

## WebSocket 协作

- `CollaborationClient` - WebSocket 客户端
- `WhiteboardSync` - CRDT 白板同步（基于 Yjs）
- 支持聊天、白板绘制、场景切换、表情反应