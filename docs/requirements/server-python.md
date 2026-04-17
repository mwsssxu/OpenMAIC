# Python 后端需求 (packages/server-python)

## 概述

FastAPI Python 后端，提供用户认证、课程生成、AI 交互、协作服务、Token/积分管理、问答系统等核心 API。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115.x | REST API 框架 |
| PostgreSQL | 16.x | 主数据库 |
| Redis | 7.x | 缓存 + WebSocket 状态 |
| SQLAlchemy | 2.x | ORM |
| Alembic | 1.x | 数据库迁移 |
| LangChain | 0.3.x | LLM 集成 |
| LangGraph | 0.2.x | 多智能体编排 |
| LiteLLM | 1.x | LLM 统一接口 |
| asyncpg | 0.30.x | PostgreSQL 异步驱动 |
| uvicorn | 0.32.x | ASGI 服务器 |

## API 路由设计

### /api/auth - 认证路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /register | POST | 用户注册 |
| /login | POST | 用户登录 |
| /refresh | POST | Token 刷新 |
| /logout | POST | 用户退出 |
| /me | GET | 获取当前用户 |
| /me | PUT | 更新用户资料 |

**详细需求**:
- 注册：邮箱验证码、密码强度验证
- 登录：返回 access_token、refresh_token、user 信息
- Token：JWT 格式，HS256 箾名
- 密码：bcrypt 哈希，salt 自动生成

### /api/classrooms - 课程路由

| 端点 | 方法 | 说明 |
|------|------|------|
| / | POST | 创建课程 |
| / | GET | 课程列表 |
| /{id} | GET | 课程详情 |
| /{id}/scenes | GET | 场景列表 |
| /{id}/generate | POST | 异步生成课程 |
| /{id}/status | GET | 生成状态查询 |

**详细需求**:
- 创建：消耗 Token（10-50 Token）
- 生成：
  - 异步任务，返回 job_id
  - SSE 推送进度
  - 支持暂停/恢复
- 场景：幻灯片、问答、互动、PBL

### /api/chat - 讨论路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /{classroom_id} | POST | 发起讨论 |
| /{classroom_id}/stream | GET | SSE 流式讨论 |
| /{classroom_id}/history | GET | 讨论历史 |

**详细需求**:
- 讨论：消耗 Token（1 Token/轮）
- 流式：SSE 推送 AI 响应
- 多智能体：LangGraph 编排不同角色
- 历史记录：JSON 时间线格式

### /api/generate - 生成路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /outline | POST | 生成大纲 |
| /scene | POST | 生成场景 |
| /image | POST | 生成图片 |
| /tts | POST | TTS 合成 |

**详细需求**:
- 大纲生成：
  - 输入：文档内容或主题描述
  - 输出：章节结构、知识点列表
  - LLM：GPT-4o 或 Claude
- 场景生成：
  - 输入：大纲项
  - 输出：幻灯片内容、互动脚本
- 图片生成：DALL-E 3 或 Stable Diffusion
- TTS：OpenAI TTS 或 MiniMax TTS

### /api/collaboration - 协作路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /{classroom_id}/join | POST | 加入课堂 |
| /{classroom_id}/leave | POST | 退出课堂 |
| /{classroom_id}/invite | POST | 生成邀请链接 |
| ws://{classroom_id} | WS | WebSocket 连接 |

**详细需求**:
- WebSocket 消息类型：
  - whiteboard_update: 白板绘制更新
  - cursor_move: 光标位置更新
  - chat_message: 聊天消息
  - user_join/leave: 用户状态
- CRDT：解决并发编辑冲突
- Redis：存储课堂连接状态

### /api/tokens - Token 路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /balance | GET | Token 余额 |
| /purchase | POST | 购买 Token |
| /transactions | GET | 交易流水 |
| /exchange | POST | 积分兑换 Token |

**详细需求**:
- 购买：
  - 微信支付/支付宝回调验证
  - 入账后 Token 余额更新
- 兑换：
  - 100 积分 → 10 Token
  - 最小兑换 100 积分
- 交易流水：
  - 时间、类型、金额、余额

### /api/points - 积分路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /balance | GET | 积分余额 |
| /earn | POST | 赚取积分 |
| /transactions | GET | 积分流水 |

**详细需求**:
- 赚取场景：
  - 完成课程（10-50积分）
  - 每日签到（5积分，连续递增）
  - 问答被采纳（10积分）
  - 笔记被购买（70%收益）
- 流水：时间、来源、积分、余额

### /api/questions - 问答路由

| 端点 | 方法 | 说明 |
|------|------|------|
| / | POST | 发布问题 |
| / | GET | 问题列表 |
| /{id} | GET | 问题详情 |
| /{id}/answers | POST | 提交回答 |
| /{id}/accept | POST | 采纳答案 |

**详细需求**:
- 发布：
  - 消耗积分（悬赏积分）
  - 标题、内容、分类
- 回答：文字、可选图片
- 采纳：
  - 积分流转（90% 回答者，10% 平台）
  - 采纳后不可更改
- 反作弊：抄袭检测、刷分检测

### /api/notes - 笔记路由

| 端点 | 方法 | 说明 |
|------|------|------|
| / | POST | 发布笔记 |
| / | GET | 笔记市场 |
| /{id} | GET | 笔记详情 |
| /{id}/purchase | POST | 购买笔记 |

**详细需求**:
- 发布：
  - Markdown 格式
  - 设置可见范围（公开/付费/匹配）
  - 设置价格（付费模式）
- 购买：
  - 积分支付
  - 笔记解锁永久可见
- 收益：
  - 作者 70%，平台 30%
  - 实时更新收益统计

### /api/invitations - 邀请路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /code | GET | 获取邀请码 |
| /stats | GET | 邀请统计 |
| /accept | POST | 接受邀请 |

**详细需求**:
- 邀请码：nanoid 生成，用户唯一
- 奖励发放：
  - 一级邀请：邀请人 20积分+50Token，被邀请人 100Token
  - 二级邀请：邀请人 10积分
  - 三级邀请：邀请人 5积分
- 统计：邀请人数、注册人数、活跃人数

### /api/streaks - 打卡路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /checkin | POST | 每日打卡 |
| /status | GET | 打卡状态 |
| /history | GET | 打卡历史 |

**详细需求**:
- 打卡：
  - 学习 15min 即打卡成功
  - 奖励递增（第2天+5，第7天+30）
- 断签保护：
  - 积分购买（50积分）
  - 保护 1 天

### /api/tasks - 任务路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /daily | GET | 每日任务列表 |
| /complete | POST | 完成任务 |

**详细需求**:
- 任务类型：
  - 完成 1 课程（10积分）
  - 参与讨论 1 次（5积分）
  - 回答问题 1 次（5积分）
  - 学习 30min（10积分）
- 重置：每日 00:00 重置任务状态

### /api/leagues - 联赛路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /current | GET | 当前联赛状态 |
| /rankings | GET | 联赛排名 |

**详细需求**:
- 联赛等级：
  - 铜牌（积分 0-100）
  - 银牌（积分 101-500）
  - 金牌（积分 501-1500）
  - 钬石（积分 1501-3000）
  - 大师（积分 3001-5000）
  - 冠军（积分 5001+）
- 升降级：每周积分排名，前 10% 升级，后 10% 降级

### /api/badges - 徽章路由

| 端点 | 方法 | 说明 |
|------|------|------|
| / | GET | 用户徽章列表 |
| /unlock | POST | 解锁徽章（系统触发） |

**详细需求**:
- 徽章类型：
  - 学习类：完成 10 课程、连续 30 天打卡
  - 社交类：邀请 10 人、回答被采纳 20 次
  - 特殊类：首购、年度活跃
- 解锁条件：系统自动检测触发

### /api/buddies - 学习搭子路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /current | GET | 当前搭子信息 |
| /messages | GET | 搭子消息 |
| /interact | POST | 与搭子互动 |

**详细需求**:
- 搭子类型：
  - 激励型、竞争型、陪伴型、吐槽型、知识型、默契型
- 消息生成：
  - LiteLLM 调用不同模型
  - 情绪触发：打卡、完成任务、断签
- 进度同步：搭子虚拟学习进度

### /api/matches - 学习匹配路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /recommend | GET | 推荐匹配用户 |
| /notes | GET | 匹配用户笔记 |

**详细需求**:
- 匹配算法：
  - 基于课程 ID、知识点标签、学习进度
  - 相似度计算（Jaccard 相似度）
- 推荐：优先匹配进度相近、知识点重叠度高的用户

### /api/payment - 支付路由

| 端点 | 方法 | 说明 |
|------|------|------|
| /create-order | POST | 创建订单 |
| /verify | POST | 支付回调验证 |
| /orders | GET | 订单列表 |

**详细需求**:
- 微信支付：
  - 创建订单 → 返回支付参数
  - 回调验证签名 → 入账
- 支付宝：
  - 创建订单 → 返回支付链接
  - 回调验证签名 → 入账
- 订单状态：created → paid → cancelled

## 数据库设计

### 用户表 (users)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| email | VARCHAR(255) | 邮箱（唯一） |
| password_hash | VARCHAR(255) | 密码哈希 |
| nickname | VARCHAR(100) | 昵称 |
| avatar_url | VARCHAR(500) | 头像 URL |
| invitation_code | VARCHAR(20) | 邀请码 |
| invited_by | UUID | 邀请人 ID |
| created_at | TIMESTAMP | 创建时间 |

### Token 账户表 (token_accounts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| balance | INTEGER | Token 余额 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 积分账户表 (point_accounts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| balance | INTEGER | 积分余额 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### Token 交易表 (token_transactions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| type | VARCHAR(50) | 类型（purchase/exchange/spend/reward） |
| amount | INTEGER | 金额 |
| balance_after | INTEGER | 交易后余额 |
| description | TEXT | 描述 |
| created_at | TIMESTAMP | 时间 |

### 积分交易表 (point_transactions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| source | VARCHAR(50) | 来源（course/daily/qanda/notes/invitation） |
| amount | INTEGER | 积分 |
| balance_after | INTEGER | 交易后余额 |
| created_at | TIMESTAMP | 时间 |

### 课程表 (classrooms)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 创建者 ID |
| title | VARCHAR(200) | 标题 |
| description | TEXT | 描述 |
| outline | JSONB | 大纲结构 |
| scenes | JSONB | 场景列表 |
| status | VARCHAR(20) | 状态（draft/generating/completed） |
| created_at | TIMESTAMP | 创建时间 |

### 问题表 (questions)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 提问者 ID |
| title | VARCHAR(200) | 标题 |
| content | TEXT | 内容 |
| category | VARCHAR(50) | 分类 |
| bounty | INTEGER | 悬赏积分 |
| status | VARCHAR(20) | 状态（open/answered/resolved） |
| created_at | TIMESTAMP | 创建时间 |

### 回答表 (answers)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| question_id | UUID | 问题 ID |
| user_id | UUID | 回答者 ID |
| content | TEXT | 内容 |
| is_accepted | BOOLEAN | 是否被采纳 |
| created_at | TIMESTAMP | 创建时间 |

### 笔记表 (notes)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 作者 ID |
| classroom_id | UUID | 课程 ID（可选） |
| content | TEXT | Markdown 内容 |
| visibility | VARCHAR(20) | 可见性（public/paid/match） |
| price | INTEGER | 价格（付费模式） |
| created_at | TIMESTAMP | 创建时间 |

### 打卡表 (streaks)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| checkin_date | DATE | 打卡日期 |
| streak_count | INTEGER | 连续天数 |
| created_at | TIMESTAMP | 创建时间 |

### 徽章表 (badges)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| badge_type | VARCHAR(50) | 徽章类型 |
| unlocked_at | TIMESTAMP | 解锁时间 |

### 订单表 (orders)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户 ID |
| amount | DECIMAL | 金额 |
| token_amount | INTEGER | Token 数量 |
| payment_method | VARCHAR(20) | 支付方式 |
| status | VARCHAR(20) | 状态 |
| created_at | TIMESTAMP | 创建时间 |

## 性能需求

| 指标 | 目标 |
|------|------|
| API 响应 | < 200ms（非 AI） |
| 并发连接 | 10,000+ WebSocket |
| 数据库查询 | < 50ms |
| Redis 缓存命中率 | > 90% |

## 安全需求

| 需求 | 说明 |
|------|------|
| JWT 安全 | HS256 签名，24h 有效期 |
| 密码哈希 | bcrypt + salt |
| HTTPS | 所有通信加密 |
| CORS | 白名单域名 |
| Rate Limiting | API 频率限制 |
| SQL 注入防护 | SQLAlchemy 参数化 |