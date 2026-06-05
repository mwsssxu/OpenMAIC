# 侧伴(CeBan) 管理后台开发计划

## 成本与收入盈利分析

## v0.23 — 必须先修的

# 侧伴(CeBan) 管理后台开发计划

# version: 2.0
# date: 2026-06-04
# author: Hermes (AI assistant)

# scope: 1 重新修复现有 bug → 2 补充缺失数据 → 3 构建盈利看板
# priority: P0(阻断) / P1(运营必需) / P2(增强)

# reference: packages/server-python` + `packages/admin` + DB schema

# 
# ============================================================
# 
# ## 1. 现状总结
# 
# ### 后端 (3个路由文件)
# - admin_auth.py (690行) — 管理员登录/RBAC/权限， — 功能完整
# - admin.py (1172行) — 旧版管理API， — 有严重SQL bug
# - admin_full.py (682行) — 新版管理API (RBAC) — 未注册到main.py
# 
# ### 前端 (packages/admin, Next.js 16)
# - 13个页面 (dashboard/users/admins/content/statistics/settings/logs)
# - 全部 'use client' 客户端渲染
# - localStorage 存 token, 无 JWT 过期处理
# - API 夌了时静默 fallback 到 mock 数据, 无法调试
# - 无赠币/禁用确认弹窗, 无用户详情页
# 
# ### 数据库
# - orders 表: amount(分), token_amount, status, payment_method, created_at
# - token_transactions: type, amount(Token数), balance_after, description
# - subscriptions: plan_type, status, expires_at, started_at
# - payment_callbacks: order_id, provider, transaction_id, amount, status
# - 66张表, 但 admin 专属表无 migration SQL
# - 模型路由有 qwen3.6-plus/qwen-turbo/qwen-vl-max 等, 无单价定义
# 
# ### 成本数据缺失
# - 无 LLM API 调用日志 (prompt_tokens/completion_tokens/count)
# - 无 API 成本计算 (每次 LLM 调用花了多少钱)
# - 无基础设施成本记录
# 
# ============================================================
# 
# ## 2. P0 — 必须先修 (否则无法运行)
# 
# ### P0-1: 删除 admin.py, 保留 admin_full.py + 注册到 main.py
# 
# 两个文件都用 /admin 前缀, 路由冲突。 admin.py 有严重 SQL bug:
# - 查询不存在的 `payments` 表
# - 列名错误: `transaction_type` 应为 `type`
# - `admin_logs.admin_id` FK 引用 `users.id` 而非 `admins.id`
# - admin_full.py 是修正版本, 但未注册到 main.py
# 
# **操作**: 
# 1. 从 main.py 移除 `from app.routes import admin`
# 2. 改为 `from app.routes import admin_full`
# 3. 删除 admin.py
# 4. 将 admin_full.py 的 router prefix改为 /admin
# 
# ### P0-2: 补充 admin 表 migration SQL
# 
# admins, admin_roles, admin_role_assignments, admin_permissions, role_permissions,
# admin_sessions, login_logs, admin_logs, llm_configs, pricing_configs,
# reward_rules, review_reward_configs, system_settings
# 这些表在 models.py 中有定义但无 migration SQL 文件
# 
# **操作**: 创建 `migrations/003_admin_tables.sql`
# 
# ### P0-3: 种子数据脚本
# 
# 无初始超级管理员 + 默认角色 + 权限码, 系统无法使用
# 
# **操作**: 创建 `scripts/seed_admin.py`
# - 创建超级管理员 (admin@ceban.ai / 密码)
# - 创建默认角色: super_admin, content_admin, finance_admin
# - 创建默认权限码: user_manage, content_review, finance_view, system_config
# 
# ### P0-4: 修复 admin.py 的 SQL bug (合并到 admin_full.py)
# 
# 已在 P0-1 中处理 (删除 admin.py, 用 admin_full.py 替代)
# 
# admin_full.py 需要修复:
# - check_permission 需要实际传递 permission_code 参数
# - admin_logs JOIN 改为引用 admins 表
# - economy 统计查 orders 表而非 payments 表
# 
# ============================================================
# 
# ## 3. P1 — 成本与收入盈利看板 (运营必需)
# 
# 这是本次开发的核心需求。 需要看到:
# - 总收入 (orders.amount 汇总, 分/月/日/周)
# - LLM API 成本 (每次调用的 input/output tokens × 单价)
# - 毛利 = 收入 - LLM成本 - TTS成本
# - 人均 ARPU / 人均成本
# - 订阅 vs Token包 收入占比
# 
# ### P1-5: 新建 llm_usage_logs 表 + 记录逻辑
# 
# 每次 LLM API 调用记录:
# - user_id, model, provider
# - input_tokens, output_tokens, total_tokens
# - cost_yuan (自动计算: input_price × input_tokens + output_price × output_tokens)
# - scene_type (agent_chat, outline_generation, scene_generation 等)
# - request_id, created_at
# 
# **成本单价配置** (model_router.py 已有模型列表, 需要补充价格):
# 
# MODEL_PRICING = {
#     "qwen3.6-plus": {"input": 0.0004, "output": 0.0012},    # ¥0.4/M tokens input, ¥1.2/M output
#     "qwen-turbo": {"input": 0.0003, "output": 0.0006},    # ¥0.3/M input, ¥0.6/M output
#     "qwen-vl-max": {"input": 0.0004, "output": 0.0012},
#     "qwen3-tts-flash": {"input": 0, "output": 0.00005},     # TTS 按字符计费
# }
# 
# ### P1-6: 修改 llm.py — 在每次调用后自动写入 llm_usage_logs
# 
# 在 llm.py 的 chat_completion / stream_chat 中, 返回结果时:
# - 解析 usage.total_tokens (OpenAI 兼容格式)
# - 解析 usage.prompt_tokens / completion_tokens (如果有的话)
# - 按 model 查 MODEL_PRICING 计算成本
# - INSERT INTO llm_usage_logs
# 
# **影响范围**: chat.py, buddy.py, generate.py, classrooms.py, question_course.py, tts_service.py
# 这些路由在 LLM 调用后都需要记录成本
# 
# ### P1-7: 新建 admin 端点 — /admin/statistics/finance (成本收入总览)
# 
# 返回数据:
# - revenue: { today, this_week, this_month, trend[] }
#     - from orders WHERE status='paid'
#     - 按天/周/月汇总, 支持 trend 时间序列
# - cost: { today, this_week, this_month, by_model, trend[] }
#     - from llm_usage_logs
#     - 按天/周/月汇总, 支持 by model 分组
# - profit: { today, this_week, this_month, margin, trend[] }
#     - revenue - cost
# - per_user: { arpu, cost_per_user, margin_per_user }
#     - 收入/用户数, 成本/用户数
# - breakdown: { subscription_pct, token_pct, by_package }
#     - 订阅收入占比, Token包收入占比
# 
# ### P1-8: 前端 — 盈利看板页面
# 
# 新建 /statistics/finance 页面 (替换现有 economy 页面):
# - 收入卡片: 今日/本周/本月收入
# - 成本卡片: LLM成本(按模型分组), TTS成本
# - 利润卡片: 收入-成本=利润, 利润率
# - 人均指标: ARPU, 人均成本, 人均利润
# - 趋势图: 收入趋势, 成本趋势, 利润趋势 (recharts)
# - 分组饼图: 订阅 vs Token 收入占比
# 
# ============================================================
# 
# ## 4. P2 — 重要运营功能
# 
# ### P2-1: 订单/订阅管理 API
# - GET /admin/orders — 订单列表(筛选: status, date, user)
# - GET /admin/subscriptions — 订阅列表
# - GET /admin/payments — 支付回调列表
# 
# ### P2-2: 前端订单管理页面
# - 订单列表页, 订阅列表页, 支付记录页
# 
# ### P2-3: 用户编辑 API
# - PUT /admin/users/{id} — 修改昵称/邮箱/订阅层级
# 
# ### P2-4: 课程管理 API
# - DELETE /admin/courses/{id} — 删除课程
# - GET /admin/courses/{id}/scenes — 查看课程场景
# 
# ### P2-5: RBAC 权限 UI
# - sidebar 按权限动态显示/隐藏菜单
# - check_permission 传递具体 permission_code
# 
# ============================================================
# 
# ## 5. P3 — 增强功能
# 
# - 数据导出 (CSV)
# - 管理员改密
# - 登录限速
# - Pydantic 请求校验
# - 批量操作
# - Dashboard 实时推送
# 
# ============================================================
# 
# ## 6. 执行顺序
# 
# P0 → P1 → P2 → P3
# 
# P0 阻断性问题,必须先修, 否则整个管理后台无法运行
# P1 成本收入看板是核心业务需求, 要优先实现
# P2 是日常运营需要的工具
# P3 是锦上添花