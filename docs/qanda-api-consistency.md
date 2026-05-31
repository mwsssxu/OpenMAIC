# 问答系统 - 前后端接口一致性检查

## 数据库表结构 ✅

### questions 表
```sql
- id: UUID (主键) ✅
- user_id: UUID (外键 -> users) ✅
- scene_id: UUID (外键 -> scenes) ✅
- title: VARCHAR(255) ✅
- content: TEXT ✅
- bounty: INTEGER (悬赏积分) ✅
- bounty_status: VARCHAR(20) (open/closed) ✅
- tags: TEXT ✅
- view_count: INTEGER ✅
- answer_count: INTEGER ✅
- accepted_answer_id: UUID ✅
- is_resolved: BOOLEAN ✅
- created_at: TIMESTAMP ✅
- updated_at: TIMESTAMP ✅
```

### answers 表
```sql
- id: UUID (主键) ✅
- question_id: UUID (外键 -> questions) ✅
- user_id: UUID (外键 -> users) ✅
- content: TEXT ✅
- rating: DECIMAL(3,2) ✅
- vote_count: INTEGER ✅
- is_accepted: BOOLEAN ✅
- accepted_at: TIMESTAMP ✅
- created_at: TIMESTAMP ✅
- updated_at: TIMESTAMP ✅
```

### answer_votes 表
```sql
- id: UUID (主键) ✅
- answer_id: UUID (外键 -> answers) ✅
- user_id: UUID (外键 -> users) ✅
- vote: INTEGER (1/-1) ✅
- created_at: TIMESTAMP ✅
- UNIQUE(answer_id, user_id) ✅
```

## API 接口一致性检查

### 1. POST /questions - 发布问题 ✅

**后端接收参数：**
```json
{
  "title": "string",
  "content": "string",
  "bounty": "number (optional, default: 0)",
  "tags": "string (optional)"
}
```

**前端发送参数：**
```typescript
apiClient.createQuestion(
  title: string,
  content: string,
  bounty?: number,
  tags?: string
)
```

**后端返回：**
```json
{
  "id": "string",
  "title": "string",
  "bounty": "number",
  "bounty_status": "string",
  "message": "string"
}
```

**一致性：** ✅ 完全一致

---

### 2. GET /questions - 获取问题列表 ✅

**后端接收参数：**
```
page: number (default: 1)
limit: number (default: 20)
status: string (optional)
tags: string (optional)
sort: string (default: "recent")
```

**前端发送参数：**
```typescript
apiClient.getQuestions(page?: number, limit?: number, sort?: string)
```

**后端返回：**
```json
{
  "items": [
    {
      "id": "string",
      "user_id": "string",
      "user_nickname": "string",
      "title": "string",
      "content": "string (前200字符)",
      "bounty": "number",
      "bounty_status": "string",
      "tags": "string",
      "view_count": "number",
      "answer_count": "number",
      "has_accepted": "boolean",
      "created_at": "string (ISO 8601)"
    }
  ],
  "pagination": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "total_pages": "number"
  }
}
```

**前端接收：**
```typescript
interface Question {
  id: string;
  user_id: string;
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  tags: string;
  view_count: number;
  answer_count: number;
  created_at: string;
}
```

**需要注意的差异：**
- ⚠️ 前端缺少 `user_nickname` 字段（已在后端返回，前端需要添加）
- ⚠️ 前端缺少 `has_accepted` 字段（已在后端返回，前端需要添加）

**修复建议：** 更新前端 Question 接口

---

### 3. GET /questions/{question_id} - 获取问题详情 ✅

**后端返回：**
```json
{
  "id": "string",
  "user_id": "string",
  "user_nickname": "string",
  "title": "string",
  "content": "string (完整)",
  "bounty": "number",
  "bounty_status": "string",
  "tags": "string",
  "view_count": "number",
  "answer_count": "number",
  "accepted_answer_id": "string | null",
  "created_at": "string (ISO 8601)",
  "updated_at": "string | null (ISO 8601)"
}
```

**前端接收：**
```typescript
interface Question {
  id: string;
  user_id: string;
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  tags: string;
  view_count: number;
  answer_count: number;
  created_at: string;
}
```

**需要注意的差异：**
- ⚠️ 前端缺少 `user_nickname` 字段
- ⚠️ 前端缺少 `accepted_answer_id` 字段
- ⚠️ 前端缺少 `updated_at` 字段

**修复建议：** 更新前端 Question 接口

---

### 4. POST /answers - 提交回答 ✅

**后端接收参数：**
```json
{
  "question_id": "string",
  "content": "string"
}
```

**前端发送参数：**
```typescript
apiClient.createAnswer(questionId: string, content: string)
```

**后端返回：**
```json
{
  "id": "string",
  "question_id": "string",
  "content": "string",
  "message": "string"
}
```

**一致性：** ✅ 完全一致

---

### 5. GET /answers/question/{question_id} - 获取回答列表 ✅

**后端接收参数：**
```
question_id: string
page: number (default: 1)
limit: number (default: 20)
sort: string (default: "recent")
```

**前端发送参数：**
```typescript
apiClient.getAnswers(questionId: string)
```

**后端返回：**
```json
{
  "items": [
    {
      "id": "string",
      "question_id": "string",
      "user_id": "string",
      "user_nickname": "string",
      "content": "string",
      "rating": "number",
      "vote_count": "number",
      "is_accepted": "boolean",
      "accepted_at": "string | null (ISO 8601)",
      "created_at": "string (ISO 8601)"
    }
  ],
  "pagination": {...}
}
```

**前端接收：**
```typescript
interface Answer {
  id: string;
  question_id: string;
  user_id: string;
  user_nickname: string;
  content: string;
  rating: number;
  vote_count: number;
  is_accepted: boolean;
  accepted_at: string | null;
  created_at: string;
}
```

**一致性：** ✅ 完全一致

---

### 6. POST /answers/{answer_id}/vote - 投票回答 ✅

**后端接收参数：**
```json
{
  "vote": "number (1 或 -1)"
}
```

**前端发送参数：**
```typescript
apiClient.voteAnswer(answerId: string, vote: number)
```

**后端返回：**
```json
{
  "vote": "number",
  "vote_count": "number",
  "message": "string"
}
```

**一致性：** ✅ 完全一致

---

### 7. POST /answers/{answer_id}/accept - 采纳答案 ✅

**后端接收参数：**
```
answer_id: string (路径参数)
```

**前端发送参数：**
```typescript
apiClient.acceptAnswer(answerId: string)
```

**后端返回：**
```json
{
  "answer_id": "string",
  "bounty_claimed": "number",
  "author_reward": "number",
  "message": "string"
}
```

**一致性：** ✅ 完全一致

---

## 需要修复的问题

### 1. 前端 Question 接口缺少字段

**文件：** `packages/mobile/app/(tabs)/questions.tsx`

**修改：**
```typescript
interface Question {
  id: string;
  user_id: string;
  user_nickname: string;  // 添加
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  tags: string;
  view_count: number;
  answer_count: number;
  has_accepted: boolean;  // 添加
  created_at: string;
}
```

### 2. 前端问题详情接口缺少字段

**文件：** `packages/mobile/app/questions/[id].tsx`

**修改：**
```typescript
interface Question {
  id: string;
  user_id: string;
  user_nickname: string;  // 添加
  title: string;
  content: string;
  bounty: number;
  bounty_status: string;
  tags: string;
  view_count: number;
  answer_count: number;
  accepted_answer_id: string | null;  // 添加
  created_at: string;
  updated_at?: string | null;  // 添加
}
```

---

## 总结

### ✅ 完全一致的接口
- POST /questions
- POST /answers
- GET /answers/question/{question_id}
- POST /answers/{answer_id}/vote
- POST /answers/{answer_id}/accept

### ⚠️ 需要微调的接口
- GET /questions - 前端需要添加 `user_nickname` 和 `has_accepted` 字段
- GET /questions/{question_id} - 前端需要添加 `user_nickname`、`accepted_answer_id` 和 `updated_at` 字段

### ✅ 数据库表结构
- 所有必需的字段已添加到数据库初始化脚本
- 索引优化已完成
- 外键约束已设置

### 下一步
1. 更新前端 Question 接口定义
2. 在前端使用新增的字段（如显示用户昵称）
3. 运行数据库迁移脚本（如果数据库已存在）
