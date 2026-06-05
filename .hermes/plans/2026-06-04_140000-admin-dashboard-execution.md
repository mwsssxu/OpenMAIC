# 侧伴(CeBan) 管理后台开发执行计划

> 2026-06-04 | 基于 admin-full-dev-plan.md 制定可执行步骤

---

## Goal

修复管理后台现有bug，植入LLM成本追踪，构建盈利看板（收入-成本=利润），让运营者看到整体成本和收入盈利情况。

## Context

- 后端: FastAPI + asyncpg, Docker容器运行
- 前端: Next.js 16 (packages/admin), 端口3031
- DB: postgres (Docker), 81用户/134课程/0订单/0订阅
- 关键问题: admin.py有严重SQLbug，支付未上线(orders=0)，LLM调用无成本记录
- 文档: docs/admin-full-dev-plan.md (完整API+表结构设计)

## Approach

后端先行(P0+P1)，前端跟进。按依赖顺序执行，每个步骤可独立验证。

---

## Step 1: P0-B1 删除admin.py，合并到admin_full.py

**文件变更**:
- `app/routes/admin.py` → 删除
- `app/routes/admin_full.py` → 补上courses列表/详情端点(从admin.py迁移)
- `app/main.py` L19 → 改import: `from app.routes import admin_full as admin`
- `app/main.py` L234 → 保持 `app.include_router(admin.router, tags=["管理后台"])` (因为import别名)

**admin.py中需要迁移到admin_full.py的端点** (admin_full.py缺少的):
- `GET /admin/courses` — 课程列表
- `GET /admin/courses/{id}` — 课程详情
- `GET /admin/statistics/courses` — 课程统计

**验证**: 重启服务 → `curl localhost:8000/docs` 无报错 → /admin/courses 端点存在

---

## Step 2: P0-B2 修admin_full.py SQL bug (11处)

**文件**: `app/routes/admin_full.py`

| # | 位置 | 修改 |
|---|------|------|
| 1 | `/stats` revenue_today | `token_transactions WHERE type='purchase'` → `orders WHERE status='paid'`, `SUM(amount)/100` |
| 2 | `/stats` tokens_purchased | `SUM(tokens)` → `SUM(amount)` |
| 3 | `/stats` points_earned | `SUM(points)` → `SUM(amount)` |
| 4 | `/statistics/economy` 全部 | `FROM payments` → `FROM orders`, `status='completed'` → `status='paid'` |
| 5 | `/statistics/economy` tokens_today | `transaction_type` → `type`, `SUM(tokens)` → `SUM(amount)` |
| 6 | `/statistics/economy` points_earned | `SUM(points)` → `SUM(amount)`, `transaction_type` → `type` |
| 7 | gift-tokens INSERT | `transaction_type` → `type`, `tokens` → `amount` |
| 8 | gift-points INSERT | `transaction_type` → `type`, `points` → `amount` |
| 9 | `/logs` JOIN | `JOIN users u` → `JOIN admins a ON l.admin_id = a.id` |
| 10 | check_permission | 每个端点传具体permission_code (如 `Depends(lambda: check_permission("users.list"))`) → 改为每个路由函数添加permission_code参数 |
| 11 | content/notes | `FROM notes` → `FROM shared_notes` |

**验证**: 重启服务 → curl各端点无500错误

---

## Step 3: P0-B3 修admin_logs FK + migration

**文件**:
- `app/db/models.py` → `AdminLog.admin_id` FK: `users.id` → `admins.id`
- `migrations/005_admin_logs_fk_fix.sql` → 新建

```sql
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;
ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL;
```

**验证**: Docker内执行SQL → 重启服务 → 无FK错误

---

## Step 4: P0-B4 前端去掉mock fallback

**文件**: `packages/admin/app/(dashboard)/**` 所有page.tsx

修改模式: 将每个页面的 `catch { setStats(getMockStats()) }` 改为:
```tsx
catch (error) {
  setError('加载失败，请检查网络后重试');
} finally {
  setIsLoading(false);
}
```
新增 `error` state + 红色错误条UI + 重试按钮。

**验证**: 停掉后端 → 打开admin页面 → 看到红色错误条而非假数据

---

## Step 5: P1-1 新建llm_usage_logs表 + migration

**文件**:
- `migrations/004_llm_usage_logs.sql` → 新建
- `app/db/models.py` → 新增 `LLMUsageLog` 模型

SQL见文档 §10.1。ORM模型:
```python
class LLMUsageLog(Base):
    __tablename__ = "llm_usage_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    model = Column(String(50), nullable=False)
    provider = Column(String(50), nullable=False)
    scene_type = Column(String(50))
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    cost_yuan = Column(Numeric(10, 6), nullable=False, default=0)
    request_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
```

**验证**: Docker执行migration → `\d llm_usage_logs` 确认表结构

---

## Step 6: P1-2 llm_configs扩展 + 种子数据

**文件**:
- `migrations/004_llm_usage_logs.sql` → 追加ALTER TABLE语句
- `app/db/models.py` → LLMConfig新增2列
- `scripts/seed_llm_configs_pricing.py` → 新建种子脚本

```sql
ALTER TABLE llm_configs ADD COLUMN IF NOT EXISTS input_price_per_1k DECIMAL(10,6) DEFAULT 0;
ALTER TABLE llm_configs ADD COLUMN IF NOT EXISTS output_price_per_1k DECIMAL(10,6) DEFAULT 0;

-- 清理旧配置，插入实际使用的qwen系列
DELETE FROM llm_configs;
INSERT INTO llm_configs (provider, model, input_price_per_1k, output_price_per_1k, temperature, max_tokens, top_p) VALUES
('qwen_plus', 'qwen3.6-plus', 0.002, 0.006, 0.7, 4096, 0.9),
('qwen_turbo', 'qwen-turbo', 0.0003, 0.0006, 0.7, 4096, 0.9),
('qwen_vl', 'qwen-vl-max', 0.003, 0.009, 0.7, 4096, 0.9),
('qwen_tts', 'qwen3-tts-flash', 0, 0.001, 0.7, 4096, 0.9);
```

**验证**: 执行SQL → `SELECT * FROM llm_configs` 确认4行qwen配置+价格

---

## Step 7: P1-3 llm.py植入成本记录 (核心)

**文件**: `app/services/llm.py`

关键发现: `_call_llm_internal` 使用同步 `requests` 库调用OpenAI兼容API，`result` dict包含 `result["usage"]` 但当前被丢弃。`call_llm` 只返回 `content` 字符串。

**修改方案**:

1. `_call_llm_internal` 返回值改为 `(content, usage_dict, model_id, provider_id)` 元组
2. `call_llm` 解包元组，返回content，同时调用 `_record_llm_cost`
3. 新增 `_record_llm_cost` 函数

```python
# 新增函数
async def _record_llm_cost(user_id, model, provider, scene_type, usage, request_id=None):
    """记录LLM调用成本到llm_usage_logs"""
    prompt_tokens = (usage or {}).get("prompt_tokens", 0) or 0
    completion_tokens = (usage or {}).get("completion_tokens", 0) or 0
    total_tokens = (usage or {}).get("total_tokens", 0) or 0

    # 从DB查价格 (fire-and-forget, 失败不影响主流程)
    try:
        from app.db.database import get_db_pool
        pool = get_db_pool()
        if pool:
            async with pool.acquire() as conn:
                config = await conn.fetchrow(
                    "SELECT input_price_per_1k, output_price_per_1k FROM llm_configs WHERE model = $1",
                    model
                )
                input_price = float(config["input_price_per_1k"]) if config else 0
                output_price = float(config["output_price_per_1k"]) if config else 0
                cost_yuan = (prompt_tokens / 1000) * input_price + (completion_tokens / 1000) * output_price

                await conn.execute(
                    """INSERT INTO llm_usage_logs
                    (user_id, model, provider, scene_type, prompt_tokens, completion_tokens,
                     total_tokens, cost_yuan, request_id, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())""",
                    user_id, model, provider, scene_type,
                    prompt_tokens, completion_tokens, total_tokens,
                    cost_yuan, request_id
                )
    except Exception as e:
        logger.warning(f"[LLM Cost] 记录失败(不影响主流程): {e}")
```

4. 修改 `_call_llm_internal`:
   - 在 `content = choice["message"]["content"]` 之后，提取 `usage = result.get("usage", {})`
   - 返回 `(content, usage, model_id, provider_id)`

5. 修改 `call_llm`:
   - 解包 `(content, usage, model_id, provider_id) = await _call_llm_internal(...)`
   - 在 `return content` 之前，fire-and-forget: `asyncio.create_task(_record_llm_cost(None, model_id, provider_id, scene_type.value if scene_type else None, usage))`
   - **注意**: `call_llm` 没有 `user_id` 参数，需要在调用方传入或暂时为NULL

6. `stream_llm` 类似处理: 流式响应的usage通常在最后一个chunk的 `usage` 字段中

**验证**: 重启服务 → 触发一次LLM请求 → `SELECT * FROM llm_usage_logs` 有记录

---

## Step 8: P1-3b 路由层传入user_id+scene_type

**文件**:
- `app/routes/chat.py` — agent_chat场景
- `app/routes/classrooms.py` — outline_generation/scene_generation
- `app/routes/question_course.py` — course_generation
- `app/routes/buddy.py` — buddy_chat
- `app/services/tts_service.py` — tts场景

这些路由已有 `user_id` 和 `db` 依赖。修改方案:

方案A (推荐): 在路由层调用 `call_llm` 后，手动调用 `_record_llm_cost`:
```python
from app.services.llm import _record_llm_cost
# ... 调用LLM后 ...
await _record_llm_cost(current_user_id, model, provider, "agent_chat", usage)
```

但 `call_llm` 不返回 usage。所以需要:
- 改 `call_llm` 签名增加 `user_id: Optional[str] = None` 参数
- `call_llm` 内部自动调用 `_record_llm_cost`
- 或者: 改 `call_llm` 返回 `LLMResult` dataclass 包含 content + usage

方案B (最小侵入): `call_llm` 新增 `record_cost=True, user_id=None` 参数，内部自动记录。

选择方案B，在 `call_llm` 签名加:
```python
async def call_llm(
    ...,
    user_id: Optional[str] = None,
    record_cost: bool = True,
) -> str:
```

**验证**: 触发聊天/课程生成 → `llm_usage_logs` 有对应scene_type的记录

---

## Step 9: P1-4 新建admin_finance.py路由

**文件**: `app/routes/admin_finance.py` → 新建

3个核心端点 + 2个管理端点:

1. `GET /admin/finance/overview` — 盈利总览 (收入/成本/利润/ARPU)
2. `GET /admin/finance/revenue` — 收入明细 (订单列表+聚合)
3. `GET /admin/finance/cost` — 成本明细 (LLM调用日志+聚合)
4. `GET /admin/finance/payments` — 支付回调记录
5. `GET /admin/orders` — 订单管理 (列表+退款)

详细API响应结构见文档 §9.1-9.7。

**main.py注册**:
```python
from app.routes import admin_finance
app.include_router(admin_finance.router, tags=["财务管理"])
```

**验证**: 重启服务 → curl各端点返回正确JSON结构

---

## Step 10: P1-5 重写/admin/statistics/economy + /admin/stats

**文件**: `app/routes/admin_full.py`

- `/stats` economy部分: revenue从 `orders WHERE status='paid'` 获取, `SUM(amount)/100` 转元
- `/statistics/economy`: 完全重写，查 orders + llm_usage_logs，返回收入+成本+利润趋势
- 新增 `/statistics/courses`: 从admin.py迁移

**验证**: curl `/admin/stats` + `/admin/statistics/economy` 返回真实数据(非0即正确)

---

## Step 11: P1-6 Phase 2后端 — 订单/订阅/课程管理

**文件**: `app/routes/admin_finance.py` (追加)

新增端点:
- `GET /admin/subscriptions` — 订阅列表
- `PATCH /admin/subscriptions/{id}` — 手动续期/升降级
- `PATCH /admin/orders/{id}/refund` — 标记退款
- `DELETE /admin/courses/{id}` — 删除课程
- `GET /admin/courses/{id}/scenes` — 查看场景
- `PATCH /admin/courses/{id}/status` — 上架/下架

**验证**: curl各端点

---

## Step 12: P1-7 增强用户详情API

**文件**: `app/routes/admin_full.py`

`GET /admin/users/{id}` 增强返回:
- subscriptions 状态
- token 余额 + 近10条流水
- point 余额 + 近10条流水
- 课程列表 (按用户)
- 签到记录

**验证**: curl `/admin/users/{id}` 返回增强数据

---

## Step 13: Phase 1前端 — 盈利看板3页面 + sidebar

**文件**:
- `packages/admin/app/(dashboard)/finance/page.tsx` → 新建 (盈利总览)
- `packages/admin/app/(dashboard)/finance/revenue/page.tsx` → 新建 (收入明细)
- `packages/admin/app/(dashboard)/finance/cost/page.tsx` → 新建 (成本明细)
- `packages/admin/components/sidebar.tsx` → 新增「财务管理」菜单组

每个页面:
- 无mock fallback，失败显示错误条
- recharts图表 (LineChart/BarChart/PieChart)
- 分页组件

**验证**: 打开admin后台 → /finance 页面渲染正确

---

## Step 14: Phase 2前端 — 订单/订阅/用户详情

**文件**:
- `packages/admin/app/(dashboard)/finance/orders/page.tsx` → 新建
- `packages/admin/app/(dashboard)/finance/subscriptions/page.tsx` → 新建
- `packages/admin/app/(dashboard)/users/[id]/page.tsx` → 新建 (用户详情)
- 赠币/禁用确认弹窗组件

**验证**: 各页面渲染正确

---

## Step 15: Phase 3 — JWT过期+RBAC+改密+限速

**文件**:
- `packages/admin/app/(dashboard)/layout.tsx` — JWT过期检测middleware
- `packages/admin/components/sidebar.tsx` — 按permissions动态显示
- `app/routes/admin_auth.py` — 新增 `POST /change-password` + 登录限速

---

## 风险与开放问题

| # | 风险 | 缓解 |
|---|------|------|
| 1 | orders=0, 盈利看板收入侧全0 | 显示"支付未上线"提示，成本侧先积累 |
| 2 | TTS按字符计费不按token | _record_llm_cost对TTS特殊处理: cost=字符数×单价 |
| 3 | 流式SSE响应usage可能缺失 | stream_llm累计total_tokens，无usage时按max_tokens估算上限 |
| 4 | llm_configs provider列值不匹配 | 种子脚本先DELETE旧配置再INSERT qwen系列 |
| 5 | /finance/overview多聚合查询可能慢 | 后期加Redis缓存(1h TTL)，初期数据量小不需要 |
| 6 | call_llm改返回值可能影响其他调用方 | 方案B: 保持返回str，新增user_id参数内部记录 |
