# 数据库索引优化指南

> 基于当前62张数据表的使用场景，优化查询性能

---

## 一、高频查询场景索引

### 用户相关

```sql
-- 用户登录查询（高频）
CREATE INDEX IF NOT EXISTS ix_users_email_active ON users(email, is_active);

-- 用户积分余额查询（高频）
CREATE INDEX IF NOT EXISTS ix_point_accounts_user ON point_accounts(user_id);

-- 用户订阅状态查询
CREATE INDEX IF NOT EXISTS ix_users_subscription ON users(subscription_tier, subscription_ends_at);
```

### 课程相关

```sql
-- 课程列表查询（按用户）
CREATE INDEX IF NOT EXISTS ix_stages_user_created ON stages(user_id, created_at DESC);

-- 场景按顺序查询
CREATE INDEX IF NOT EXISTS ix_scenes_stage_order ON scenes(stage_id, order_index);

-- 课程完成查询
CREATE INDEX IF NOT EXISTS ix_course_completions_user_date ON course_completions(user_id, completed_at DESC);

-- 课程推荐查询
CREATE INDEX IF NOT EXISTS ix_recommendations_source_type ON course_recommendations(source_course_id, recommendation_type, weight DESC);
```

### 学习系统

```sql
-- 复习计划查询（按用户+时间）
CREATE INDEX IF NOT EXISTS ix_review_schedules_user_time ON review_schedules(user_id, trigger_at, status);

-- 学习护照查询（按用户+技能）
CREATE INDEX IF NOT EXISTS ix_passports_user_skill ON learning_passports(user_id, skill_name);

-- 测评查询（按用户+课程）
CREATE INDEX IF NOT EXISTS ix_assessments_user_course ON learning_assessments(user_id, course_id, status);

-- 企业成员查询
CREATE INDEX IF NOT EXISTS ix_enterprise_members_ent_role ON enterprise_members(enterprise_id, role);
```

### 社交系统

```sql
-- 问答查询（按状态）
CREATE INDEX IF NOT EXISTS ix_questions_status_reward ON questions(status, reward_amount DESC);

-- 笔记查询（按课程）
CREATE INDEX IF NOT EXISTS ix_notes_course_visibility ON shared_notes(course_id, visibility, created_at DESC);

-- 笔记购买查询
CREATE INDEX IF NOT EXISTS ix_note_purchases_user ON note_purchases(user_id, created_at DESC);
```

### 统计相关

```sql
-- Token交易统计
CREATE INDEX IF NOT EXISTS ix_token_trans_user_type_date ON token_transactions(user_id, transaction_type, created_at);

-- 积分交易统计
CREATE INDEX IF NOT EXISTS ix_point_trans_user_date ON point_transactions(user_id, created_at);

-- 管理员日志查询
CREATE INDEX IF NOT EXISTS ix_admin_logs_action_date ON admin_logs(action, created_at DESC);
```

---

## 二、复合索引优化

```sql
-- 多条件查询优化
CREATE INDEX IF NOT EXISTS ix_users_search ON users(nickname, email, is_active);

-- 课程搜索优化
CREATE INDEX IF NOT EXISTS ix_stages_search ON stages(name, user_id, created_at);

-- 企业进度查询
CREATE INDEX IF NOT EXISTS ix_enterprise_progress_ent_user_course ON enterprise_course_progress(enterprise_id, user_id, course_id);
```

---

## 三、查询优化建议

### 避免 N+1 查询

使用 JOIN 或批量查询替代循环查询：

```python
# ❌ 不好的做法
for course_id in course_ids:
    course = await db.fetchrow("SELECT * FROM stages WHERE id = $1", course_id)

# ✅ 好的做法
courses = await db.fetch(
    "SELECT * FROM stages WHERE id IN ($1, $2, $3)",
    *course_ids[:3]
)
```

### 使用分页

```python
# 大数据集分页查询
rows = await db.fetch(
    "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    limit, offset
)
```

### 统计查询优化

```sql
-- 使用 COUNT FILTER 替代多个 COUNT
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count
FROM users;
```

---

## 四、监控指标

| 指标 | 命令 |
|------|------|
| 查询慢日志 | `SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;` |
| 表大小 | `SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) FROM pg_catalog.pg_statio_user_tables;` |
| 索引使用率 | `SELECT indexrelname, idx_scan FROM pg_stat_user_indexes;` |

---

## 五、索引维护

```sql
-- 定期重建索引（每周）
REINDEX INDEX CONCURRENTLY ix_stages_user_created;

-- 更新统计信息
ANALYZE users;
ANALYZE stages;
ANALYZE course_completions;
```

---

## 相关文档

- [数据库迁移文件](../packages/server-python/alembic/versions/)
- [Redis缓存配置](../packages/server-python/app/core/cache.py)