# 成长体系业务逻辑设计文档

**版本**: v2.0  
**日期**: 2026-06-10  
**状态**: 设计中  
**目标**: 构建完整的成长体系，提升用户粘性和学习动力  

---

## 1. 愿景

让用户在侧伴平台的学习旅程像玩游戏一样有明确目标、即时反馈、持续动力。

**粘性公式**：
```
粘性 = 短期激励（每日任务） + 中期目标（赛季） + 长期积累（等级+成就）
     + 社交绑定（搭子+排行榜） + 情感连接（成长故事）
     + 积分经济（赚+花，形成闭环）
```

---

## 2. 现状问题

### 2.1 打卡与学习割裂

| 模块 | 机制 | 数据源 | 触发方式 |
|------|------|--------|----------|
| `checkin.py` | 手动打卡 | `daily_checkins` 表 | 用户点击按钮 |
| `achievements.py` | `calculate_streak()` | `stages` 表 | 自动计算 |

问题：用户可以不学习就打卡，学习了但忘记打卡，两套 streak 数据不一致。

### 2.2 任务进度被动

任务更新依赖前端手动调用，学习行为发生时没有自动关联。

### 2.3 激励体系不完整

当前只有"积分+等级+成就"三板斧，缺乏：
- **周期性目标**（赛季/周挑战）— 用户没有"重新来过"的动力
- **消费场景**（积分怎么花）— 只赚不花，积分失去价值感
- **社交互动**（搭子互助/比拼）— 一个人学习容易放弃
- **成长叙事**（学习故事/年鉴）— 缺少情感连接
- **个性化难度**（一刀切任务）— 新手觉得难，老手觉得无聊

---

## 3. 完整成长体系设计

### 3.1 五层粘性架构

```
第5层：情感粘性 — 学习故事、成长年鉴、里程碑仪式（终身）
         ↑
第4层：社交粘性 — 排行榜、搭子互助、成就分享（社交）
         ↑
第3层：长期粘性 — 联赛等级、成就收集、学习档案（月/季）
         ↑
第2层：中期粘性 — 赛季挑战、周任务、里程碑（周/月）
         ↑
第1层：短期粘性 — 每日任务、自动打卡、即时反馈（日）
```

### 3.2 各层详细设计

#### 第1层：短期粘性 — 每日任务 + 自动打卡

**设计原则：学习即打卡，行为即任务。**

用户产生任何学习行为时自动完成当日打卡，无需手动操作。

**每日任务清单（6项，动态难度）：**

| 任务ID | 任务名 | 默认目标 | 积分 | 难度自适应规则 |
|--------|--------|----------|------|----------------|
| `checkin` | 每日打卡 | 学习1次 | 5 | 固定 |
| `learn_30min` | 学习30分钟 | 30分钟 | 10 | 新手20min/老手45min |
| `complete_quiz` | 完成测验 | 1次 | 15 | 固定 |
| `interact_agent` | 与AI互动 | 5次对话 | 10 | 新手3次/老手8次 |
| `share_note` | 分享笔记 | 1条 | 20 | 固定 |
| `answer_question` | 回答问题 | 1次 | 15 | 固定 |

**难度自适应逻辑：**
- 新手（注册<7天或积分<100）：目标降低30%
- 活跃用户（连续学习≥7天）：标准目标
- 资深用户（连续学习≥30天）：目标提升20%，额外奖励+50%
- 系统根据用户过去7天的行为数据自动调整

**即时反馈机制：**

当任务完成时，后端返回：
```json
{
  "task_completed": true,
  "task_name": "学习30分钟",
  "reward_points": 10,
  "streak_updated": true,
  "new_streak": 5,
  "achievement_check": true,
  "message": "🎯 任务完成！获得 10 积分"
}
```

#### 第2层：中期粘性 — 赛季系统

**核心概念：每28天为一个赛季，赛季结束时结算并发放赛季奖励，新赛季开启新目标。**

为什么是28天？
- 4周周期，符合人类习惯养成周期
- 不太长（不会觉得遥遥无期），不太短（有足够时间积累）
- 给中途加入的用户"下一赛季"的期待

**赛季数据结构：**
```json
{
  "season_id": "2026-06",
  "season_name": "六月学习季",
  "start_date": "2026-06-01",
  "end_date": "2026-06-28",
  "days_remaining": 15,
  "user_stats": {
    "total_points_earned": 450,
    "days_active": 12,
    "tasks_completed": 35,
    "courses_finished": 3,
    "achievements_earned": 2,
    "longest_streak": 8
  },
  "season_rewards": [
    {
      "threshold": 200,
      "reward": "赛季专属头像框 · 青铜",
      "claimed": true
    },
    {
      "threshold": 500,
      "reward": "赛季专属头像框 · 白银",
      "claimed": false
    },
    {
      "threshold": 1000,
      "reward": "赛季专属头像框 · 黄金 + 100 Token",
      "claimed": false
    }
  ]
}
```

**赛季结算（赛季结束时自动触发）：**
- 积分排名前10%：钻石赛季头像框 + 200 Token
- 积分排名前30%：黄金赛季头像框 + 100 Token
- 积分排名前60%：白银赛季头像框 + 50 Token
- 完成本赛季所有任务：额外"赛季全勤"成就

**赛季任务（额外于每日任务）：**

| 任务 | 描述 | 奖励 |
|------|------|------|
| 赛季全勤 | 28天内每日都有学习行为 | 成就徽章 + 100 Token |
| 课程大师 | 本赛季完成5门课程 | 成就徽章 |
| 笔记达人 | 本赛季分享20条笔记 | 成就徽章 |
| 问答之星 | 本赛季回答被采纳10次 | 成就徽章 |
| 搭子默契 | 与搭子连续一起学习7天 | 成就徽章 + 双倍搭子积分 |

#### 第3层：长期粘性 — 联赛 + 成就 + 学习档案

**联赛系统（已有，增强展示）：**

| 等级 | 名称 | 所需积分 | 特权 |
|------|------|----------|------|
| 1 | 铜牌 🥉 | 0 | 基础功能 |
| 2 | 银牌 🥈 | 101 | 解锁高级笔记模板 |
| 3 | 金牌 🥇 | 301 | 解锁企业知识库权限 |
| 4 | 铂金 💎 | 601 | 优先客服 + 专属AI模型 |
| 5 | 钻石 💠 | 1001 | 永久9折订阅 |
| 6 | 大师 🏅 | 1501 | 赛季双倍积分 |
| 7 | 冠军 👑 | 2501 | 赛季三倍积分 + 专属称号 |

**成就系统（增强进度可见性）：**

成就分为4类，每类有独立的进度条：

1. **学习类**（learning）— 完成课程、测验、学习时长
2. **社交类**（social）— 分享笔记、回答问题、邀请好友
3. **连续类**（streak）— 连续学习天数
4. **隐藏类**（hidden）— 特殊条件触发（深夜学习、闪电答题等）

**成就进度展示设计：**

```
已获得 (3/20)
🎓 初学者    📚 学者    ✨ 创作者
─────────────────────────

即将达成
🗺️ 探索者    ████░ 60%    再完成2个课程
🔥 连续学习者 ██████░ 71%   再学习2天
📤 分享者     ░░░░░ 0%     首次分享笔记

全部成就（按类别筛选）
[学习] [社交] [连续] [隐藏]
```

**学习档案（新增）：**

记录用户的终身学习数据，形成情感连接：

```json
{
  "total_learning_days": 45,
  "total_learning_minutes": 3200,
  "total_courses_finished": 8,
  "total_notes_shared": 15,
  "total_answers_given": 23,
  "total_achievements": 12,
  "current_streak": 12,
  "max_streak": 25,
  "joined_date": "2026-01-15",
  "milestone_dates": [
    {"date": "2026-01-20", "event": "完成第一个课程"},
    {"date": "2026-02-14", "event": "连续学习7天"},
    {"date": "2026-03-08", "event": "分享第一条笔记"},
    {"date": "2026-04-22", "event": "达到金牌等级"}
  ]
}
```

#### 第4层：社交粘性 — 排行榜 + 搭子互动 + 成就分享

**排行榜（已有，增强）：**

- 每日排行榜（0点重置）：当日学习积分
- 每周排行榜（周一重置）：本周累计积分
- 赛季排行榜（赛季结束）：赛季总积分
- 连续学习排行榜：当前连续天数

**搭子互动（增强现有 buddy 系统）：**

搭子之间可以：
1. **互相打卡提醒** — 如果搭子今日未学习，发送提醒消息
2. **连续天数比拼** — 显示"你比搭子多连续3天"
3. **一起学习奖励** — 同一天都学习，双方各获得额外+2积分（搭子默契加成）
4. **搭子排行榜** — 搭子组合的连续天数排名

搭子默契加成触发条件：
- 双方同日都有学习行为 → 各+2积分
- 双方连续3日一起学习 → 各+5积分
- 双方连续7日一起学习 → 各+15积分 + "搭子默契"隐藏成就

**成就分享：**

当用户解锁成就时：
1. 弹出解锁动画（烟花+文字）
2. 生成分享图片（含成就图标、名称、描述）
3. 可一键分享到微信/微博/朋友圈
4. 分享成功额外+5积分（鼓励传播）

#### 第5层：情感粘性 — 学习故事 + 里程碑仪式 + 个性化

**学习故事（新增）：**

每周自动生成学习故事卡片：

```
📖 你的第8周学习故事

这一周，你：
• 学习了 5 天，比上周多 2 天
• 完成了 2 门课程：《Python入门》《AI写作》
• 与AI对话了 23 次，问了最多的是"如何..."
• 分享了 3 条笔记，获得了 12 次点赞
• 连续学习达到 7 天，解锁了"周战士"成就

你的学习风格：
🌙 夜猫子 — 你更喜欢在晚上9-11点学习
📝 笔记达人 — 你分享的笔记比90%的用户都多
💬 提问高手 — 你平均每个课程问3.2个问题

下周建议：
• 尝试"回答问题"任务，帮助其他学习者
• 你的搭子小明已经连续12天了，加油跟上！
```

**里程碑仪式（增强现有庆典效果）：**

重要节点触发全屏庆祝：

| 里程碑 | 效果 | 奖励 |
|--------|------|------|
| 首次学习 | 欢迎动画 | +10 Token |
| 连续7天 | 火焰特效 | "周战士"成就 |
| 连续30天 | 烟花特效 | "月度大师"成就 + 50 Token |
| 完成10门课程 | 彩带特效 | 成就 + 专属头像框 |
| 达到金牌等级 | 金色光效 | 永久9折订阅 |
| 赛季前10% | 钻石特效 | 200 Token + 专属称号 |
| 连续100天 | 全屏烟花 | "百日传奇"成就 + 1000 Token |

**个性化目标（增强任务系统）：**

系统根据用户画像动态调整：

- **新手保护期**（注册7天内）：
  - 任务目标降低30%
  - 完成奖励+50%
  - 额外"新手专属"成就
  
- **学习风格识别**：
  - 识别用户的活跃时段（早起型/午间型/深夜型）
  - 在活跃时段推送个性化任务
  - 在非活跃时段发送温和提醒（而非强制）

- **智能推荐任务**：
  - 根据用户历史行为，推荐最可能完成的任务
  - 对不常做的任务降低难度或替换

---

## 4. 积分经济系统

### 4.1 赚取途径

| 行为 | 积分 |
|------|------|
| 完成每日任务 | 5-20/个 |
| 自动打卡 | 5/天 |
| 完成课程 | 50/门 |
| 完成测验满分 | +30 |
| 赛季排名奖励 | 50-200 |
| 搭子默契加成 | 2-15/次 |
| 成就解锁 | 10-200/个 |
| 连续学习奖励递增 | 5-60/天 |

### 4.2 消费场景

| 消费项 | 积分 | 说明 |
|--------|------|------|
| 兑换Token | 10积分=1Token | 每日上限500积分 |
| 解锁高级笔记模板 | 200积分 | 一次性 |
| 解锁专属AI模型 | 500积分 | 一次性 |
| 赛季头像框 | 300-1000积分 | 赛季限定 |
| 学习搭子改名卡 | 100积分 | 修改搭子名称 |
| 连续天数保护卡 | 150积分 | 中断一天不重置连续 |
| 个性化头像框 | 200-500积分 | 装饰性 |

### 4.3 经济平衡

- **日产出上限**：约150积分（6任务全完成+打卡+课程）
- **月产出上限**：约4500积分（含赛季奖励）
- **消费引导**：每月推荐1-2个消费项，让用户有目标
- **积分通胀控制**：赛季重置排行榜但不重置总积分，成就永久保留

---

## 5. 核心设计：学习行为事件系统

### 5.1 统一事件入口

新增服务 `app/services/gamification_events.py`，作为所有学习行为的统一入口：

```
学习行为 → record_learning_activity() → 自动打卡
                                       → 任务进度更新
                                       → 搭子默契检查
                                       → 成就检查（异步）
                                       → 赛季进度更新
                                       → 积分发放
```

### 5.2 学习行为定义

| 事件类型 | 触发源路由 | 触发时机 | 关联任务 |
|----------|-----------|----------|----------|
| `learn` | `learning.py` | 完成课程场景学习 | `checkin`, `learn_30min` |
| `quiz` | `assessments.py` | 提交测验 | `checkin`, `complete_quiz` |
| `chat` | `chat.py` | 发送消息给 Agent | `checkin`, `interact_agent` |
| `share` | `sharing.py` | 发布共享笔记 | `checkin`, `share_note` |
| `answer` | `answers.py` | 提交问题回答 | `checkin`, `answer_question` |
| `course_complete` | `learning.py` | 完成整个课程 | 特殊成就检查 |

### 5.3 事件处理流程

```python
async def record_learning_activity(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
    activity_type: str,       # learn / quiz / chat / share / answer / course_complete
    value: int = 1,           # 进度值
    user_id: str = "",        # 用于缓存刷新
    context: dict = None,     # 额外上下文（如course_id, stage_id）
) -> dict:
    """统一记录学习行为，返回所有激励结果"""
    results = {}
    
    # 1. 自动打卡（幂等）
    results["checkin"] = await auto_checkin(db, user_uuid)
    
    # 2. 更新任务进度
    results["tasks"] = await update_tasks_for_activity(
        db, user_uuid, activity_type, value
    )
    
    # 3. 搭子默契检查
    results["buddy"] = await check_buddy_synergy(db, user_uuid)
    
    # 4. 积分发放（学习任务额外积分）
    if activity_type == "course_complete":
        results["points"] = await grant_course_points(db, user_uuid, context)
    
    # 5. 返回结果供前端展示
    return results
```

### 5.4 自动打卡逻辑

```python
async def auto_checkin(db: asyncpg.Connection, user_uuid: uuid.UUID) -> dict:
    """自动打卡（学习行为触发，幂等）"""
    today = utcnow().date()
    
    existing = await db.fetchrow(
        "SELECT id FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
        user_uuid, today
    )
    if existing:
        return {"already_checked": True}
    
    # 计算连续天数
    yesterday = today - timedelta(days=1)
    yesterday_checkin = await db.fetchrow(
        "SELECT streak_count FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
        user_uuid, yesterday
    )
    new_streak = (yesterday_checkin["streak_count"] + 1) if yesterday_checkin else 1
    
    # 写入打卡记录
    await db.execute(
        """INSERT INTO daily_checkins (id, user_id, checkin_date, streak_count, created_at)
           VALUES ($1, $2, $3, $4, $5)""",
        uuid.uuid4(), user_uuid, today, new_streak, utcnow()
    )
    
    # 更新用户表
    max_streak = await db.fetchval(
        "SELECT MAX(streak_count) FROM daily_checkins WHERE user_id = $1", user_uuid
    )
    await db.execute(
        "UPDATE users SET current_streak = $1, max_streak = $2 WHERE id = $3",
        new_streak, max_streak, user_uuid
    )
    
    # 发放打卡积分奖励
    streak_reward = calculate_streak_reward(new_streak)
    await grant_points(db, user_uuid, streak_reward, "streak_checkin", new_streak)
    
    return {
        "already_checked": False,
        "streak": new_streak,
        "reward_points": streak_reward,
    }
```

---

## 6. 赛季系统详细设计

### 6.1 赛季周期

- 每月1日开始，28天结束（固定周期，不受月份天数影响）
- 赛季命名：`{年}-{月}` 如 `2026-06`
- 赛季名称：`{月份}学习季` 如 `六月学习季`

### 6.2 赛季数据表

```sql
CREATE TABLE user_season_stats (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    season_id VARCHAR(20) NOT NULL,  -- "2026-06"
    
    -- 统计数据
    total_points INTEGER DEFAULT 0,
    days_active INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    courses_finished INTEGER DEFAULT 0,
    notes_shared INTEGER DEFAULT 0,
    answers_given INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    
    -- 排名
    season_rank INTEGER,
    
    -- 奖励
    rewards_claimed JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, season_id)
);
```

### 6.3 赛季结算触发

- **自动结算**：每月1日0点，cron job 自动结算上一赛季
- **结算逻辑**：
  1. 计算赛季排名
  2. 发放排名奖励（Token + 头像框）
  3. 检查赛季全勤条件
  4. 更新用户总成就
  5. 生成学习故事

### 6.4 赛季任务

```python
SEASON_TASKS = {
    "2026-06": {
        "tasks": [
            {
                "id": "season_streak_7",
                "name": "连续学习7天",
                "reward": "成就徽章 + 30积分",
                "type": "streak",
                "target": 7,
            },
            {
                "id": "season_courses_5",
                "name": "完成5门课程",
                "reward": "成就徽章",
                "type": "courses",
                "target": 5,
            },
            # ... 更多赛季任务
        ],
        "milestones": [
            {"points": 200, "reward": "赛季专属头像框 · 青铜"},
            {"points": 500, "reward": "赛季专属头像框 · 白银"},
            {"points": 1000, "reward": "赛季专属头像框 · 黄金 + 100 Token"},
        ]
    }
}
```

---

## 7. 搭子默契系统

### 7.1 默契度计算

```python
async def check_buddy_synergy(
    db: asyncpg.Connection,
    user_uuid: uuid.UUID,
) -> dict:
    """检查搭子默契度"""
    # 1. 获取用户的搭子
    buddy_config = await db.fetchrow(
        """SELECT buddy_user_id FROM buddy_configs 
           WHERE user_id = $1 AND active = TRUE""",
        user_uuid
    )
    if not buddy_config:
        return {"has_buddy": False}
    
    buddy_uuid = buddy_config["buddy_user_id"]
    today = utcnow().date()
    
    # 2. 检查搭子今日是否已学习
    buddy_today = await db.fetchrow(
        "SELECT id FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2",
        buddy_uuid, today
    )
    
    if buddy_today:
        # 搭子今日也学习了，触发默契加成
        synergy_points = 2
        
        # 3. 检查连续一起学习天数
        both_streak = await calculate_buddy_synergy_streak(
            db, user_uuid, buddy_uuid
        )
        
        if both_streak >= 7:
            synergy_points = 15
            # 检查是否解锁"搭子默契"成就
            await check_hidden_achievement(db, user_uuid, "buddy_synergy_7", both_streak)
        
        # 4. 发放默契积分
        await grant_points(db, user_uuid, synergy_points, "buddy_synergy", both_streak)
        await grant_points(db, buddy_uuid, synergy_points, "buddy_synergy", both_streak)
        
        return {
            "has_buddy": True,
            "buddy_also_learning": True,
            "synergy_points": synergy_points,
            "both_streak": both_streak,
        }
    
    return {"has_buddy": True, "buddy_also_learning": False}
```

### 7.2 搭子提醒机制

- 如果搭子今日未学习，在搭子打开App时显示：
  - "你的学习搭子今天还没学习，提醒TA一下？"
  - 点击发送提醒消息（推送通知）
- 提醒消息文案：
  - "嘿！我们今天还没一起学习，加油！💪"
  - "你的搭子在等你一起学习！📚"

---

## 8. 后端路由改造

### 8.1 新增文件

**`app/services/gamification_events.py`**
- `record_learning_activity()` — 统一入口
- `auto_checkin()` — 自动打卡
- `update_tasks_for_activity()` — 任务批量更新
- `check_buddy_synergy()` — 搭子默契检查

**`app/services/season_manager.py`**
- `get_current_season()` — 获取当前赛季
- `get_user_season_stats()` — 获取用户赛季数据
- `settle_season()` — 赛季结算
- `generate_learning_story()` — 生成学习故事

### 8.2 改造已有路由

**`learning.py`** — 完成场景学习：
```python
from app.services.gamification_events import record_learning_activity

await record_learning_activity(
    db, user_uuid, "learn",
    value=duration_minutes,
    user_id=current_user_id,
    context={"stage_id": stage_id}
)
```

**`chat.py`** — Agent 对话：
```python
await record_learning_activity(
    db, user_uuid, "chat",
    value=1, user_id=current_user_id
)
```

**`assessments.py`** — 提交测验：
```python
await record_learning_activity(
    db, user_uuid, "quiz",
    value=1, user_id=current_user_id,
    context={"score": quiz_score}
)
```

**`sharing.py`** — 发布笔记：
```python
await record_learning_activity(
    db, user_uuid, "share",
    value=1, user_id=current_user_id,
    context={"note_id": note_id}
)
```

**`answers.py`** — 提交回答：
```python
await record_learning_activity(
    db, user_uuid, "answer",
    value=1, user_id=current_user_id,
    context={"answer_id": answer_id}
)
```

### 8.3 新增路由

**赛季相关：**
```
GET    /gamification/season/current          # 当前赛季信息
GET    /gamification/season/{season_id}/stats # 赛季统计
POST   /gamification/season/{season_id}/claim # 领取赛季奖励
GET    /gamification/season/{season_id}/leaderboard # 赛季排行榜
```

**学习故事：**
```
GET    /gamification/learning-story          # 本周学习故事
POST   /gamification/learning-story/share    # 分享学习故事
```

**学习档案：**
```
GET    /gamification/learning-profile        # 学习档案
GET    /gamification/learning-profile/milestones # 里程碑时间线
```

**搭子默契：**
```
GET    /gamification/buddy-synergy           # 搭子默契状态
```

---

## 9. Overview 接口完整设计

`GET /gamification/overview` 返回完整成长体系数据：

```json
{
  "league": {
    "tier": "silver",
    "name": "银牌",
    "icon": "🥈",
    "current_points": 150,
    "next_tier": "gold",
    "points_to_next": 151,
    "rank": 42
  },
  "streak": {
    "current": 5,
    "today_checked": true,
    "today_learning_minutes": 23,
    "reward_preview": 30,
    "streak_level": "新手",
    "recent_dates": ["2026-06-09", "2026-06-08", "2026-06-07"],
    "protection_card": 2  # 连续天数保护卡数量
  },
  "season": {
    "id": "2026-06",
    "name": "六月学习季",
    "days_remaining": 15,
    "total_points": 450,
    "days_active": 12,
    "tasks_completed": 35,
    "rank_in_season": 8,
    "milestones": [
      {"threshold": 200, "reward": "青铜头像框", "claimed": true},
      {"threshold": 500, "reward": "白银头像框", "claimed": false, "progress": 450}
    ]
  },
  "tasks": {
    "total": 6,
    "completed": 3,
    "total_reward_available": 75,
    "reward_earned": 35,
    "difficulty_profile": "normal",  # easy/normal/hard
    "items": [
      {
        "id": "checkin",
        "name": "每日打卡",
        "description": "完成每日学习打卡",
        "reward_points": 5,
        "icon": "📅",
        "completed": true,
        "progress": 1,
        "target": 1,
        "percentage": 100
      },
      {
        "id": "learn_30min",
        "name": "学习30分钟",
        "description": "累计学习时长达到30分钟",
        "reward_points": 10,
        "icon": "⏰",
        "completed": false,
        "progress": 12,
        "target": 30,
        "percentage": 40
      }
    ]
  },
  "achievements": {
    "earned": 3,
    "total": 20,
    "categories": {
      "learning": {"earned": 2, "total": 8},
      "social": {"earned": 1, "total": 6},
      "streak": {"earned": 0, "total": 4},
      "hidden": {"earned": 0, "total": 2}
    },
    "items": [
      {
        "id": "first_lesson",
        "name": "初学者",
        "icon": "🎓",
        "description": "完成第一个课程",
        "category": "learning",
        "rarity": "common",
        "earned_at": "2026-06-01T10:00:00"
      }
    ],
    "next_achievements": [
      {
        "id": "five_lessons",
        "name": "探索者",
        "icon": "🗺️",
        "description": "完成 5 个课程",
        "category": "learning",
        "current": 3,
        "target": 5,
        "percentage": 60
      }
    ]
  },
  "buddy": {
    "has_buddy": true,
    "buddy_name": "小明",
    "buddy_also_learning_today": true,
    "synergy_points_today": 2,
    "both_learning_streak": 5,
    "next_synergy_milestone": 7
  },
  "points": {
    "current_balance": 1250,
    "today_earned": 45,
    "this_week_earned": 180,
    "this_season_earned": 450,
    "recommended_spends": [
      {
        "item": "赛季白银头像框",
        "cost": 300,
        "description": "展示你的赛季成就",
        "can_afford": true
      }
    ]
  },
  "learning_profile": {
    "total_days": 45,
    "total_minutes": 3200,
    "total_courses": 8,
    "join_date": "2026-01-15",
    "learning_style": "night_owl",  # early_bird / afternoon / night_owl
    "recent_milestone": {
      "date": "2026-06-08",
      "event": "连续学习7天"
    }
  },
  "motivation_message": "已连续学习5天，距离金牌等级还差151积分！"
}
```

---

## 10. 前端页面改造

### 10.1 完整页面结构

```
┌──────────────────────────────────────┐
│  ←  成长体系                  ⚙️     │  pageHeader
├──────────────────────────────────────┤
│  🥈 银牌 · 150 积分 · 排名 42       │  联赛卡片
│  ████████░░░ 距金牌 151 分          │  升级进度条
├──────────────────────────────────────┤
│  📅 六月学习季 · 还剩15天            │  赛季横幅
│  赛季排名 #8 · 赛季积分 450          │
│  里程碑: ████░ 450/500 白银头像框   │  赛季进度
├──────────────────────────────────────┤
│  今日学习                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌───────┐  │
│  │ 5天 │ │23分 │ │新手 │ │🤗 小明 │  │  学习状态+搭子
│  │连续 │ │今日 │ │等级 │ │已学习 │  │
│  └─────┘ └─────┘ └─────┘ └───────┘  │
│  ● ● ● ○ ○ ○ ○                      │  近7天日历
│  一 二 三 四 五 六 日                 │
├──────────────────────────────────────┤
│  今日任务 (3/6) · 难度: 标准         │
│  ┌─────────────────────────────────┐│
│  │ 📅 每日打卡               ✅ +5││  已完成
│  ├─────────────────────────────────┤│
│  │ ⏰ 学习30分钟  12/30      +10  ││  进度条40%
│  │   ████████░░░░                  ││
│  ├─────────────────────────────────┤│
│  │ 📝 完成测验              ✅ +15││  已完成
│  ├─────────────────────────────────┤│
│  │ 🤖 与AI互动   2/5         +10  ││  进度条40%
│  │   ██████░░░░░░                  ││
│  ├─────────────────────────────────┤│
│  │ 📤 分享笔记         未开始 +20 ││  未开始
│  ├─────────────────────────────────┤│
│  │ 💡 回答问题         未开始 +15 ││  未开始
│  └─────────────────────────────────┘│
├──────────────────────────────────────┤
│  成就 (3/20)                          │
│  [学习 2/8] [社交 1/6] [连续 0/4]    │  分类筛选
│  ████████░░░░░ 总进度 15%            │
│                                      │
│  即将达成                             │
│  ┌──────────────┐ ┌────────────────┐ │
│  │ 🗺️ 探索者    │ │ 🔥 连续学习者  │ │  进度卡片
│  │ ████░ 60%    │ │ ██████░ 71%    │ │
│  │ 再完成2个课程 │ │ 再学习2天      │ │
│  └──────────────┘ └────────────────┘ │
│                                      │
│  已获得                               │
│  🎓初学者  📚学者  ✨创作者  →        │  横向滚动
├──────────────────────────────────────┤
│  积分: 1250                          │
│  今日+45  本周+180  本赛季+450       │  积分统计
│  ┌─────────────────────────────────┐│
│  │ 💎 赛季白银头像框     300积分  ││  推荐消费
│  │ 📝 高级笔记模板       200积分  ││
│  └─────────────────────────────────┘│
├──────────────────────────────────────┤
│  🤖 已连续学习5天，距离金牌还差151分  │  激励消息
│  本周学习故事已生成，点击查看 →       │  学习故事入口
└──────────────────────────────────────┘
```

### 10.2 子页面

**1. 赛季详情页**
- 赛季信息（开始/结束时间、剩余天数）
- 赛季排名 + 赛季积分
- 赛季任务列表
- 赛季里程碑（积分门槛+奖励）
- 历史赛季记录

**2. 成就详情页**
- 按分类筛选（学习/社交/连续/隐藏）
- 已获成就列表（带获得日期）
- 未获成就列表（带进度条）
- 隐藏成就（问号图标，描述模糊）

**3. 学习档案页**
- 终身学习统计
- 里程碑时间线（纵向时间轴）
- 学习风格分析
- 每周学习故事入口

**4. 排行榜页**
- Tab切换：每日/每周/赛季/连续学习
- 当前用户位置高亮
- 前三名特殊标识

---

## 11. 实现计划

### Phase 1：后端核心（预估 4h）

1. **新建服务文件**
   - `app/services/gamification_events.py` — 学习行为事件系统
   - `app/services/season_manager.py` — 赛季管理
   - `app/services/learning_profile.py` — 学习档案

2. **数据库迁移**
   - `user_season_stats` 表
   - `user_learning_milestones` 表
   - `buddy_synergy_records` 表
   - `season_tasks` 表

3. **改造现有路由**
   - `learning.py` / `chat.py` / `assessments.py` / `sharing.py` / `answers.py` — 插入 `record_learning_activity`
   - `checkin.py` — 改为调 `auto_checkin()`
   - `gamification.py` — 扩展 overview 接口

4. **新增路由**
   - `GET /gamification/season/current`
   - `GET /gamification/learning-story`
   - `GET /gamification/learning-profile`
   - `GET /gamification/buddy-synergy`

### Phase 2：前端重写（预估 4h）

5. **重写 `gamification.tsx`**
   - 联赛卡片（含升级进度条）
   - 赛季横幅（剩余天数+排名+进度）
   - 学习状态+搭子状态
   - 任务列表（含进度条+难度标识）
   - 成就详情（分类+已获+即将达成）
   - 积分统计+推荐消费
   - 激励消息+学习故事入口

6. **新增子页面**
   - `season.tsx` — 赛季详情
   - `achievements.tsx` — 成就详情
   - `learning-profile.tsx` — 学习档案
   - `leaderboard.tsx` — 排行榜

7. **课程学习页面**
   - 添加学习时长定时上报
   - 任务完成时弹出即时反馈

### Phase 3：粘性功能（预估 3h）

8. **赛季系统**
   - 赛季结算 cron job
   - 赛季排行榜
   - 赛季奖励领取

9. **搭子默契**
   - 搭子一起学习检测
   - 默契积分发放
   - 搭子提醒消息

10. **学习故事**
    - 每周自动生成学习故事
    - 分享功能
    - 推送通知

### Phase 4：验证（预估 1h）

11. Python 编译 + TS 编译
12. 容器重载后端，测试 API
13. 前端页面展示验证
14. 端到端流程测试

---

## 12. API 变更汇总

| 接口 | 变更类型 | 说明 |
|------|----------|------|
| `GET /gamification/overview` | 大幅扩展 | 增加 season/tasks.items/achievements.items/buddy/points/learning_profile |
| `GET /gamification/season/current` | 新增 | 当前赛季信息 |
| `GET /gamification/learning-story` | 新增 | 本周学习故事 |
| `GET /gamification/learning-profile` | 新增 | 学习档案 |
| `GET /gamification/buddy-synergy` | 新增 | 搭子默契状态 |
| `POST /gamification/report-learning-time` | 新增 | 学习时长上报 |
| `POST /checkin/checkin` | 语义变更 | 改为内部调 auto_checkin |
| `POST /achievements/check` | 保留 | 成就检查 |

---

## 13. 粘性效果预期

### 13.1 用户旅程

```
Day 1: 首次使用 → 完成第一个课程 → 解锁"初学者"成就 → +10 Token
Day 2: 收到搭子提醒 → 继续学习 → 连续2天
Day 3-5: 每日任务激励 → 完成3/6任务 → 积累积分
Day 7: 连续7天 → 解锁"周战士"成就 → 赛季进度25%
Day 14: 赛季过半 → 查看排行榜 → 发现自己在前30% → 更有动力
Day 21: 赛季冲刺 → 完成赛季任务 → 获得白银头像框
Day 28: 赛季结束 → 收到学习故事 → 分享给搭子 → 新赛季开始
```

### 13.2 关键指标

| 指标 | 预期提升 | 实现方式 |
|------|----------|----------|
| 日活跃用户(DAU) | +20% | 每日任务+自动打卡 |
| 7日留存率 | +30% | 赛季系统+搭子互动 |
| 30日留存率 | +40% | 长期成就+学习档案 |
| 平均学习时长 | +25% | 任务激励+积分消费 |
| 分享率 | +50% | 成就分享+学习故事 |
| 付费转化 | +15% | 积分兑换+赛季限定 |

---

## 14. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 任务太难用户放弃 | 流失 | 难度自适应+新手保护期 |
| 积分通胀贬值 | 失去激励 | 赛季重置+消费引导 |
| 搭子不活跃拖后腿 | 负面情绪 | 搭子更换机制+单人模式 |
| 赛季太长用户疲劳 | 参与度下降 | 周里程碑+即时反馈 |
| 后端性能压力 | 响应变慢 | 异步处理+缓存 |

---

**文档结束**

> 本设计文档的目标是构建一个完整的成长体系，让用户在学习过程中获得持续的正向反馈，从"偶尔使用"变为"每天必用"，最终形成学习习惯。
