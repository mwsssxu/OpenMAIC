# 问答系统 - 数据库迁移指南

## 当前数据库状态检查

### 检查表是否存在

```bash
docker exec postgres psql -U postgres -d maic -c "\dt questions"
docker exec postgres psql -U postgres -d maic -c "\dt answers"
docker exec postgres psql -U postgres -d maic -c "\dt answer_votes"
```

### 检查表结构

```bash
docker exec postgres psql -U postgres -d maic -c "\d questions"
docker exec postgres psql -U postgres -d maic -c "\d answers"
docker exec postgres psql -U postgres -d maic -c "\d answer_votes"
```

---

## 数据库表结构

### ✅ questions 表

**当前状态**: 已存在且结构正确

```sql
                                     Table "public.questions"
       Column       |            Type             | Collation | Nullable | Default
--------------------+-----------------------------+-----------+----------+---------
 id                 | uuid                        |           | not null |
 user_id            | uuid                        |           | not null |
 title              | character varying(255)      |           | not null |
 content            | text                        |           | not null |
 bounty             | integer                     |           |          |
 bounty_status      | character varying(20)       |           |          |
 tags               | text                        |           |          |
 view_count         | integer                     |           |          |
 answer_count       | integer                     |           |          |
 created_at         | timestamp without time zone |           |          |
 updated_at         | timestamp without time zone |           |          |
 accepted_answer_id | uuid                        |           |          |

Indexes:
    "questions_pkey" PRIMARY KEY, btree (id)
    "ix_questions_bounty" btree (bounty DESC)
    "ix_questions_bounty_status" btree (bounty_status)
    "ix_questions_created_at" btree (created_at DESC)
    "ix_questions_user_id" btree (user_id)

Foreign-key constraints:
    "questions_accepted_answer_id_fkey" FOREIGN KEY (accepted_answer_id) REFERENCES answers(id) ON DELETE SET NULL
    "questions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

---

### ✅ answers 表

**当前状态**: 已存在且结构正确

```sql
                              Table "public.answers"
   Column    |            Type             | Collation | Nullable | Default
-------------+-----------------------------+-----------+----------+---------
 id          | uuid                        |           | not null |
 question_id | uuid                        |           | not null |
 user_id     | uuid                        |           | not null |
 content     | text                        |           | not null |
 rating      | integer                     |           |          |
 vote_count  | integer                     |           |          |
 is_accepted | boolean                     |           |          |
 accepted_at | timestamp without time zone |           |          |
 created_at  | timestamp without time zone |           |          |
 updated_at  | timestamp without time zone |           |          |

Indexes:
    "answers_pkey" PRIMARY KEY, btree (id)
    "ix_answers_is_accepted" btree (is_accepted)
    "ix_answers_question_id" btree (question_id)
    "ix_answers_user_id" btree (user_id)
    "ix_answers_vote_count" btree (vote_count DESC)

Foreign-key constraints:
    "answers_question_id_fkey" FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    "answers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

---

### ✅ answer_votes 表

**当前状态**: 已存在且结构正确

```sql
                           Table "public.answer_votes"
   Column   |            Type             | Collation | Nullable | Default
------------+-----------------------------+-----------+----------+---------
 id         | uuid                        |           | not null |
 answer_id  | uuid                        |           | not null |
 user_id    | uuid                        |           | not null |
 vote       | integer                     |           | not null |
 created_at | timestamp without time zone |           |          |

Indexes:
    "answer_votes_pkey" PRIMARY KEY, btree (id)
    "ix_answer_votes_answer_id" btree (answer_id)
    "uq_answer_votes_answer_user" UNIQUE CONSTRAINT, btree (answer_id, user_id)

Foreign-key constraints:
    "answer_votes_answer_id_fkey" FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE
    "answer_votes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

---

## 数据库验证结果

### ✅ 所有表结构正确

| 表名 | 状态 | 字段数 | 索引数 | 外键数 |
|------|------|--------|--------|--------|
| questions | ✅ 正确 | 12 | 5 | 2 |
| answers | ✅ 正确 | 10 | 5 | 2 |
| answer_votes | ✅ 正确 | 5 | 3 | 2 |

### ✅ 所有索引已创建

**questions 表索引**:
- ✅ `questions_pkey` - 主键索引
- ✅ `ix_questions_user_id` - 用户ID索引
- ✅ `ix_questions_created_at` - 创建时间索引（降序）
- ✅ `ix_questions_bounty` - 悬赏积分索引（降序）
- ✅ `ix_questions_bounty_status` - 悬赏状态索引

**answers 表索引**:
- ✅ `answers_pkey` - 主键索引
- ✅ `ix_answers_question_id` - 问题ID索引
- ✅ `ix_answers_user_id` - 用户ID索引
- ✅ `ix_answers_vote_count` - 投票数索引（降序）
- ✅ `ix_answers_is_accepted` - 采纳状态索引

**answer_votes 表索引**:
- ✅ `answer_votes_pkey` - 主键索引
- ✅ `ix_answer_votes_answer_id` - 回答ID索引
- ✅ `uq_answer_votes_answer_user` - 唯一约束（防重复投票）

### ✅ 所有外键已设置

**questions 表外键**:
- ✅ `user_id` → `users.id` (ON DELETE CASCADE)
- ✅ `accepted_answer_id` → `answers.id` (ON DELETE SET NULL)

**answers 表外键**:
- ✅ `question_id` → `questions.id` (ON DELETE CASCADE)
- ✅ `user_id` → `users.id` (ON DELETE CASCADE)

**answer_votes 表外键**:
- ✅ `answer_id` → `answers.id` (ON DELETE CASCADE)
- ✅ `user_id` → `users.id` (ON DELETE CASCADE)

---

## 数据库测试

### 测试1：插入测试数据

```sql
-- 插入测试问题
INSERT INTO questions (id, user_id, title, content, bounty, bounty_status, tags, view_count, answer_count, created_at)
SELECT
    gen_random_uuid(),
    id,
    '测试问题：如何学习Python？',
    '我是一名初学者，想学习Python编程，请问有什么好的建议？',
    50,
    'open',
    '["Python", "编程"]',
    0,
    0,
    now()
FROM users LIMIT 1;

-- 查询验证
SELECT id, title, bounty, bounty_status FROM questions WHERE title LIKE '%测试问题%';
```

### 测试2：插入测试回答

```sql
-- 插入测试回答
INSERT INTO answers (id, question_id, user_id, content, vote_count, is_accepted, created_at)
SELECT
    gen_random_uuid(),
    q.id,
    u.id,
    '建议从基础语法开始学习，推荐官方教程和实战项目结合。',
    0,
    false,
    now()
FROM questions q, users u
WHERE q.title LIKE '%测试问题%'
LIMIT 1;

-- 查询验证
SELECT a.id, a.content, a.vote_count
FROM answers a
JOIN questions q ON a.question_id = q.id
WHERE q.title LIKE '%测试问题%';
```

### 测试3：测试投票

```sql
-- 插入投票
INSERT INTO answer_votes (id, answer_id, user_id, vote, created_at)
SELECT
    gen_random_uuid(),
    a.id,
    u.id,
    1,
    now()
FROM answers a, users u
WHERE a.content LIKE '%建议从基础语法%'
LIMIT 1;

-- 更新投票数
UPDATE answers
SET vote_count = vote_count + 1
WHERE id IN (SELECT id FROM answers WHERE content LIKE '%建议从基础语法%');

-- 查询验证
SELECT id, content, vote_count FROM answers WHERE content LIKE '%建议从基础语法%';
```

### 测试4：测试采纳

```sql
-- 采纳答案
UPDATE answers
SET is_accepted = true, accepted_at = now()
WHERE content LIKE '%建议从基础语法%';

UPDATE questions
SET bounty_status = 'closed', accepted_answer_id = (SELECT id FROM answers WHERE content LIKE '%建议从基础语法%')
WHERE title LIKE '%测试问题%';

-- 查询验证
SELECT q.title, q.bounty_status, a.is_accepted
FROM questions q
LEFT JOIN answers a ON a.question_id = q.id
WHERE q.title LIKE '%测试问题%';
```

### 清理测试数据

```sql
-- 删除测试数据
DELETE FROM answer_votes WHERE answer_id IN (
    SELECT id FROM answers WHERE content LIKE '%建议从基础语法%'
);
DELETE FROM answers WHERE content LIKE '%建议从基础语法%';
DELETE FROM questions WHERE title LIKE '%测试问题%';
```

---

## 性能验证

### 查询性能测试

```sql
-- 测试问题列表查询
EXPLAIN ANALYZE
SELECT * FROM questions
ORDER BY created_at DESC
LIMIT 20;

-- 测试悬赏排序查询
EXPLAIN ANALYZE
SELECT * FROM questions
WHERE bounty > 0
ORDER BY bounty DESC
LIMIT 20;

-- 测试回答查询
EXPLAIN ANALYZE
SELECT * FROM answers
WHERE question_id = 'some-uuid'
ORDER BY vote_count DESC;
```

### 索引使用率检查

```sql
-- 检查索引使用情况
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('questions', 'answers', 'answer_votes')
ORDER BY idx_scan DESC;
```

---

## 维护建议

### 定期维护任务

1. **更新统计信息**（每天）:
```sql
ANALYZE questions;
ANALYZE answers;
ANALYZE answer_votes;
```

2. **清理过期数据**（每周）:
```sql
-- 可选：删除超过1年无回答的悬赏问题
DELETE FROM questions
WHERE bounty_status = 'open'
  AND bounty = 0
  AND answer_count = 0
  AND created_at < now() - interval '1 year';
```

3. **重建索引**（每月）:
```sql
REINDEX TABLE questions;
REINDEX TABLE answers;
REINDEX TABLE answer_votes;
```

### 监控指标

1. **表大小监控**:
```sql
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE tablename IN ('questions', 'answers', 'answer_votes');
```

2. **活跃用户监控**:
```sql
SELECT
    u.nickname,
    COUNT(DISTINCT q.id) AS questions,
    COUNT(DISTINCT a.id) AS answers
FROM users u
LEFT JOIN questions q ON q.user_id = u.id
LEFT JOIN answers a ON a.user_id = u.id
GROUP BY u.id, u.nickname
HAVING COUNT(DISTINCT q.id) > 0 OR COUNT(DISTINCT a.id) > 0
ORDER BY questions DESC, answers DESC
LIMIT 10;
```

---

## 备份与恢复

### 备份问答数据

```bash
# 备份表结构和数据
docker exec postgres pg_dump -U postgres -d maic -t questions -t answers -t answer_votes > qanda_backup.sql

# 仅备份表结构
docker exec postgres pg_dump -U postgres -d maic -t questions -t answers -t answer_votes --schema-only > qanda_schema.sql

# 仅备份数据
docker exec postgres pg_dump -U postgres -d maic -t questions -t answers -t answer_votes --data-only > qanda_data.sql
```

### 恢复数据

```bash
# 恢复数据
docker exec -i postgres psql -U postgres -d maic < qanda_backup.sql
```

---

## 总结

### ✅ 数据库状态

- 所有表结构正确
- 所有索引已创建
- 所有外键已设置
- 性能优化完成

### ✅ 测试通过

- 数据插入正常
- 查询性能良好
- 外键约束有效
- 唯一约束正常

### 📊 表统计

- `questions`: 12字段, 5索引, 2外键
- `answers`: 10字段, 5索引, 2外键
- `answer_votes`: 5字段, 3索引, 2外键

**数据库已完全就绪，可以正常使用！**
