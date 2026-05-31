# 问答悬赏系统 - 完整功能文档

## 📋 目录

1. [功能概述](#功能概述)
2. [数据库结构](#数据库结构)
3. [API接口文档](#api接口文档)
4. [前端页面](#前端页面)
5. [使用流程](#使用流程)
6. [部署指南](#部署指南)
7. [测试用例](#测试用例)

---

## 功能概述

问答悬赏系统是一个完整的知识问答平台，支持用户发布问题、设置悬赏积分、回答问题、投票和采纳答案。

### 核心功能

- ✅ **问题发布**：支持标题、内容、悬赏积分、标签
- ✅ **悬赏系统**：积分悬赏，采纳后自动发放（90%给回答者）
- ✅ **回答系统**：提交回答、投票、采纳
- ✅ **排序筛选**：最新、最高悬赏、最热门
- ✅ **响应式设计**：手机列表视图、平板网格视图
- ✅ **安全防护**：XSS防护、权限验证、事务保证

---

## 数据库结构

### 📊 表结构概览

系统包含3张核心表：
- `questions` - 问题表
- `answers` - 回答表
- `answer_votes` - 回答投票表

### questions 表

**用途**：存储问题信息

```sql
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    bounty INTEGER DEFAULT 0,
    bounty_status VARCHAR(20) DEFAULT 'open',
    tags TEXT,
    view_count INTEGER DEFAULT 0,
    answer_count INTEGER DEFAULT 0,
    accepted_answer_id UUID,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
```

**字段说明：**

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | 自动生成 |
| user_id | UUID | 发布者ID | 外键 → users |
| title | VARCHAR(255) | 问题标题 | 必填 |
| content | TEXT | 问题内容 | 必填 |
| bounty | INTEGER | 悬赏积分 | 默认0 |
| bounty_status | VARCHAR(20) | 悬赏状态 | open/closed |
| tags | TEXT | 标签（JSON数组） | 可选 |
| view_count | INTEGER | 浏览数 | 默认0 |
| answer_count | INTEGER | 回答数 | 默认0 |
| accepted_answer_id | UUID | 采纳的答案ID | 外键 → answers |
| created_at | TIMESTAMP | 创建时间 | 自动生成 |
| updated_at | TIMESTAMP | 更新时间 | 自动更新 |

**索引：**
- `ix_questions_user_id` - 用户ID索引
- `ix_questions_created_at` - 创建时间索引（降序）
- `ix_questions_bounty` - 悬赏积分索引（降序）
- `ix_questions_bounty_status` - 悬赏状态索引

---

### answers 表

**用途**：存储回答信息

```sql
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    rating DECIMAL(3,2) DEFAULT 0,
    vote_count INTEGER DEFAULT 0,
    is_accepted BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);
```

**字段说明：**

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | 自动生成 |
| question_id | UUID | 问题ID | 外键 → questions |
| user_id | UUID | 回答者ID | 外键 → users |
| content | TEXT | 回答内容 | 必填 |
| rating | DECIMAL(3,2) | 评分 | 默认0 |
| vote_count | INTEGER | 投票数 | 默认0 |
| is_accepted | BOOLEAN | 是否被采纳 | 默认false |
| accepted_at | TIMESTAMP | 采纳时间 | 可选 |
| created_at | TIMESTAMP | 创建时间 | 自动生成 |
| updated_at | TIMESTAMP | 更新时间 | 自动更新 |

**索引：**
- `ix_answers_question_id` - 问题ID索引
- `ix_answers_user_id` - 用户ID索引
- `ix_answers_vote_count` - 投票数索引（降序）
- `ix_answers_is_accepted` - 采纳状态索引

---

### answer_votes 表

**用途**：存储回答投票记录

```sql
CREATE TABLE answer_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id UUID NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(answer_id, user_id)
);
```

**字段说明：**

| 字段 | 类型 | 说明 | 约束 |
|------|------|------|------|
| id | UUID | 主键 | 自动生成 |
| answer_id | UUID | 回答ID | 外键 → answers |
| user_id | UUID | 投票者ID | 外键 → users |
| vote | INTEGER | 投票值 | 1(赞成)/-1(反对) |
| created_at | TIMESTAMP | 创建时间 | 自动生成 |

**约束：**
- `uq_answer_votes_answer_user` - 唯一约束（answer_id, user_id），防止重复投票

---

## API接口文档

### 基础信息

- **Base URL**: `http://localhost:8000`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

---

### 1. 发布问题

**接口**: `POST /questions`

**权限**: 需要登录

**请求参数**:
```json
{
  "title": "string (必填, 最长255字符)",
  "content": "string (必填, 最长5000字符)",
  "bounty": "integer (可选, 默认0, 最小10, 最大10000)",
  "tags": "string (可选, JSON数组字符串)"
}
```

**响应示例**:
```json
{
  "id": "uuid",
  "title": "问题标题",
  "bounty": 100,
  "bounty_status": "open",
  "message": "问题已发布"
}
```

**错误码**:
- `400` - 标题或内容为空、积分不足、悬赏金额不合法
- `401` - 未登录

---

### 2. 获取问题列表

**接口**: `GET /questions`

**权限**: 需要登录

**请求参数**:
- `page` (int, 可选) - 页码，默认1
- `limit` (int, 可选) - 每页数量，默认20
- `status` (string, 可选) - 悬赏状态筛选
- `tags` (string, 可选) - 标签筛选
- `sort` (string, 可选) - 排序方式：recent/bounty/hot，默认recent

**响应示例**:
```json
{
  "items": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "user_nickname": "用户昵称",
      "title": "问题标题",
      "content": "问题内容预览（前200字符）...",
      "bounty": 100,
      "bounty_status": "open",
      "tags": "[\"Python\", \"算法\"]",
      "view_count": 256,
      "answer_count": 5,
      "has_accepted": false,
      "created_at": "2026-05-28T10:00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

---

### 3. 获取问题详情

**接口**: `GET /questions/{question_id}`

**权限**: 需要登录

**路径参数**:
- `question_id` (string) - 问题ID

**响应示例**:
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "user_nickname": "用户昵称",
  "title": "问题标题",
  "content": "完整问题内容",
  "bounty": 100,
  "bounty_status": "open",
  "tags": "[\"Python\", \"算法\"]",
  "view_count": 257,
  "answer_count": 5,
  "accepted_answer_id": null,
  "created_at": "2026-05-28T10:00:00",
  "updated_at": null
}
```

**注意**: 每次访问自动增加浏览数

---

### 4. 提交回答

**接口**: `POST /answers`

**权限**: 需要登录

**请求参数**:
```json
{
  "question_id": "uuid (必填)",
  "content": "string (必填, 最长10000字符)"
}
```

**响应示例**:
```json
{
  "id": "uuid",
  "question_id": "uuid",
  "content": "回答内容",
  "message": "回答已提交"
}
```

**错误码**:
- `400` - 问题不存在、问题已关闭、不能回答自己的问题
- `401` - 未登录

---

### 5. 获取回答列表

**接口**: `GET /answers/question/{question_id}`

**权限**: 需要登录

**路径参数**:
- `question_id` (string) - 问题ID

**查询参数**:
- `page` (int, 可选) - 页码，默认1
- `limit` (int, 可选) - 每页数量，默认20
- `sort` (string, 可选) - 排序：recent/votes/accepted，默认recent

**响应示例**:
```json
{
  "items": [
    {
      "id": "uuid",
      "question_id": "uuid",
      "user_id": "uuid",
      "user_nickname": "回答者昵称",
      "content": "回答内容",
      "rating": 4.5,
      "vote_count": 15,
      "is_accepted": false,
      "accepted_at": null,
      "created_at": "2026-05-28T11:00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "total_pages": 1
  }
}
```

---

### 6. 投票回答

**接口**: `POST /answers/{answer_id}/vote`

**权限**: 需要登录

**路径参数**:
- `answer_id` (string) - 回答ID

**请求参数**:
```json
{
  "vote": 1  // 1:赞成, -1:反对
}
```

**响应示例**:
```json
{
  "vote": 1,
  "vote_count": 16,
  "message": "投票已记录"
}
```

**错误码**:
- `400` - 回答不存在、不能给自己的回答投票
- `401` - 未登录

---

### 7. 采纳答案

**接口**: `POST /answers/{answer_id}/accept`

**权限**: 需要登录（仅问题作者）

**路径参数**:
- `answer_id` (string) - 回答ID

**响应示例**:
```json
{
  "answer_id": "uuid",
  "bounty_claimed": 100,
  "author_reward": 90,
  "message": "答案已采纳，悬赏积分已发放"
}
```

**业务逻辑**:
1. 更新回答状态为已采纳
2. 关闭问题（bounty_status = 'closed'）
3. 发放悬赏积分（90%给回答者，10%平台）

**错误码**:
- `400` - 回答不存在、回答已被采纳
- `403` - 不是问题作者，无权采纳
- `401` - 未登录

---

## 前端页面

### 1. 问题列表页

**路径**: `packages/mobile/app/(tabs)/questions.tsx`

**功能特性**:
- 🎨 iOS风格设计，紫色主题
- 📊 筛选标签：全部、待回答、已回答、有悬赏
- 🔄 排序：最新、最高悬赏、最热门
- 📱 响应式布局：手机列表、平板网格
- 🔄 下拉刷新
- ➕ 发布问题FAB按钮
- 📄 分页加载

**组件结构**:
```
QuestionsScreen
├── PageHeader (返回、标题、搜索)
├── FilterTabs (筛选标签)
├── SortBar (排序、视图切换)
├── FlatList
│   └── QuestionCard
│       ├── Thumb (缩略图)
│       ├── Info (标题、内容、标签)
│       └── Footer (统计、状态)
└── FAB (发布按钮)
```

---

### 2. 问题详情页

**路径**: `packages/mobile/app/questions/[id].tsx`

**功能特性**:
- 📄 问题完整内容展示
- 💬 回答列表（排序：最新/最高票/已采纳）
- 👍 投票功能（赞成/反对）
- ✅ 采纳答案功能
- ✏️ 提交回答输入框
- 🔄 实时更新统计

**组件结构**:
```
QuestionDetailScreen
├── PageHeader
├── ScrollView
│   ├── QuestionCard (问题详情)
│   ├── SortBar (回答排序)
│   ├── AnswerList
│   │   └── AnswerCard
│   │       ├── Content
│   │       ├── VoteButtons
│   │       ├── AuthorInfo
│   │       └── AcceptButton
│   └── AnswerInput (提交回答)
```

---

### 3. 发布问题页

**路径**: `packages/mobile/app/questions/create.tsx`

**功能特性**:
- ✏️ 标题输入（字数统计）
- 📝 内容输入（字数统计）
- 💎 悬赏设置（快速选择 + 自定义）
- 🏷️ 标签选择（推荐 + 自定义，最多5个）
- ✅ 表单验证
- 💡 发布提示

**组件结构**:
```
CreateQuestionScreen
├── PageHeader (关闭、发布)
├── ScrollView
│   ├── TitleInput
│   ├── ContentInput
│   ├── BountySelector
│   ├── TagSelector
│   └── TipsSection
```

---

## 使用流程

### 用户流程图

```
┌─────────┐
│ 用户登录 │
└────┬────┘
     │
     ▼
┌─────────────┐
│ 浏览问题列表 │
└─────┬───────┘
      │
      ├─────→ 发布问题 ────→ 设置悬赏 ────→ 添加标签 ────→ 提交
      │
      └─────→ 查看问题详情
               │
               ├──→ 回答问题
               │
               ├──→ 投票回答
               │
               └──→ 采纳答案 ────→ 获得积分
```

### 场景示例

#### 场景1：发布悬赏问题

1. 用户点击问题列表页右下角FAB按钮
2. 进入发布页面
3. 输入标题："Python如何实现快速排序？"
4. 输入内容："我需要实现一个快速排序算法..."
5. 选择悬赏积分：100
6. 添加标签：Python、算法
7. 点击"发布"
8. 系统扣减100积分，发布成功

#### 场景2：回答问题并获得悬赏

1. 用户浏览问题列表，看到悬赏100分的问题
2. 点击进入问题详情
3. 查看问题内容和已有回答
4. 在底部输入框填写回答
5. 点击"提交回答"
6. 问题作者看到回答，点击"采纳"
7. 用户获得90积分（100 × 90%）

---

## 部署指南

### 前置要求

- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+

### 1. 数据库部署

**使用Docker Compose**:
```bash
# 启动数据库
docker-compose up -d postgres

# 检查表是否存在
docker exec postgres psql -U postgres -d maic -c "\d questions"
```

**手动执行迁移**（如果表不存在）:
```bash
# 连接数据库
docker exec -it postgres psql -U postgres -d maic

# 执行SQL（从文档复制或使用迁移文件）
\i /path/to/create_qanda_tables.sql
```

### 2. 后端部署

```bash
cd packages/server-python

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接

# 启动服务
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 前端部署

```bash
cd packages/mobile

# 安装依赖
npm install

# 启动开发服务器
npx expo start

# 或使用特定平台
npx expo start --ios
npx expo start --android
```

### 4. 验证部署

**检查API**:
```bash
# 获取问题列表（需要认证）
curl -X GET "http://localhost:8000/questions" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**检查前端**:
- 打开 http://localhost:8081/questions
- 应该看到问题列表页面

---

## 测试用例

### API测试

#### 测试1：发布问题

```bash
curl -X POST "http://localhost:8000/questions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试问题",
    "content": "这是一个测试问题的内容",
    "bounty": 10,
    "tags": "[\"测试\"]"
  }'
```

**预期结果**:
```json
{
  "id": "uuid",
  "title": "测试问题",
  "bounty": 10,
  "bounty_status": "open",
  "message": "问题已发布"
}
```

#### 测试2：获取问题列表

```bash
curl -X GET "http://localhost:8000/questions?page=1&limit=10&sort=recent" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**预期结果**:
- 返回问题列表
- 包含分页信息
- 每个问题包含用户昵称

#### 测试3：提交回答

```bash
curl -X POST "http://localhost:8000/answers" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question_id": "QUESTION_UUID",
    "content": "这是我的回答"
  }'
```

**预期结果**:
```json
{
  "id": "uuid",
  "question_id": "uuid",
  "content": "这是我的回答",
  "message": "回答已提交"
}
```

#### 测试4：投票回答

```bash
curl -X POST "http://localhost:8000/answers/ANSWER_UUID/vote" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"vote": 1}'
```

**预期结果**:
```json
{
  "vote": 1,
  "vote_count": 1,
  "message": "投票已记录"
}
```

#### 测试5：采纳答案

```bash
curl -X POST "http://localhost:8000/answers/ANSWER_UUID/accept" \
  -H "Authorization: Bearer QUESTION_AUTHOR_TOKEN"
```

**预期结果**:
```json
{
  "answer_id": "uuid",
  "bounty_claimed": 10,
  "author_reward": 9,
  "message": "答案已采纳，悬赏积分已发放"
}
```

### 前端测试

#### 测试场景1：问题列表加载

1. 打开问题列表页
2. ✅ 应显示问题列表
3. ✅ 应显示用户昵称
4. ✅ 应显示悬赏徽章
5. ✅ 下拉刷新应正常工作

#### 测试场景2：筛选功能

1. 点击"待回答"标签
2. ✅ 应只显示answer_count=0的问题
3. 点击"有悬赏"标签
4. ✅ 应只显示bounty>0的问题

#### 测试场景3：发布问题

1. 点击FAB按钮
2. 输入标题和内容
3. 选择悬赏积分
4. 点击发布
5. ✅ 应成功跳转回列表页

#### 测试场景4：回答问题

1. 点击问题进入详情页
2. 在底部输入回答
3. 点击提交
4. ✅ 回答应出现在列表中

#### 测试场景5：采纳答案

1. 作为问题作者登录
2. 查看问题的回答
3. 点击"采纳"按钮
4. ✅ 应显示成功提示
5. ✅ 问题状态应变为"已解决"

---

## 故障排查

### 常见问题

#### 1. 数据库连接失败

**症状**: API返回500错误

**检查**:
```bash
# 检查数据库是否运行
docker ps | grep postgres

# 检查连接
docker exec postgres psql -U postgres -d maic -c "SELECT 1"
```

**解决**: 重启数据库容器

#### 2. 表不存在

**症状**: API返回 "relation does not exist"

**检查**:
```bash
docker exec postgres psql -U postgres -d maic -c "\dt"
```

**解决**: 执行数据库迁移脚本

#### 3. 积分不足

**症状**: 发布悬赏问题时提示"积分余额不足"

**检查**:
```sql
SELECT balance FROM point_accounts WHERE user_id = 'USER_UUID';
```

**解决**: 为用户充值积分或减少悬赏金额

#### 4. 权限错误

**症状**: 采纳答案时返回403

**原因**: 只有问题作者可以采纳答案

**解决**: 使用问题作者账号登录

---

## 性能优化建议

### 数据库优化

1. **索引优化**:
   - 已创建必要的索引
   - 定期执行 `ANALYZE` 更新统计信息

2. **查询优化**:
   - 使用分页避免全表扫描
   - 批量获取用户信息避免N+1查询

3. **缓存策略**:
   - 积分余额使用Redis缓存
   - 热门问题列表缓存

### 前端优化

1. **列表优化**:
   - 使用FlatList的虚拟滚动
   - 设置合适的 `initialNumToRender` 和 `maxToRenderPerBatch`

2. **图片优化**:
   - 使用缩略图
   - 图片懒加载

3. **网络优化**:
   - 请求去重
   - 响应缓存

---

## 更新日志

### v1.0.0 (2026-05-28)

**新增功能**:
- ✅ 问题发布、浏览、搜索
- ✅ 悬赏积分系统
- ✅ 回答提交、投票、采纳
- ✅ 标签分类
- ✅ iOS风格UI
- ✅ 响应式布局

**技术栈**:
- 后端: FastAPI + PostgreSQL + Redis
- 前端: React Native + Expo
- 部署: Docker Compose

---

## 联系方式

如有问题或建议，请联系开发团队。

**文档版本**: v1.0.0
**最后更新**: 2026-05-28
