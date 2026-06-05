# 侧伴(CeBan)管理后台开发计划

> 2026-06-04 | 基于代码现状分析制定

---

## 一、现状分析

### 1.1 后端（3个路由文件，2544行）

| 文件 | 行数 | 状态 | 问题 |
|------|------|------|------|
| `admin_auth.py` | 690 | ✅ 可用 | 无密码修改、无登录限速 |
| `admin.py` | 1172 | ❌ 严重bug | SQL查`payments`表(不存在)、`transaction_type`列(实为`type`)、`tokens`列(实为`amount`)、`admin_logs` FK指向`users.id`(应为`admins.id`) |
| `admin_full.py` | 682 | ⚠️ 修过bug | SQL列名已纠正，RBAC感知，但未注册到main.py |

**main.py只注册了admin.router（旧版）**，admin_full.router 未注册，不会生效。

### 1.2 前端（packages/admin，Next.js 16）

| 页面 | 状态 | 问题 |
|------|------|------|
| `/login` | ✅ 可用 | 无JWT过期检测 |
| `/` Dashboard | ❌ 数据错 | 统计接口SQL有bug，`revenue_today`查的是Token数量而非金额 |
| `/users` | ⚠️ 基本可用 | 无详情页、无编辑、赠币/禁用按钮无交互 |
| `/admins` | ✅ 可用 | — |
| `/content/*` | ⚠️ 基本可用 | 无批量操作 |
| `/statistics/economy` | ❌ 不可用 | 查`payments`表不存在，全fallback到mock数据 |
| `/statistics/users` | ⚠️ 可能可用 | 需验证SQL |
| `/statistics/classrooms` | ⚠️ 可能可用 | 需验证SQL |
| `/settings/*` | ⚠️ 未验证 | 查`llm_configs`等表可能存在 |
| `/logs` | ❌ FK bug | JOIN users而非admins |

### 1.3 核心问题：收入和成本数据完全缺失

**收入侧**：
- `orders` 表存在（amount字段存金额分、status=paid表示已支付），但 admin.py **从未查询orders表**
- admin.py 把 `token_transactions.amount`（Token数量）误当成收入金额
- 无订阅收入统计、无订单明细、无支付渠道分布

**成本侧**：
- **零成本追踪**：LLM调用不记录token消耗（prompt_tokens/completion_tokens）
- `llm_configs`表只存配置（provider/model/api_key），无价格信息
- `generation_jobs`表只存状态，无成本字段
- `model_router.py`有场景→模型映射（qwen3.6-plus/qwen-turbo等），但不记录每次调用的实际token消耗
- TTS服务调用也不记录成本

---

## 二、开发计划

### Phase 0：基础修复（让后台能跑）[1-2天]

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 0.1 | 删除admin.py，启用admin_full.py | main.py | 注释`admin.router`，注册`admin_full.router` |
| 0.2 | 修admin_logs FK | models.py + migration | `admin_id` FK 改为引用 `admins.id` |
| 0.3 | 补admin表迁移SQL | migrations/ | 创建admins/admin_roles/admin_permissions等7张表 |
| 0.4 | 种子数据脚本 | scripts/seed_admin.py | 超级管理员+默认角色+权限码 |
| 0.5 | 修前端mock fallback | economy/page.tsx等 | API失败时显示错误而非假数据 |

### Phase 1：收入与成本追踪核心 [3-5天]

> **这是你的核心需求：看到整体成本和收入盈利情况**

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | **LLM调用成本记录** | services/llm.py | 每次LLM调用记录prompt_tokens/completion_tokens/model/cost到新表`llm_usage_logs` |
| 1.2 | **llm_usage_logs表** | models.py + migration | id, user_id, model, provider, scene_type, prompt_tokens, completion_tokens, cost_yuan(元), created_at |
| 1.3 | **TTS成本记录** | services/tts_service.py | 同上，记录TTS调用字符数+成本 |
| 1.4 | **模型价格配置** | admin路由 + llm_configs扩展 | llm_configs增加 input_price_per_1k/output_price_per_1k 字段（元/千token） |
| 1.5 | **收入统计API** | admin_full.py新增 | `/admin/finance/revenue` — 从orders表查真实收入（金额分→元），按日/月/渠道/类型(订阅vs Token)聚合 |
| 1.6 | **成本统计API** | admin_full.py新增 | `/admin/finance/cost` — 从llm_usage_logs查LLM成本+TTS成本，按日/月/模型/场景聚合 |
| 1.7 | **盈利概览API** | admin_full.py新增 | `/admin/finance/profit` — 收入-成本=利润，按日/月，含利润率、ARPU、CAC等 |

**模型价格参考（阿里云百炼2026年定价）**：

| 模型 | 输入价格(元/千token) | 输出价格(元/千token) | 备注 |
|------|---------------------|---------------------|------|
| qwen-turbo | 0.0003 | 0.0006 | 最便宜，用于批改等低级任务 |
| qwen-plus | 0.0008 | 0.002 | 中等，主要对话模型 |
| qwen3.6-plus | ~0.002 | ~0.006 | 高级推理，主模型 |
| qwen-vl-max | ~0.003 | ~0.009 | 多模态 |
| qwen3-tts-flash | ~0.001/字符 | — | 语音合成 |

> 注：实际价格需从阿里云百炼控制台确认，以上为估算。admin后台需要支持管理员手动配置价格。

### Phase 2：盈利Dashboard前端 [2-3天]

| # | 任务 | 说明 |
|---|------|------|
| 2.1 | **盈利概览页** `/finance` | 核心卡片：月收入、月成本、月利润、利润率；趋势折线图(收入vs成本vs利润) |
| 2.2 | **收入明细页** `/finance/revenue` | 订单列表+聚合：按日期、渠道(微信/支付宝)、类型(订阅/Token)筛选，recharts柱状图 |
| 2.3 | **成本明细页** `/finance/cost` | LLM调用列表+聚合：按模型、场景类型、日期筛选；成本占比饼图 |
| 2.4 | **模型价格配置页** `/settings/llm` 增强 | 增加输入/输出价格字段，支持管理员更新 |
| 2.5 | Sidebar增加"财务管理"入口 | sidebar.tsx 新增 Finance 分组 |

### Phase 3：运营管理完善 [3-4天]

| # | 任务 | 说明 |
|---|------|------|
| 3.1 | 用户详情页 | 完整profile：订阅状态、Token余额/流水、课程数、活跃度 |
| 3.2 | 订阅管理API | 查看/修改用户订阅（手动续期、降级、升级） |
| 3.3 | 订单管理API | 查看所有订单、支付回调、退款标记 |
| 3.4 | 课程管理 | 下架课程、查看场景内容 |
| 3.5 | 赠币/赠点交互 | 前端弹窗确认+后端校验 |
| 3.6 | JWT过期自动跳转 | 前端中间件检测401→跳转login |
| 3.7 | 删除mock fallback | 所有页面API失败显示错误，不伪造数据 |

### Phase 4：高级功能 [按需排期]

| # | 任务 | 说明 |
|---|------|------|
| 4.1 | 数据导出(CSV) | 用户列表、交易流水、课程数据 |
| 4.2 | RBAC权限UI | 根据管理员实际权限控制sidebar显示 |
| 4.3 | 实时Dashboard | SSE推送新订单/新注册 |
| 4.4 | 批量操作 | 批量审核/禁用/赠送 |
| 4.5 | 企业管理 | 企业CRUD、成员管理 |
| 4.6 | 管理员改密 | 密码修改功能 |
| 4.7 | 登录限速 | admin登录暴力破解防护 |

---

## 三、Phase 1 技术方案详情

### 3.1 LLM调用成本记录

**核心改动**：在 `services/llm.py` 的 `call_llm` / `stream_llm` 函数中，LLM响应返回后记录usage数据。

```python
# llm.py — 在LLM调用完成后插入
async def _log_llm_usage(user_id, model, provider, scene_type,
                          prompt_tokens, completion_tokens, cost_yuan):
    """记录LLM调用成本到llm_usage_logs表"""
    async with db.acquire() as conn:
        await conn.execute(
            """INSERT INTO llm_usage_logs
            (id, user_id, model, provider, scene_type,
             prompt_tokens, completion_tokens, cost_yuan, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
            uuid.uuid4(), user_id, model, provider, scene_type,
            prompt_tokens, completion_tokens, cost_yuan, utcnow()
        )
```

**成本计算**：
```python
cost_yuan = (prompt_tokens / 1000) * input_price
          + (completion_tokens / 1000) * output_price
```

价格从 `llm_configs` 表读取（新增 `input_price_per_1k` 和 `output_price_per_1k` 字段）。

### 3.2 新数据表

```sql
-- LLM调用成本日志
CREATE TABLE llm_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    model VARCHAR(50) NOT NULL,       -- qwen3.6-plus, qwen-turbo, etc.
    provider VARCHAR(50) NOT NULL,     -- qwen, openai, etc.
    scene_type VARCHAR(50),            -- agent_chat, scene_generation, etc.
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    cost_yuan DECIMAL(10,6) NOT NULL,  -- 本次调用成本(元)
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_llm_logs_date ON llm_usage_logs(DATE(created_at));
CREATE INDEX idx_llm_logs_model ON llm_usage_logs(model);
CREATE INDEX idx_llm_logs_user ON llm_usage_logs(user_id);
```

### 3.3 llm_configs 扩展

```sql
ALTER TABLE llm_configs ADD COLUMN input_price_per_1k DECIMAL(10,6) DEFAULT 0;
ALTER TABLE llm_configs ADD COLUMN output_price_per_1k DECIMAL(10,6) DEFAULT 0;
```

### 3.4 盈利统计API

```python
# /admin/finance/profit — 核心盈利接口
GET /admin/finance/profit?days=30

返回:
{
    "revenue": {
        "total": 1500.00,          # 本期总收入(元)
        "subscription": 380.00,    # 订阅收入
        "token_sale": 1120.00,     # Token销售收入
        "daily": [{date, amount}]  # 每日收入趋势
    },
    "cost": {
        "total": 45.30,            # 本期总成本(元)
        "llm": 42.50,             # LLM调用成本
        "tts": 2.80,              # TTS成本
        "daily": [{date, amount}], # 每日成本趋势
        "by_model": [{model, cost}], # 模型成本分布
        "by_scene": [{scene, cost}]  # 场景成本分布
    },
    "profit": {
        "total": 1454.70,          # 利润 = 收入 - 成本
        "margin": 96.98,           # 利润率%
        "arpu": 1.20,              # 人均收入(元/活跃用户)
        "daily": [{date, revenue, cost, profit}]  # 每日盈利趋势
    }
}
```

---

## 四、优先级与时间线

```
Phase 0 (1-2天) ──→ Phase 1 (3-5天) ──→ Phase 2 (2-3天) ──→ Phase 3 (3-4天)
  基础修复          成本收入追踪核心      盈利Dashboard前端      运营完善
                   ★ 核心需求 ★
```

**建议先做Phase 0 + Phase 1**，完成后就能在后端看到完整的成本收入盈利数据。Phase 2 前端展示紧跟。

---

## 五、风险提示

1. **LLM价格波动**：阿里云百炼价格可能调整，需要admin后台可配置（已在1.4中规划）
2. **LLM调用无usage返回**：部分API（尤其是流式SSE）可能不返回token数量。需要从response中提取`usage`字段，或在估算模式下按`max_tokens`做上限估算
3. **orders.amount是分**：统计收入时需 `/100` 转元
4. **测试环境数据量小**：初期可能看不到有意义的趋势数据，需要等上线后积累
5. **DB迁移需谨慎**：Phase 0 的admin表迁移如果已有数据在DB中，需确认不冲突