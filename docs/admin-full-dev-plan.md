# 侧伴(CeBan) 管理后台 — 完整功能开发计划

> 2026-06-04 | 基于 DB 实际数据 + 代码现状分析

---

## 一、现有资产盘点

### 1.1 DB 实际数据量

| 表 | 行数 | 备注 |
|---|------|------|
| users | 81 | 有活跃用户 |
| stages | 134 | 课程数据 |
| scenes | 489 | 场景内容 |
| token_transactions | 93 | reward(81)+exchange(12), 无purchase |
| orders | 0 | **支付未上线, 无订单** |
| subscriptions | 0 | **支付未上线, 无订阅** |
| llm_configs | 3 | openai/anthropic/deepseek (实际用qwen) |
| pricing_configs | 5 | 3 Token包 + 2 订阅 |
| admins | 2 | 超管 + 测试管理员 |
| admin_roles | 5 | 5 个角色已初始化 |
| admin_permissions | 12 | 12 个权限码已初始化 |
| generation_jobs | 0 | 无生成记录 |
| buddy_messages | 0 | 无 |

### 1.2 后端路由现状

| 文件 | 行数 | prefix | 注册 | Bug |
|------|------|---------|------|-----|
| admin_auth.py | 690 | /admin/auth | ✅ | 无 |
| admin.py | 1172 | /admin | ✅ | 严重: 查payments表不存在, 列名transaction_type/tokens不存在 |
| admin_full.py | 682 | /admin | ❌未注册 | economy仍查payments表, gift列名错 |

admin.py 和 admin_full.py 同prefix `/admin`, 路由冲突.

### 1.3 前端现状 (packages/admin, Next.js 16)

| 页面 | 状态 | 问题 |
|------|------|------|
| /login | ✅ | 无JWT过期检测 |
| / Dashboard | ❌ | /stats有SQL bug |
| /users | ⚠️ | 无详情页/编辑/赠币弹窗 |
| /admins | ✅ | — |
| /content/* | ⚠️ | notes查错表 |
| /statistics/economy | ❌ | 查payments表, fallback到mock |
| /statistics/users | ⚠️ | 可能可用 |
| /settings/llm | ⚠️ | 配置与实际模型不匹配 |
| /settings/pricing | ⚠️ | 可用 |
| /settings/rules | ⚠️ | 可用 |
| /logs | ❌ | admin_logs空 + FK bug |

---

## 二、 P0 — Bug修复 (1天)

必须先做, 否则后台无法正常运行.

### B1: 删除admin.py, 合并admin_full.py到main.py
- admin_full.py 补上 courses 列表/详情端点 (admin.py有, admin_full.py没有)
- main.py: `from app.routes import admin_full as admin`
- 删除 admin.py

### B2: 修admin_full.py 15处SQL bug
| # | 位置 | Bug | 修法 |
|---|------|-----|-----|
| 1 | /stats revenue_today | 查token_transactions WHERE type='purchase' (无purchase数据) | 改查orders WHERE status='paid' |
| 2 | /stats tokens_purchased | SUM(tokens)列不存在 | 改SUM(amount) |
| 3 | /stats points_earned | SUM(points)列不存在 | 改SUM(amount) |
| 4 | /statistics/economy 全部 | 查payments表不存在 | 全改查orders表 |
| 5 | /statistics/economy tokens_today | transaction_type列不存在 | 改type |
| 6 | /statistics/economy points_earned | SUM(points)列不存在 | 改SUM(amount) |
| 7 | gift-tokens INSERT | transaction_type列不存在 | 改type |
| 8 | gift-tokens INSERT | tokens列不存在 | 改amount |
| 9 | gift-points INSERT | transaction_type列不存在 | 改type |
| 10 | gift-points INSERT | points列不存在 | 改amount |
| 11 | check_permission | 不传permission_code | 各端点传具体权限码 |

### B3: 修admin_logs FK (models.py)
- AdminLog.admin_id FK: users.id → admins.id
- ALTER TABLE + migration

### B4: 前端去掉mock fallback
- 所有页面: API失败显示红色错误条+重试按钮, 不伪造数据

---

## 三、 Phase 1 — 成本收入盈利看板 (3-4天)

> ★★核心需求: 看到整体成本和收入盈利情况★★

### 1.1 新建 llm_usage_logs 表 + migration
```sql
CREATE TABLE llm_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    model VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    scene_type VARCHAR(50),
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    cost_yuan DECIMAL(10,6) NOT NULL DEFAULT 0,
    request_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_llm_logs_date ON llm_usage_logs(DATE(created_at));
CREATE INDEX idx_llm_logs_model ON llm_usage_logs(model);
CREATE INDEX idx_llm_logs_scene ON llm_usage_logs(scene_type);
```

### 1.2 llm_configs 扩展 — 加价格字段
```sql
ALTER TABLE llm_configs
    ADD COLUMN input_price_per_1k DECIMAL(10,6) DEFAULT 0,
    ADD COLUMN output_price_per_1k DECIMAL(10,6) DEFAULT 0;
-- 更新实际价格 (阿里云百炼定价)
UPDATE llm_configs SET model='qwen3.6-plus', input_price_per_1k=0.002, output_price_per_1k=0.006 WHERE provider='qwen_plus';
UPDATE llm_configs SET model='qwen-turbo', input_price_per_1k=0.0003, output_price_per_1k=0.0006 WHERE provider='qwen_turbo';
```

### 1.3 services/llm.py — LLM调用后自动记录成本
每次LLM调用完成后:
- 解析 response.usage (prompt_tokens/completion_tokens/total_tokens)
- 按 model 查 llm_configs 算 cost_yuan
- INSERT INTO llm_usage_logs

覆盖场景:
- chat.py → scene_type='agent_chat'
- classrooms.py → 'outline_generation', 'scene_generation'
- question_course.py → 'course_generation'
- buddy.py → 'buddy_chat'
- tts_service.py → 'tts'

TTS按字符计费, 不按token.

### 1.4 后端新增3个API端点

**GET /admin/finance/overview** — 盈利总览
```
{
  revenue: {
    today, this_week, this_month, total,
    by_type: { subscription, token_pack },
    trend: [{ date, amount }]          // 近30天
  },
  cost: {
    today, this_week, this_month, total,
    by_model: [{ model, cost }],
    by_scene: [{ scene_type, cost }],
    trend: [{ date, cost }]
  },
  profit: {
    today, this_week, this_month, total,
    margin,                          // 利润率 %
    trend: [{ date, revenue, cost, profit }]
  },
  metrics: {
    arpu, cost_per_user,             // 人均收入/成本
    total_users, active_today
  }
}
```

**GET /admin/finance/revenue** — 收入明细
- orders 列表 (分页, 筛选status/date/user/method)
- 汇总: by_method, by_status, by_type

**GET /admin/finance/cost** — 成本明细
- llm_usage_logs 列表 (分页, 筛选model/scene/date)
- 汇总: by_model, by_scene, avg_per_call

### 1.5 前端3个新页面 + sidebar更新

**/finance** — 盈利总览
- 4核心卡片: 今日收入/成本/利润/利润率
- 趋势折线(recharts): 收入线+成本线+利润线
- 模型成本饼图 + 场景成本柱状图
- ARPU + 人均成本指标

**/finance/revenue** — 收入明细
- 订单列表表格 + 按日/渠道筛选
- 收入趋势柱状图

**/finance/cost** — 成本明细
- LLM调用日志表格 + 按模型/场景筛选
- 成本趋势图 + 模型占比饼图

**sidebar.tsx** — 新增「财务管理」分组:
- 盈利总览 → /finance
- 收入明细 → /finance/revenue
- 成本明细 → /finance/cost

### 1.6 /settings/llm 增强
- 增加 input/output 价格字段显示和编辑
- 新增 qwen 系列配置行

---

## 四、 Phase 2 — 运营管理完善 (3-4天)

### 2.1 订单管理
- GET /admin/orders (列表, 筛选status/date/user/method)
- GET /admin/orders/{id} (详情)
- PATCH /admin/orders/{id}/refund (标记退款)
- 前端: /finance/orders 页面

### 2.2 订阅管理
- GET /admin/subscriptions (列表)
- PATCH /admin/subscriptions/{id} (手动续期/升降级)
- 前端: 合入 /finance/subscriptions 页面

### 2.3 用户详情页
- 后端: /admin/users/{id} 增强返回 (订阅+Token+积分+活跃度)
- 前端: /users/{id} 详情页
  - 信息卡片 + Token余额 + 积分余额
  - 赠币/赠点确认弹窗 (当前按钮无交互)
  - 禁用/启用确认弹窗
  - 用户流水/课程列表

### 2.4 课程管理增强
- DELETE /admin/courses/{id} (删除)
- GET /admin/courses/{id}/scenes (查看场景)
- PATCH /admin/courses/{id}/status (上架/下架)
- 前端: 课程列表增强操作按钮

---

## 五、 Phase 3 — 系统增强 (2-3天)

| # | 功能 | 说明 |
|---|------|------|
| 3.1 | JWT过期自动跳转 | middleware检测401→清localStorage→跳/login |
| 3.2 | RBAC权限UI | sidebar按permissions动态显示, 端点传permission_code |
| 3.3 | 管理员改密 | POST /admin/auth/change-password |
| 3.4 | 登录限速 | /admin/auth/login加rate limit (5次/分钟/IP+email) |
| 3.5 | 数据导出CSV | GET /admin/export/{users|transactions|orders} |
| 3.6 | 批量操作 | POST /admin/content/batch-approve, /admin/users/batch-ban |
| 3.7 | Pydantic校验 | gift-tokens等从裸dict改Pydantic Model |

---

## 六、 执行时间线

```
P0  Bug修复          1天    → 后台能跑
P1  成本收入盈利      3-4天  → ★看得到盈利★
P2  运营管理          3-4天  → 日常运营工具
P3  系统增强          2-3天  → 安全+体验
总计                  9-12天
```

## 七、 冷启动说明

当前 orders=0, subscriptions=0, token_transactions 无 purchase 类型:
- 支付未上线 → 盈利看板收入侧显示 ¥0 (支付未上线)
- LLM成本记录植入后立即可积累 → 成本侧数据从第一天起有
- 可用 token_transactions reward/exchange 做「虚拟成本」参考
- 等支付上线后收入数据自然积累

## 八、 关键模型定价参考 (阿里云百炼)

| 模型 | input (元/M token) | output (元/M token) | 用途 |
|------|-------------------|-------------------|------|
| qwen-turbo | 0.3 | 0.6 | 批改等低级任务 |
| qwen-plus / qwen3.6-plus | 2 | 6 | 主对话/推理 |
| qwen-vl-max | 3 | 9 | 多模态 |
| qwen3-tts-flash | ~0.001/字符 | — | 语音合成 |

> 实际价格需从阿里云百炼控制台确认, admin后台支持手动配置.

---

## 九、 API接口详细设计

### 9.1 /admin/finance/overview — 盈利总览

```
GET /admin/finance/overview?days=30

Response:
{
  revenue: {
    today: 0,           // SUM(orders.amount)/100 WHERE status='paid' AND today
    this_week: 0,
    this_month: 0,
    total: 0,
    by_type: { subscription: 0, token_pack: 0 },   // orders 按 payment_method 分
    trend: [{ date: "2026-06-01", amount: 150.00 }]  // 近30天
  },
  cost: {
    today: 1.23,        // SUM(llm_usage_logs.cost_yuan) WHERE today
    this_week: 8.50,
    this_month: 35.00,
    total: 35.00,
    by_model: [                         // 按模型分组
      { model: "qwen3.6-plus", cost: 28.00, calls: 500 },
      { model: "qwen-turbo", cost: 5.00, calls: 200 },
      { model: "qwen-vl-max", cost: 2.00, calls: 10 }
    ],
    by_scene: [                         // 按场景分组
      { scene_type: "agent_chat", cost: 15.00 },
      { scene_type: "outline_generation", cost: 10.00 },
      { scene_type: "scene_generation", cost: 8.00 }
    ],
    trend: [{ date: "2026-06-01", cost: 1.23 }]
  },
  profit: {
    today: -1.23,       // revenue.today - cost.today (负数=亏损)
    this_week: -8.50,
    this_month: -35.00,
    total: -35.00,
    margin: -100,       // 利润率 = profit/revenue * 100 (无收入时为-100)
    trend: [{ date, revenue: 0, cost: 1.23, profit: -1.23 }]
  },
  metrics: {
    arpu: 0,            // 人均收入 = revenue / users
    cost_per_user: 0.43, // 人均成本 = cost / users
    total_users: 81,
    active_today: 5
  }
}
```

### 9.2 /admin/finance/revenue — 收入明细

```
GET /admin/finance/revenue?page=1&limit=20&status=paid&method=wechat&start_date=2026-06-01

Response:
{
  orders: [
    { id, user_id, user_nickname, amount_yuan: 9.9, token_amount: 100,
      payment_method: "wechat", status: "paid", created_at, paid_at }
  ],
  total: 0,
  page: 1,
  summary: {
    total_amount: 0,
    by_method: { wechat: 0, alipay: 0 },
    by_status: { paid: 0, created: 0, cancelled: 0 },
    avg_amount: 0
  },
  trend: [{ date, count, amount }]
}
```

### 9.3 /admin/finance/cost — 成本明细

```
GET /admin/finance/cost?page=1&limit=20&model=qwen3.6-plus&scene=agent_chat&start_date=2026-06-01

Response:
{
  logs: [
    { id, user_id, user_nickname, model, provider, scene_type,
      prompt_tokens: 500, completion_tokens: 200, total_tokens: 700,
      cost_yuan: 0.0017, created_at }
  ],
  total: 100,
  page: 1,
  summary: {
    total_cost: 35.00,
    total_calls: 710,
    total_tokens: 500000,
    avg_cost_per_call: 0.049,
    by_model: [{ model, calls, tokens, cost }],
    by_scene: [{ scene_type, calls, cost }]
  },
  trend: [{ date, calls, tokens, cost }]
}
```

### 9.4 /admin/orders — 订单管理

```
GET /admin/orders?page=1&limit=20&status=&user_id=&method=&start_date=&end_date=

Response:
{
  orders: [
    { id, user_id, user_nickname, amount, amount_yuan, token_amount,
      payment_method, status, transaction_id, paid_at, created_at }
  ],
  total, page, limit,
  summary: { total_amount, by_method, by_status }
}

PATCH /admin/orders/{id}/refund
Body: { reason: "用户申请退款" }
Response: { success: true, order_id, status: "refunded" }
```

### 9.5 /admin/subscriptions — 订阅管理

```
GET /admin/subscriptions?page=1&limit=20&status=active&plan_type=premium

Response:
{
  subscriptions: [
    { id, user_id, user_nickname, plan_type, status,
      started_at, expires_at, auto_renew, created_at }
  ],
  total, page, limit,
  summary: { active_count, by_plan: { premium: 0, enterprise: 0 } }
}

PATCH /admin/subscriptions/{id}
Body: { plan_type: "premium", expires_at: "2026-07-04", action: "manual_renew" }
Response: { success: true }
```

### 9.6 /admin/courses 增强

```
DELETE /admin/courses/{id}
Response: { success: true, course_id }

GET /admin/courses/{id}/scenes
Response: {
  scenes: [
    { id, type, title, content_preview: "...(100字)", created_at }
  ],
  total
}

PATCH /admin/courses/{id}/status
Body: { status: "archived" }   // active / archived
Response: { success: true }
```

### 9.7 /admin/finance/payments — 支付记录

```
GET /admin/finance/payments?page=1&limit=20&provider=&status=

Response:
{
  callbacks: [
    { id, order_id, provider, transaction_id, amount, status,
      processed, raw_data_preview, created_at }
  ],
  total, page
}
```

---

## 十、 表结构详细设计

### 10.1 llm_usage_logs (新建)

| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | 主键 |
| user_id | UUID FK→users | 用户ID (可NULL, 系统调用无user) |
| model | VARCHAR(50) | qwen3.6-plus, qwen-turbo, qwen-vl-max, qwen3-tts-flash |
| provider | VARCHAR(50) | qwen, openai, anthropic |
| scene_type | VARCHAR(50) | agent_chat, outline_generation, scene_generation, course_generation, buddy_chat, quiz_grading, tts, image_description |
| prompt_tokens | INTEGER | 输入token数 |
| completion_tokens | INTEGER | 输出token数 |
| total_tokens | INTEGER | 总token数 |
| cost_yuan | DECIMAL(10,6) | 成本(元), = input_price*prompt/1000 + output_price*completion/1000 |
| request_id | VARCHAR(100) | 调用链追踪ID |
| created_at | TIMESTAMP | 创建时间 |

索引: DATE(created_at), model, scene_type, user_id

### 10.2 llm_configs 扩展 (ALTER)

| 新列 | 类型 | 说明 |
|------|------|------|
| input_price_per_1k | DECIMAL(10,6) | 输入价格(元/千token), 默认0 |
| output_price_per_1k | DECIMAL(10,6) | 输出价格(元/千token), 默认0 |

初始数据:
| provider | model | input_price | output_price |
|----------|-------|------------|-------------|
| qwen_plus | qwen3.6-plus | 0.002 | 0.006 |
| qwen_turbo | qwen-turbo | 0.0003 | 0.0006 |
| qwen_vl | qwen-vl-max | 0.003 | 0.009 |
| qwen_tts | qwen3-tts-flash | 0 | 0.001(按字符) |

### 10.3 orders (现有, 无改动)

| 列 | 类型 | 说明 |
|---|------|------|
| id | UUID PK | |
| user_id | UUID FK→users | |
| amount | INTEGER | 金额(分), 990=¥9.9 |
| token_amount | INTEGER | Token数量 |
| payment_method | VARCHAR(20) | wechat / alipay |
| status | VARCHAR(20) | created / paid / cancelled / refunded |
| transaction_id | VARCHAR(64) | 第三方交易号 |
| paid_at | TIMESTAMP | 支付时间 |
| notify_data | TEXT | 回调原始数据 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### 10.4 admin_logs FK修改

```sql
-- 当前: admin_id REFERENCES users(id) — 错误
-- 修改为: admin_id REFERENCES admins(id)
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;
ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL;
```

---

## 十一、 services/llm.py 成本记录植入点

```python
# llm.py — 在 chat_completion/stream_chat 返回后调用:

async def _record_llm_cost(db, user_id, model, provider, scene_type, usage, request_id=None):
    """记录LLM调用成本"""
    prompt_tokens = usage.get("prompt_tokens", 0) or 0
    completion_tokens = usage.get("completion_tokens", 0) or 0
    total_tokens = usage.get("total_tokens", 0) or 0

    # 查模型价格
    config = await db.fetchrow(
        "SELECT input_price_per_1k, output_price_per_1k FROM llm_configs WHERE provider = $1",
        provider
    )
    input_price = config["input_price_per_1k"] if config else 0
    output_price = config["output_price_per_1k"] if config else 0

    cost_yuan = (prompt_tokens / 1000) * input_price + (completion_tokens / 1000) * output_price

    await db.execute(
        """INSERT INTO llm_usage_logs
        (user_id, model, provider, scene_type, prompt_tokens, completion_tokens,
         total_tokens, cost_yuan, request_id, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
        user_id, model, provider, scene_type,
        prompt_tokens, completion_tokens, total_tokens,
        cost_yuan, request_id, utcnow()
    )
    return cost_yuan
```

调用植入位置:
- chat.py: agent_chat 场景, 调用后 _record_llm_cost(db, user_id, model, provider, "agent_chat", response.usage)
- classrooms.py: outline_generation + scene_generation, 调用后记录
- question_course.py: course_generation, 调用后记录
- buddy.py: buddy_chat, 调用后记录
- tts_service.py: tts, 按字符数×单价记录
- quiz_grading: quiz_grading场景