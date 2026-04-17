# 商业模式闭环断裂修复方案

## 概述

本文档针对 OpenMAIC Business 商业模式中发现的 6 个关键闭环断裂点，提供完整的设计方案和实现路径。

---

## 🔴 断裂点 1：积分/Token 兑换比率严重失衡

### 问题分析

**现状：**
- 兑换比例：100 积分 → 10 Token（代码 tokens.py:146）
- 课程生成消耗：10-50 Token
- 完成课程赚取：10-50 积分

**断裂计算：**
```
生成 1 次中等课程（30 Token）需要 300 积分
需要完成约 6-30 个课程才能兑换 1 次
活跃用户无法靠积分支撑持续学习
```

### 修复方案

#### 方案 A：调整兑换比例（推荐）

**新比例：**
| 兑换档位 | 积分消耗 | Token 获得 | 适用场景 |
|---------|---------|-----------|---------|
| 小额兑换 | 50 积分 | 10 Token | 生成短课程 |
| 标准兑换 | 100 积分 | 25 Token | 生成中等课程 |
| 大额兑换 | 200 积分 | 60 Token | 生成长课程 |

**实现改动：**

```python
# tokens.py - 修改 exchange_points_to_tokens
TOKEN_EXCHANGE_RATES = {
    "small": {"points": 50, "tokens": 10},
    "standard": {"points": 100, "tokens": 25},
    "large": {"points": 200, "tokens": 60},
}

@router.post("/exchange")
async def exchange_points_to_tokens(body: dict, ...):
    tier = body.get("tier", "standard")
    if tier not in TOKEN_EXCHANGE_RATES:
        raise HTTPException(status_code=400, detail="无效兑换档位")

    points = TOKEN_EXCHANGE_RATES[tier]["points"]
    tokens = TOKEN_EXCHANGE_RATES[tier]["tokens"]
    # ... 原有逻辑
```

#### 方案 B：增加积分来源

**新增积分渠道：**

| 来源 | 积分数量 | 触发条件 | 实现难度 |
|------|----------|---------|---------|
| 联赛周奖励 | 50-200 | 周排名前 30% | 低（已设计） |
| 徽章解锁 | 20-100 | 完成成就 | 低（已设计） |
| 邀请好友注册 | 50 + 20Token | 一级邀请 | 低（已实现） |
| 笔记被点赞 | 2 积分/赞 | 每日上限 20 | 中 |
| 首次评价课程 | 10 积分 | 每课程限 1 次 | 中 |

**数据表改动：**

```sql
-- 新增积分来源类型
ALTER TABLE point_transactions
ADD COLUMN source_detail VARCHAR(100);  -- 来源详情（如徽章名称）

-- 更新 POINT_SOURCES 配置
POINT_SOURCES = {
    ...
    "league": {"description": "联赛奖励", "min": 50, "max": 200},
    "badge": {"description": "徽章解锁", "min": 20, "max": 100},
    "note_like": {"description": "笔记被点赞", "min": 2, "max": 20},
    "course_rating": {"description": "评价课程", "min": 10, "max": 10},
}
```

#### 方案 C：动态兑换系数（长期）

根据用户活跃度动态调整兑换效率：

```python
def calculate_exchange_rate(user_id: str) -> float:
    """活跃用户享受更高兑换效率"""
    streak_days = get_user_streak(user_id)
    league_level = get_user_league(user_id)

    base_rate = 0.25  # 100积分 = 25Token

    # 连续打卡加成
    streak_bonus = min(streak_days * 0.02, 0.2)  # 最高 +20%

    # 联赛等级加成
    league_bonus = {"bronze": 0, "silver": 0.05, "gold": 0.1, "diamond": 0.15}

    return base_rate + streak_bonus + league_bonus.get(league_level, 0)
```

### 实现路径

| 阶段 | 改动 | 预计时间 |
|------|------|---------|
| Phase 1 | 调整兑换比例（方案A） | 1 天 |
| Phase 2 | 新增积分来源（方案B） | 3 天 |
| Phase 3 | 动态兑换系数（方案C） | 2 天 |

---

## 🔴 断裂点 2：会员订阅与 Token 系统割裂

### 问题分析

**现状：**
- 新用户礼包包含「7天高级会员」（points.py:268-303）
- 会员权益完全未定义
- 无会员专属功能设计
- 无续费动力

### 修复方案

#### 会员权益体系设计

| 权益 | 免费用户 | 高级会员 | 企业会员 |
|------|---------|---------|---------|
| 每日课程生成 | 2 次 | 无限 | 无限 |
| Token 购买加成 | 0% | +10% | +20% |
| 积分获取加成 | 0% | +20% | +30% |
| 专属课程库 | 无 | 有 | 有 |
| 协作课堂容量 | 10 人 | 50 人 | 无限 |
| 学习数据分析 | 基础 | 详细 | 企业级 |
| 白板存储 | 30 天 | 永久 | 永久 |
| AI 模型 | GPT-4o-mini | GPT-4o | GPT-4o + 定制 |

#### 数据表设计

```sql
-- 会员订阅表
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    plan_type VARCHAR(20) NOT NULL,  -- 'free', 'premium', 'enterprise'
    status VARCHAR(20) NOT NULL,  -- 'active', 'expired', 'cancelled'
    started_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    auto_renew BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at);

-- 会员权益使用记录
CREATE TABLE subscription_usage (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    feature VARCHAR(50) NOT NULL,  -- 'course_generation', 'collaboration'
    usage_count INTEGER DEFAULT 0,
    reset_at TIMESTAMP,  -- 每日/每月重置时间
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API 设计

```python
# subscriptions.py

@router.get("/status")
async def get_subscription_status(...):
    """获取会员状态和权益"""
    subscription = await get_user_subscription(user_id)

    return {
        "plan_type": subscription["plan_type"],
        "status": subscription["status"],
        "expires_at": subscription["expires_at"],
        "features": get_plan_features(subscription["plan_type"]),
        "usage": await get_usage_stats(user_id),
    }

@router.post("/upgrade")
async def upgrade_subscription(body: dict, ...):
    """升级会员"""
    plan_type = body.get("plan_type")
    payment_method = body.get("payment_method")

    # 定价
    PLAN_PRICES = {
        "premium_monthly": 2900,  # ¥29/月
        "premium_yearly": 29000,  # ¥290/年（优惠 17%）
        "enterprise_monthly": 9900,  # ¥99/月
    }

    # 创建订阅订单
    order = await create_subscription_order(user_id, plan_type, payment_method)
    return order

@router.post("/cancel")
async def cancel_subscription(...):
    """取消自动续费"""
    await update_subscription(user_id, auto_renew=False)
    return {"message": "已取消自动续费，会员权益将在到期后失效"}
```

#### 权益检查中间件

```python
# feature_gate.py

async def check_feature_access(user_id: str, feature: str, db: Connection):
    """检查用户是否有权限使用某功能"""
    subscription = await get_user_subscription(user_id)
    plan_features = get_plan_features(subscription["plan_type"])

    if feature not in plan_features:
        raise FeatureNotAvailableError(feature)

    # 检查使用限制（如每日课程生成次数）
    usage = await get_usage_stats(user_id, feature)
    limit = plan_features[feature]["limit"]

    if usage >= limit:
        raise UsageLimitExceededError(feature, limit)

    return True

# 课程生成时使用
async def generate_course(user_id: str, ...):
    await check_feature_access(user_id, "course_generation", db)
    # ... 生成逻辑
    await increment_usage(user_id, "course_generation", db)
```

#### 新用户礼包修改

```python
# points.py - 修改 grant_new_user_package

@router.post("/new_user_package")
async def grant_new_user_package(...):
    # 发放积分和Token（原有）
    await earn_points_internal(db, user_uuid, "new_user", 500)
    await reward_tokens_internal(db, user_uuid, 200, "新用户礼包")

    # 新增：创建 7 天试用会员
    trial_ends_at = datetime.utcnow() + timedelta(days=7)
    await db.execute(
        """
        INSERT INTO subscriptions (id, user_id, plan_type, status, started_at, expires_at)
        VALUES ($1, $2, 'premium', 'trial', $3, $4)
        """,
        uuid.uuid4(), user_uuid, datetime.utcnow(), trial_ends_at
    )

    # 记录权益使用
    await db.execute(
        """
        INSERT INTO subscription_usage (id, user_id, feature, reset_at)
        VALUES ($1, $2, 'course_generation', $3)
        """,
        uuid.uuid4(), user_uuid, datetime.utcnow() + timedelta(days=1)
    )

    return {
        "points": 500,
        "tokens": 200,
        "trial_subscription": {
            "plan_type": "premium",
            "expires_at": trial_ends_at.isoformat(),
            "features": get_plan_features("premium"),
        },
        "message": "新用户礼包已发放，包含 7 天高级会员试用",
    }
```

### 实现路径

| 阶段 | 改动 | 预计时间 |
|------|------|---------|
| Phase 1 | 数据表创建 + API 设计 | 2 天 |
| Phase 2 | 权益中间件集成 | 2 天 |
| Phase 3 | 支付流程集成 | 3 天 |
| Phase 4 | UI 实现（主项目 + 移动端） | 4 天 |

---

## 🔴 断裂点 3：企业客户路径完全缺失

### 问题分析

**现状：**
- 目标用户包含「企业管理者」
- 但无团队管理入口
- 无批量采购方案
- 无企业后台
- 无员工数据归属权

### 修复方案

#### 企业功能模块设计

```
企业功能模块
├── 组织管理
│   ├── 创建企业账户
│   ├── 团队成员管理
│   └── 权限角色配置
├── Token 批量采购
│   ├── 企业专属套餐
│   ├── Token 分发系统
│   └── 使用统计
├── 员工学习数据
│   ├── 学习进度看板
│   ├── 课程完成统计
│   ├── 积分排行榜
├── 企业后台
│   ├── 数据导出
│   ├── 合规报告
│   └── 告警设置
```

#### 数据表设计

```sql
-- 组织表
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    plan_type VARCHAR(20) NOT NULL,  -- 'team', 'enterprise'
    max_members INTEGER DEFAULT 10,
    token_pool INTEGER DEFAULT 0,  -- 企业 Token 池
    created_at TIMESTAMP DEFAULT NOW()
);

-- 组织成员表
CREATE TABLE organization_members (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL,  -- 'owner', 'admin', 'member'
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(org_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- 企业 Token 分发记录
CREATE TABLE org_token_distributions (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    distributed_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 企业订单表（批量采购）
CREATE TABLE org_orders (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id),
    amount INTEGER NOT NULL,
    token_amount INTEGER NOT NULL,
    payment_method VARCHAR(20),
    status VARCHAR(20) DEFAULT 'created',
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 企业套餐定价

| 套餐 | 价格 | Token 数量 | 成员上限 | 特权 |
|------|------|-----------|---------|------|
| 团队版 | ¥199/月 | 2000/月 | 10 人 | 基础看板 |
| 企业版 | ¥499/月 | 5000/月 | 50 人 | 高级看板 + API |
| 大企业版 | ¥1999/月 | 20000/月 | 无限 | 定制 + 专属支持 |

#### API 设计

```python
# organizations.py

@router.post("/create")
async def create_organization(body: dict, ...):
    """创建企业账户"""
    name = body.get("name")
    plan_type = body.get("plan_type", "team")

    org = await db.execute(
        """
        INSERT INTO organizations (id, name, owner_id, plan_type, max_members)
        VALUES ($1, $2, $3, $4, $5)
        """,
        uuid.uuid4(), name, user_uuid, plan_type,
        get_plan_member_limit(plan_type)
    )
    return org

@router.post("/{org_id}/members/invite")
async def invite_member(org_id: str, body: dict, ...):
    """邀请团队成员"""
    email = body.get("email")
    role = body.get("role", "member")

    # 检查成员上限
    org = await get_organization(org_id)
    current_count = await get_member_count(org_id)
    if current_count >= org["max_members"]:
        raise HTTPException(400, "已达到成员上限")

    # 发送邀请邮件
    invite_link = generate_invite_link(org_id, email, role)
    await send_email(email, f"邀请加入 {org['name']}", invite_link)

@router.post("/{org_id}/tokens/distribute")
async def distribute_tokens(org_id: str, body: dict, ...):
    """分发 Token 给成员"""
    members = body.get("members")  # [{user_id, amount}, ...]
    total = sum(m["amount"] for m in members)

    # 检查企业 Token 池
    org = await get_organization(org_id)
    if org["token_pool"] < total:
        raise HTTPException(400, "企业 Token 池不足")

    async with db.transaction():
        for m in members:
            # 从企业池扣减
            await db.execute(
                "UPDATE organizations SET token_pool = token_pool - $1 WHERE id = $2",
                m["amount"], org_id
            )
            # 给成员发放
            await reward_tokens_internal(db, m["user_id"], m["amount"], "企业分发")
            # 记录分发
            await db.execute(
                """
                INSERT INTO org_token_distributions (id, org_id, user_id, amount, distributed_by)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.uuid4(), org_id, m["user_id"], m["amount"], user_uuid
            )

@router.get("/{org_id}/dashboard")
async def get_org_dashboard(org_id: str, ...):
    """企业数据看板"""
    return {
        "members": await get_member_stats(org_id),
        "token_usage": await get_token_usage_stats(org_id),
        "learning_progress": await get_learning_stats(org_id),
        "top_performers": await get_top_members(org_id, limit=10),
    }
```

#### 员工数据归属权设计

```python
# policies.py - 数据归属策略

ORG_DATA_POLICY = {
    "personal_notes": "user",  # 个人笔记归属用户
    "course_history": "org",  # 课程学习记录归属企业
    "learning_progress": "org",  # 学习进度归属企业
    "point_transactions": "user",  # 积分流水归属用户
    "token_usage": "org",  # Token 使用记录归属企业
}

async def handle_org_member_leave(org_id: str, user_id: str, db: Connection):
    """处理成员离职"""
    for data_type, ownership in ORG_DATA_POLICY.items():
        if ownership == "org":
            # 企业数据保留
            await archive_org_data(org_id, user_id, data_type)
        else:
            # 用户数据保留给用户
            pass

    # 归还未使用的企业 Token
    unused_tokens = await get_org_distributed_tokens(org_id, user_id)
    if unused_tokens > 0:
        await db.execute(
            "UPDATE organizations SET token_pool = token_pool + $1 WHERE id = $2",
            unused_tokens, org_id
        )
```

### 实现路径

| 阶段 | 改动 | 预计时间 |
|------|------|---------|
| Phase 1 | 数据表设计 + 组织管理 API | 3 天 |
| Phase 2 | Token 分发系统 | 2 天 |
| Phase 3 | 企业数据看板 | 3 天 |
| Phase 4 | UI 实现（企业后台） | 5 天 |

---

## 🔴 断裂点 4：用户反馈 → 内容优化缺失

### 问题分析

**现状：**
- 课程由 AI 生成后直接消费
- 无评分系统
- 无反馈渠道
- 无迭代机制

### 修复方案

#### 课程评价系统设计

```sql
-- 课程评价表
CREATE TABLE course_ratings (
    id UUID PRIMARY KEY,
    stage_id UUID NOT NULL REFERENCES stages(id),
    user_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(stage_id, user_id)  -- 每用户每课程限评价一次
);

CREATE INDEX idx_course_ratings_stage ON course_ratings(stage_id);

-- 课程问题反馈表
CREATE TABLE course_feedbacks (
    id UUID PRIMARY KEY,
    stage_id UUID NOT NULL REFERENCES stages(id),
    scene_id UUID REFERENCES scenes(id),
    user_id UUID NOT NULL REFERENCES users(id),
    feedback_type VARCHAR(50) NOT NULL,  -- 'error', 'inaccurate', 'missing', 'suggestion'
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'reviewed', 'fixed'
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API 设计

```python
# ratings.py

@router.post("/course/{stage_id}")
async def rate_course(stage_id: str, body: dict, ...):
    """评价课程"""
    rating = body.get("rating")  # 1-5
    feedback = body.get("feedback", "")

    if rating < 1 or rating > 5:
        raise HTTPException(400, "评分必须在 1-5 之间")

    # 检查是否已评价
    existing = await db.fetchrow(
        "SELECT id FROM course_ratings WHERE stage_id = $1 AND user_id = $2",
        stage_id, user_uuid
    )
    if existing:
        raise HTTPException(400, "已评价过此课程")

    await db.execute(
        """
        INSERT INTO course_ratings (id, stage_id, user_id, rating, feedback)
        VALUES ($1, $2, $3, $4, $5)
        """,
        uuid.uuid4(), stage_id, user_uuid, rating, feedback
    )

    # 奖励积分（首次评价）
    await earn_points_internal(db, user_uuid, "course_rating", 10)

    return {"rating": rating, "points_earned": 10}

@router.get("/course/{stage_id}/stats")
async def get_course_rating_stats(stage_id: str, ...):
    """获取课程评分统计"""
    stats = await db.fetchrow(
        """
        SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings,
               COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_count
        FROM course_ratings WHERE stage_id = $1
        """,
        stage_id
    )
    return stats

# feedbacks.py

@router.post("/course/{stage_id}/feedback")
async def submit_course_feedback(stage_id: str, body: dict, ...):
    """提交课程问题反馈"""
    feedback_type = body.get("type")  # error, inaccurate, missing, suggestion
    scene_id = body.get("scene_id")
    content = body.get("content")

    await db.execute(
        """
        INSERT INTO course_feedbacks (id, stage_id, scene_id, user_id, feedback_type, content)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        uuid.uuid4(), stage_id, scene_id, user_uuid, feedback_type, content
    )

    return {"message": "反馈已提交，感谢您的宝贵意见"}
```

#### AI 内容迭代机制

```python
# course_improvement.py

async def check_course_quality(stage_id: str, db: Connection):
    """检查课程质量阈值"""
    stats = await get_course_rating_stats(stage_id)

    # 低质量阈值
    if stats["avg_rating"] < 3.5 and stats["total_ratings"] >= 10:
        await trigger_course_review(stage_id, stats)

async def trigger_course_review(stage_id: str, stats: dict):
    """触发课程审查"""
    feedbacks = await get_course_feedbacks(stage_id)

    # 分类反馈
    error_feedbacks = [f for f in feedbacks if f["type"] == "error"]
    inaccurate_feedbacks = [f for f in feedbacks if f["type"] == "inaccurate"]

    if len(error_feedbacks) > 5:
        # 自动标记为需要修复
        await update_course_status(stage_id, "needs_revision")

        # 通知课程作者
        stage = await get_stage(stage_id)
        await notify_user(stage["user_id"], "您的课程收到多条错误反馈，建议检查")

async def regenerate_scene_from_feedback(stage_id: str, scene_id: str, feedback: dict):
    """基于反馈重新生成场景"""
    # 获取原始场景
    scene = await get_scene(scene_id)

    # 构建修复提示
    fix_prompt = f"""
    原场景内容存在问题，用户反馈如下：
    类型：{feedback['feedback_type']}
    内容：{feedback['content']}

    请根据反馈重新生成更准确的内容。
    """

    # 调用 AI 重新生成
    new_content = await generate_scene_content(fix_prompt)

    # 保存新版本
    await update_scene(scene_id, new_content)

    # 标记反馈已处理
    await db.execute(
        "UPDATE course_feedbacks SET status = 'fixed' WHERE id = $1",
        feedback["id"]
    )
```

#### UI 组件设计

```tsx
// CourseRatingWidget.tsx

interface RatingWidgetProps {
  stageId: string;
  onComplete?: () => void;
}

export function CourseRatingWidget({ stageId, onComplete }: RatingWidgetProps) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async () => {
    await apiClient.post(`/ratings/course/${stageId}`, {
      rating,
      feedback,
    });
    onComplete?.();
  };

  return (
    <div className="rating-widget">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button onClick={() => setRating(n)}>
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <textarea
        placeholder="您对这个课程有什么建议？"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <button onClick={handleSubmit}>提交评价（获得 10 积分）</button>
    </div>
  );
}

// FeedbackButton.tsx - 场景内反馈按钮
export function FeedbackButton({ stageId, sceneId }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>反馈问题</button>
      {isOpen && (
        <FeedbackModal
          stageId={stageId}
          sceneId={sceneId}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

### 实现路径

| 阶段 | 改动 | 预计时间 |
|------|------|---------|
| Phase 1 | 评价数据表 + API | 2 天 |
| Phase 2 | 反馈系统 + UI | 3 天 |
| Phase 3 | 质量检查 + 自动审查 | 2 天 |
| Phase 4 | AI 迭代修复 | 3 天 |

---

## 🔴 断裂点 5：学习匹配 → 协同学习缺失

### 问题分析

**现状：**
- 匹配算法设计完善（设计文档）
- 但匹配后无协同场景
- 匹配变成单向展示

### 修复方案

#### 协同学习场景设计

```
协同学习流程
├── 匹配成功
│   ├── 显示推荐用户列表
│   ├── 发起协同邀请
│   └── 接受/拒绝邀请
├── 协同课堂
│   ├── 共享课程进度
│   ├── 实时讨论区
│   ├── 协作白板
│   └── 学习里程碑
├── 协同结束
│   ├── 学习总结
│   ├── 互评系统
│   └── 再次匹配建议
```

#### 数据表设计

```sql
-- 学习匹配邀请表
CREATE TABLE match_invitations (
    id UUID PRIMARY KEY,
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID NOT NULL REFERENCES users(id),
    stage_id UUID NOT NULL REFERENCES stages(id),
    status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, rejected, expired
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 协同学习会话表
CREATE TABLE collaborative_sessions (
    id UUID PRIMARY KEY,
    stage_id UUID NOT NULL REFERENCES stages(id),
    user_ids UUID[] NOT NULL,  -- 参与者列表
    status VARCHAR(20) DEFAULT 'active',
    progress_sync JSONB,  -- 各用户进度同步
    shared_whiteboard JSONB,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- 协同学习记录表
CREATE TABLE collaborative_records (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES collaborative_sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    progress INTEGER DEFAULT 0,
    contributions INTEGER DEFAULT 0,  -- 贡献度（发言次数等）
    peer_rating INTEGER,  -- 伙伴评分
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API 设计

```python
# matching.py

@router.post("/invite")
async def send_match_invite(body: dict, ...):
    """发送协同学习邀请"""
    to_user_id = body.get("user_id")
    stage_id = body.get("stage_id")

    # 检查用户是否在线
    user_online = await check_user_online(to_user_id)

    invite = await db.execute(
        """
        INSERT INTO match_invitations (id, from_user_id, to_user_id, stage_id, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        """,
        uuid.uuid4(), user_uuid, to_user_id, stage_id,
        datetime.utcnow() + timedelta(hours=24)
    )

    # 实时通知（WebSocket）
    if user_online:
        await notify_user(to_user_id, {
            "type": "match_invite",
            "from": user_uuid,
            "stage_id": stage_id,
        })

    return invite

@router.post("/invite/{invite_id}/accept")
async def accept_match_invite(invite_id: str, ...):
    """接受协同邀请"""
    invite = await get_invite(invite_id)

    if invite["to_user_id"] != user_uuid:
        raise HTTPException(403, "无权限")

    if invite["expires_at"] < datetime.utcnow():
        raise HTTPException(400, "邀请已过期")

    # 创建协同会话
    session = await db.execute(
        """
        INSERT INTO collaborative_sessions (id, stage_id, user_ids)
        VALUES ($1, $2, ARRAY[$3, $4])
        """,
        uuid.uuid4(), invite["stage_id"], invite["from_user_id"], user_uuid
    )

    # 更新邀请状态
    await db.execute(
        "UPDATE match_invitations SET status = 'accepted' WHERE id = $1",
        invite_id
    )

    # 通知发起者
    await notify_user(invite["from_user_id"], {
        "type": "match_accepted",
        "session_id": session["id"],
    })

    return session

@router.get("/session/{session_id}")
async def get_collaborative_session(session_id: str, ...):
    """获取协同会话详情"""
    session = await get_session(session_id)

    return {
        "stage": await get_stage(session["stage_id"]),
        "partners": await get_session_users(session["user_ids"]),
        "progress": session["progress_sync"],
        "whiteboard": session["shared_whiteboard"],
        "chat_history": await get_session_chat(session_id),
    }

@router.post("/session/{session_id}/sync")
async def sync_learning_progress(session_id: str, body: dict, ...):
    """同步学习进度"""
    progress = body.get("progress")  # 当前场景索引

    session = await get_session(session_id)

    # 更新进度同步
    progress_sync = session["progress_sync"] or {}
    progress_sync[user_uuid] = {
        "progress": progress,
        "updated_at": datetime.utcnow(),
    }

    await db.execute(
        "UPDATE collaborative_sessions SET progress_sync = $1 WHERE id = $2",
        json.dumps(progress_sync), session_id
    )

    # 广播给伙伴
    for partner_id in session["user_ids"]:
        if partner_id != user_uuid:
            await notify_user(partner_id, {
                "type": "progress_sync",
                "user": user_uuid,
                "progress": progress,
            })

@router.post("/session/{session_id}/end")
async def end_collaborative_session(session_id: str, body: dict, ...):
    """结束协同学习"""
    peer_rating = body.get("peer_rating")  # 1-5 评价伙伴

    session = await get_session(session_id)

    # 记录学习成果
    for uid in session["user_ids"]:
        await db.execute(
            """
            INSERT INTO collaborative_records (id, session_id, user_id, peer_rating)
            VALUES ($1, $2, $3, $4)
            """,
            uuid.uuid4(), session_id, uid, peer_rating.get(str(uid))
        )

    # 更新会话状态
    await db.execute(
        "UPDATE collaborative_sessions SET status = 'ended', ended_at = $1 WHERE id = $2",
        datetime.utcnow(), session_id
    )

    # 奖励积分
    await earn_points_internal(db, user_uuid, "collaboration", 20)

    return {"points_earned": 20}
```

#### 协同课堂 UI

```tsx
// CollaborativeClassroom.tsx

export function CollaborativeClassroom({ sessionId }) {
  const [partners, setPartners] = useState([]);
  const [sharedProgress, setSharedProgress] = useState({});
  const [chatMessages, setChatMessages] = useState([]);

  useEffect(() => {
    // WebSocket 连接
    ws.connect(`/collaborative/${sessionId}/ws`, {
      onMessage: (msg) => {
        if (msg.type === "progress_sync") {
          setSharedProgress((prev) => ({
            ...prev,
            [msg.user]: msg.progress,
          }));
        }
        if (msg.type === "chat") {
          setChatMessages((prev) => [...prev, msg]);
        }
      },
    });
  }, []);

  return (
    <div className="collaborative-classroom">
      <PartnerProgressBar partners={partners} progress={sharedProgress} />
      <CoursePlayer />
      <CollaborativeChat messages={chatMessages} />
      <SharedWhiteboard />
    </div>
  );
}

// PartnerProgressBar.tsx - 显示伙伴进度
export function PartnerProgressBar({ partners, progress }) {
  return (
    <div className="partner-progress">
      {partners.map((p) => (
        <div key={p.id}>
          <Avatar user={p} />
          <ProgressBar value={progress[p.id] || 0} />
          {progress[p.id] > 0 && <span>场景 {progress[p.id]}</span>}
        </div>
      ))}
    </div>
  );
}
```

#### 匹配后协同入口

```tsx
// MatchResultList.tsx - 匹配结果页添加协同入口

export function MatchResultList({ matches }) {
  return (
    <div className="match-results">
      {matches.map((m) => (
        <MatchCard key={m.user_id} match={m}>
          <button onClick={() => inviteCollaboration(m.user_id)}>
            邀请一起学习
          </button>
          <button onClick={() => viewProfile(m.user_id)}>
            查看资料
          </button>
        </MatchCard>
      ))}
    </div>
  );
}
```

### 实现路径

| 阶段 | 改动 | 预计时间 |
|------|------|---------|
| Phase 1 | 数据表 + 邀请 API | 2 天 |
| Phase 2 | 协同会话 + 进度同步 | 3 天 |
| Phase 3 | WebSocket 协同通信 | 3 天 |
| Phase 4 | UI 实现（协同课堂） | 4 天 |

---

## 🔴 断裂点 6：课程完成 → 后续路径缺失

### 问题分析

**现状：**
- 课程完成有积分奖励
- 但无后续学习引导
- 学习旅程中断

### 修复方案

#### 学习路径推荐系统

```sql
-- 课程关联表（用于推荐）
CREATE TABLE course_relations (
    id UUID PRIMARY KEY,
    source_stage_id UUID NOT NULL REFERENCES stages(id),
    target_stage_id UUID NOT NULL REFERENCES stages(id),
    relation_type VARCHAR(50) NOT NULL,  -- 'next', 'related', 'advanced', 'prerequisite'
    weight FLOAT DEFAULT 1.0,  -- 相关度权重
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_course_relations_source ON course_relations(source_stage_id);

-- 学习路径表
CREATE TABLE learning_paths (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    stage_ids UUID[] NOT NULL,  -- 课程序列
    current_index INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 用户学习计划表
CREATE TABLE learning_plans (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    goal VARCHAR(255),  -- 学习目标
    daily_target INTEGER DEFAULT 30,  -- 每日学习目标（分钟）
    weekly_courses INTEGER DEFAULT 3,  -- 每周课程目标
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### API 设计

```python
# recommendations.py

@router.get("/course/{stage_id}/next")
async def get_next_courses(stage_id: str, ...):
    """获取后续推荐课程"""
    # 获取关联课程
    relations = await db.fetch(
        """
        SELECT target_stage_id, relation_type, weight
        FROM course_relations
        WHERE source_stage_id = $1
        ORDER BY weight DESC
        """,
        stage_id
    )

    # 根据用户历史过滤
    user_history = await get_user_completed_courses(user_uuid)

    recommendations = []
    for r in relations:
        if r["target_stage_id"] not in user_history:
            stage = await get_stage(r["target_stage_id"])
            recommendations.append({
                "stage": stage,
                "relation": r["relation_type"],
                "weight": r["weight"],
            })

    return recommendations[:5]  # 返回前 5 个推荐

@router.post("/course/{stage_id}/complete")
async def complete_course(stage_id: str, ...):
    """完成课程（增强版）"""
    # 原有积分奖励
    await earn_points_internal(db, user_uuid, "course", 30)

    # 新增：后续推荐
    next_courses = await get_next_courses(stage_id, user_uuid)

    # 新增：生成学习总结
    summary = await generate_course_summary(stage_id, user_uuid)

    # 新增：更新学习路径进度
    await update_learning_path_progress(user_uuid, stage_id)

    return {
        "points_earned": 30,
        "summary": summary,
        "next_courses": next_courses,
        "path_progress": await get_path_progress(user_uuid),
    }

@router.post("/plan/generate")
async def generate_learning_plan(body: dict, ...):
    """AI 生成学习计划"""
    goal = body.get("goal")  # "掌握 Python 数据分析"
    duration = body.get("duration", 30)  # 学习周期（天）

    # 调用 AI 生成路径
    plan_prompt = f"""
    用户学习目标：{goal}
    学习周期：{duration} 天
    请生成结构化的学习路径，包含：
    1. 课程序列（从基础到高级）
    2. 每日学习建议
    3. 阶段里程碑
    """

    plan = await ai_generate_plan(plan_prompt)

    # 保存学习路径
    path = await db.execute(
        """
        INSERT INTO learning_paths (id, user_id, name, stage_ids)
        VALUES ($1, $2, $3, $4)
        """,
        uuid.uuid4(), user_uuid, goal, plan["stage_ids"]
    )

    return path

@router.get("/plan/progress")
async def get_learning_plan_progress(...):
    """获取学习计划进度"""
    path = await get_active_path(user_uuid)

    if not path:
        return {"message": "暂无活跃学习计划"}

    completed = path["current_index"]
    total = len(path["stage_ids"])

    return {
        "path_name": path["name"],
        "completed": completed,
        "total": total,
        "progress_percent": (completed / total) * 100,
        "next_course": await get_stage(path["stage_ids"][completed]),
        "estimated_days_remaining": await estimate_completion_days(user_uuid, path),
    }
```

#### 课程完成页面增强

```tsx
// CourseCompletionPage.tsx

export function CourseCompletionPage({ stageId }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    apiClient.post(`/course/${stageId}/complete`).then(setResult);
  }, []);

  if (!result) return <Loading />;

  return (
    <div className="completion-page">
      <CompletionCelebration />

      <div className="summary">
        <h2>学习总结</h2>
        <p>{result.summary}</p>
      </div>

      <div className="rewards">
        <span>+{result.points_earned} 积分</span>
      </div>

      <div className="next-courses">
        <h3>推荐继续学习</h3>
        {result.next_courses.map((c) => (
          <CourseCard
            key={c.stage.id}
            course={c.stage}
            badge={c.relation === "next" ? "下一步" : "相关课程"}
          />
        ))}
      </div>

      <div className="path-progress">
        <h3>学习路径进度</h3>
        <ProgressBar value={result.path_progress.percent} />
        <span>{result.path_progress.completed}/{result.path_progress.total}</span>
      </div>

      <div className="actions">
        <button onClick={() => startNext(result.next_courses[0])}>
          开始下一课
        </button>
        <button onClick={() => generatePlan()}>
          制定学习计划
        </button>
        <button onClick={() => shareResult()}>
          分享学习成果
        </button>
      </div>
    </div>
  );
}
```

#### 课程关联自动生成

```python
# course_relations.py

async def auto_generate_relations(stage_id: str):
    """基于课程内容自动生成关联"""
    stage = await get_stage(stage_id)

    # 分析课程标签/主题
    topics = extract_topics(stage["language_directive"])

    # 查找相关课程
    related_stages = await db.fetch(
        """
        SELECT id, name FROM stages
        WHERE language_directive LIKE ANY($1)
        AND id != $2
        LIMIT 10
        """,
        [f"%{t}%" for t in topics], stage_id
    )

    for rs in related_stages:
        # 计算相关度
        similarity = calculate_similarity(stage, rs)

        await db.execute(
            """
            INSERT INTO course_relations (source_stage_id, target_stage_id, relation_type, weight)
            VALUES ($1, $2, 'related', $3)
            """,
            stage_id, rs["id"], similarity
        )
```

### 实现路径

| 阶段 | 改动 | 预计时间 |
|------|------|---------|
| Phase 1 | 数据表 + 推荐基础 API | 2 天 |
| Phase 2 | 课程完成流程增强 | 2 天 |
| Phase 3 | 学习路径生成（AI） | 3 天 |
| Phase 4 | UI 实现 | 4 天 |

---

## 🔵 次要断裂点修复

### 1. 问答悬赏评分标准

```markdown
## 评分标准定义

| 维度 | 权重 | 评分说明 |
|------|------|---------|
| 准确性 | 40% | 回答是否解决问题核心 |
| 完整性 | 30% | 是否覆盖所有相关点 |
| 清晰度 | 20% | 表述是否易懂 |
| 实用性 | 10% | 是否提供可执行建议 |

评分 ≥ 4.0 的回答可被采纳
```

### 2. 笔记复用机制

```python
# 笔记可作为课程补充素材
async def attach_note_to_course(note_id: str, stage_id: str, scene_id: str):
    """将优质笔记附加到课程场景"""
    note = await get_note(note_id)

    if note["rating"] >= 4.5:
        # 高质量笔记可附加
        await db.execute(
            """
            UPDATE scenes SET supplementary_notes = array_append(supplementary_notes, $1)
            WHERE id = $2
            """,
            note_id, scene_id
        )
        # 奖励作者
        await earn_points_internal(db, note["user_id"], "note_featured", 30)
```

### 3. 联赛奖励积分

```python
# 联赛周奖励
LEAGUE_WEEKLY_REWARDS = {
    "top_10": 200,  # 前 10%
    "top_30": 100,  # 前 30%
    "top_50": 50,   # 前 50%
}

async def distribute_league_rewards(season: str):
    rankings = await get_season_rankings(season)
    total = len(rankings)

    for i, r in enumerate(rankings):
        if i < total * 0.1:
            await earn_points_internal(db, r["user_id"], "league", 200)
        elif i < total * 0.3:
            await earn_points_internal(db, r["user_id"], "league", 100)
        elif i < total * 0.5:
            await earn_points_internal(db, r["user_id"], "league", 50)
```

### 4. Token 购买退款机制

```sql
-- 退款记录表
CREATE TABLE refunds (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id),
    user_id UUID NOT NULL REFERENCES users(id),
    amount INTEGER NOT NULL,
    token_amount INTEGER NOT NULL,  -- 扣回的 Token
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 总体实施计划

### Phase 优先级排序

| 优先级 | 断裂点 | 影响 | 预计时间 |
|--------|--------|------|---------|
| P0 | 积分/Token 比例失衡 | 用户无法持续学习 | 4 天 |
| P0 | 会员权益缺失 | 续费率低 | 11 天 |
| P1 | 企业功能缺失 | 收入上限低 | 13 天 |
| P1 | 课程后续路径缺失 | 用户流失 | 11 天 |
| P2 | 反馈机制缺失 | 内容质量不稳定 | 10 天 |
| P2 | 协同学习缺失 | 社交属性弱 | 12 天 |

### 总体时间线

```
Week 1-2:  P0 修复（积分比例 + 会员基础）
Week 3-4:  P1 企业功能
Week 5-6:  P1 课程路径
Week 7-8:  P2 反馈机制
Week 9-10: P2 协同学习
Week 11:   集成测试 + 文档更新
```

### 资源需求

| 角色 | 工作量 |
|------|--------|
| 后端开发 | 60% |
| 前端开发 | 30% |
| UI/UX 设计 | 10% |

---

## 附录：闭环完整性验证

修复后闭环状态：

| 闭环 | 修复前 | 修复后 |
|------|--------|--------|
| 用户获客→留存 | ✅ | ✅ |
| 用户留存→付费 | ⚠️ | ✅（会员权益） |
| 用户付费→再消费 | ⚠️ | ✅（企业路径） |
| 积分获取→兑换 | ❌ | ✅（比例调整） |
| Token购买→消费 | ✅ | ✅ |
| 内容生成→消费 | ⚠️ | ✅（反馈机制） |
| 学习匹配→协同 | ❌ | ✅（协同课堂） |
| 课程完成→续学 | ❌ | ✅（推荐路径） |