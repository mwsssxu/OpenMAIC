# OpenMAIC Python 后端

基于 FastAPI + PostgreSQL + Redis 的多智能体交互课堂 API 服务。

## 功能

- 用户认证（JWT Token、OAuth 占位）
- 课程 CRUD
- 大纲/场景生成（AI 驱动）
- WebSocket 多人课堂（含速率限制）
- Token/积分经济系统
- 多智能体（商业策略 Agent）
- 成就系统
- 打卡系统
- 分享功能
- Redis 缓存优化

## 开发
```
docker compose build python-server --no-cache 
docker compose up -d python-server
```
```bash
# 安装依赖
pip install -r requirements.txt

# 数据库迁移
alembic upgrade head

# 启动开发服务器
uvicorn app.main:app --reload --port 8000

docker服务，根目录执行：
更新升级：docker compose build python-server --no-cache

# 生产启动
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 配置

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL=postgres://maic:password@localhost:5432/maic

# Redis
REDIS_URL=redis://localhost:6379

# JWT
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# LLM 提供商
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
DEFAULT_MODEL=openai:gpt-4o

# CORS
ALLOWED_ORIGINS=http://localhost:3030,http://localhost:3000
```

## 目录结构

```
app/
├── core/               # 核心配置
│   ├── config.py       # 环境变量配置
│   ├── redis.py        # Redis 客户端和缓存函数
│   └── security.py     # 安全工具
├── db/                 # 数据库
│   ├── database.py     # 连接池
│   └── models.py       # 数据模型
├── middleware/         # 中间件
│   └── auth.py         # 认证中间件
├── routes/             # API 路由
│   ├── auth.py         # 认证
│   ├── classrooms.py   # 课程
│   ├── tokens.py       # Token 管理
│   ├── points.py       # 积分管理
│   └── classroom_sessions.py  # 多人课堂 WebSocket
├── services/           # 业务服务
│   ├── generation/     # 课程生成
│   └── orchestration/  # 多智能体编排
└── main.py             # FastAPI 入口
alembic/                # 数据库迁移
tests/                  # 测试
```

## API 路由

| 路径 | 功能 |
|------|------|
| `/auth` | 用户认证 |
| `/classrooms` | 课程 CRUD |
| `/generate` | 课程生成 |
| `/chat` | 多智能体讨论 |
| `/tokens` | Token 管理（含兑换档位） |
| `/points` | 积分管理 |
| `/subscriptions` | 会员订阅 |
| `/sessions` | 多人课堂 WebSocket |
| `/achievements` | 成就系统 |
| `/checkin` | 打卡系统 |
| `/sharing` | 课程分享 |
| `/questions` | 问答悬赏 |
| `/answers` | 回答管理 |
| `/invitations` | 邀请系统 |
| `/payment` | 支付系统 |
| `/buddy` | 学习搭子 |
| `/notes` | 共享笔记 |
| `/matching` | 学习匹配 |
| `/gamification` | 游戏化增强 |

## Redis 缓存

用于以下场景：

- Token/积分余额缓存（5 分钟）
- Session 状态缓存（24 小时）
- WebSocket 房间状态缓存（2 小时）
- 分布式速率限制

## 安全措施

- JWT Token 验证 + 自动刷新
- WebSocket 消息速率限制（10/秒）
- 消息长度限制（1000 字符）
- 房间容量限制（50 人）
- XSS 清理函数
- 行级数据库锁（FOR UPDATE）
- Token 不在 URL 传递