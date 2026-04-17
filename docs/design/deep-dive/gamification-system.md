# 游戏化系统详细设计

## 系统概述

游戏化系统通过打卡、任务、联赛、徽章等机制提升用户粘性和学习动力，参考 Duolingo 的成功设计。

## 数据模型

### 打卡记录

```sql
CREATE TABLE streaks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  checkin_date DATE NOT NULL,
  streak_count INTEGER DEFAULT 1,
  reward INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_streaks_user_date ON streaks(user_id, checkin_date DESC);
```

### 每日任务

```sql
CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  task_date DATE NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  reward INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 联赛记录

```sql
CREATE TABLE leagues (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  season VARCHAR(20) NOT NULL, -- 2026-W16
  level VARCHAR(20) NOT NULL, -- bronze, silver, gold...
  points INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 徽章记录

```sql
CREATE TABLE badges (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  badge_type VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);
```

## 打卡系统设计

### 打卡触发条件

- 学习时长 >= 15 分钟
- 完成至少 1 个课程场景
- 每日最多 1 次打卡

### 打卡奖励递增

| 连续天数 | 积分奖励 |
|----------|----------|
| 第1天 | 5 |
| 第2天 | 10 |
| 第3天 | 15 |
| 第4天 | 20 |
| 第5天 | 25 |
| 第6天 | 30 |
| 第7天 | 50 |
| 第8天+ | 50（上限） |

### 断签保护

- 机制：使用积分购买断签保护
- 价格：50 积分/天
- 效果：保护 1 天不中断连续天数

```python
async def purchase_streak_protection(user_id: str):
    point_account = await get_point_account(user_id)
    if point_account.balance < 50:
        raise InsufficientPointsError()
    
    # 扣减积分
    point_account.balance -= 50
    await save_point_account(point_account)
    
    # 设置保护状态
    await set_streak_protection(user_id, days=1)
```

### 打卡逻辑

```python
async def checkin(user_id: str):
    today = get_today_date()
    
    # 1. 检查今日是否已打卡
    existing = await get_streak(user_id, today)
    if existing:
        raise AlreadyCheckedInError()
    
    # 2. 获取昨日打卡记录
    yesterday = await get_streak(user_id, today - timedelta(days=1))
    
    # 3. 计算连续天数
    if yesterday:
        streak_count = yesterday.streak_count + 1
    else:
        streak_count = 1
    
    # 4. 计算奖励
    reward = calculate_streak_reward(streak_count)
    
    # 5. 创建打卡记录
    streak = Streak(
        user_id=user_id,
        checkin_date=today,
        streak_count=streak_count,
        reward=reward,
    )
    await save_streak(streak)
    
    # 6. 发放积分
    await earn_points(user_id, "daily", reward)
    
    return streak

def calculate_streak_reward(streak_count: int) -> int:
    if streak_count >= 7:
        return 50
    return streak_count * 5
```

## 每日任务系统设计

### 任务类型

| 任务 | 奖励 | 条件 |
|------|------|------|
| 完成 1 课程 | 10积分 | 完成任意课程 |
| 参与讨论 1 次 | 5积分 | 在任意课堂发言 |
| 回答问题 1 次 | 5积分 | 在问答区回答 |
| 学习 30 分钟 | 10积分 | 累计学习时长 |
| 分享笔记 | 5积分 | 发布共享笔记 |

### 任务生成逻辑

```python
async def generate_daily_tasks(user_id: str):
    today = get_today_date()
    
    # 检查今日任务是否已生成
    existing = await get_daily_tasks(user_id, today)
    if existing:
        return existing
    
    # 创建今日任务
    tasks = [
        DailyTask(user_id=user_id, task_date=today, task_type="course", reward=10),
        DailyTask(user_id=user_id, task_date=today, task_type="discussion", reward=5),
        DailyTask(user_id=user_id, task_date=today, task_type="answer", reward=5),
        DailyTask(user_id=user_id, task_date=today, task_type="learning_time", reward=10),
    ]
    
    for task in tasks:
        await save_daily_task(task)
    
    return tasks
```

### 任务完成检测

```python
async def complete_task(user_id: str, task_type: str):
    today = get_today_date()
    
    # 获取今日任务
    task = await get_daily_task(user_id, today, task_type)
    if not task or task.is_completed:
        return None
    
    # 标记完成
    task.is_completed = True
    await save_daily_task(task)
    
    # 发放积分
    await earn_points(user_id, "daily", task.reward)
    
    return task
```

### 任务重置

- 重置时间：每日 00:00（北京时间）
- 重置逻辑：自动生成新任务

```python
# 定时任务
async def reset_daily_tasks():
    # 获取所有活跃用户
    users = await get_active_users()
    
    for user in users:
        await generate_daily_tasks(user.id)
```

## 联赛系统设计

### 联赛等级

| 等级 | 积分范围 | 名称 |
|------|----------|------|
| 铜牌 | 0-100 | Bronze |
| 银牌 | 101-500 | Silver |
| 金牌 | 501-1500 | Gold |
| 钬石 | 1501-3000 | Diamond |
| 大师 | 3001-5000 | Master |
| 冠军 | 5001+ | Champion |

### 联赛周期

- 周联赛：每周重置排名
- 季联赛：每季重置排名（可选）

### 升降级逻辑

```python
async def update_league_rankings(season: str):
    # 获取本赛季所有用户积分
    rankings = await get_season_rankings(season)
    
    # 排序
    rankings.sort(key=lambda x: x.points, reverse=True)
    
    # 计算升降级阈值
    total_users = len(rankings)
    promote_threshold = int(total_users * 0.1)  # 前10%升级
    demote_threshold = int(total_users * 0.9)  # 后10%降级
    
    for i, rank in enumerate(rankings):
        rank.rank = i + 1
        
        if i < promote_threshold:
            # 升级
            rank.level = promote_level(rank.level)
        elif i >= demote_threshold:
            # 降级
            rank.level = demote_level(rank.level)
        
        await save_league(rank)

def promote_level(current_level: str) -> str:
    levels = ["bronze", "silver", "gold", "diamond", "master", "champion"]
    idx = levels.index(current_level)
    if idx < len(levels) - 1:
        return levels[idx + 1]
    return current_level

def demote_level(current_level: str) -> str:
    levels = ["bronze", "silver", "gold", "diamond", "master", "champion"]
    idx = levels.index(current_level)
    if idx > 0:
        return levels[idx - 1]
    return current_level
```

### 联赛积分计算

```python
async def update_user_league_points(user_id: str, points: int):
    season = get_current_season()  # 2026-W16
    
    league = await get_league(user_id, season)
    if not league:
        league = League(
            user_id=user_id,
            season=season,
            level="bronze",
            points=0,
        )
    
    league.points += points
    await save_league(league)
    
    # 更新等级
    league.level = calculate_league_level(league.points)
```

## 徽章系统设计

### 徽章类型

| 类型 | 条件 | 名称 |
|------|------|------|
| learning_10 | 完成 10 课程 | 学习达人 |
| streak_30 | 连续 30 天打卡 | 坚持之星 |
| invitation_10 | 邀请 10 人 | 社交达人 |
| answer_20 | 回答被采纳 20 次 | 知识分享者 |
| first_purchase | 首次购买 Token | 支持者 |
| annual_active | 年度活跃（365天） | 年度之星 |

### 徽章解锁检测

```python
async def check_badge_unlock(user_id: str):
    # 获取用户统计数据
    stats = await get_user_stats(user_id)
    
    badges_to_unlock = []
    
    # 检查各类徽章条件
    if stats.completed_courses >= 10:
        badges_to_unlock.append("learning_10")
    
    if stats.max_streak >= 30:
        badges_to_unlock.append("streak_30")
    
    if stats.invitations >= 10:
        badges_to_unlock.append("invitation_10")
    
    if stats.accepted_answers >= 20:
        badges_to_unlock.append("answer_20")
    
    if stats.purchase_count >= 1:
        badges_to_unlock.append("first_purchase")
    
    if stats.active_days >= 365:
        badges_to_unlock.append("annual_active")
    
    # 解锁徽章
    for badge_type in badges_to_unlock:
        if not await has_badge(user_id, badge_type):
            badge = Badge(
                user_id=user_id,
                badge_type=badge_type,
            )
            await save_badge(badge)
            
            # 通知用户
            await notify_badge_unlock(user_id, badge_type)
```

## 游戏化积分来源汇总

| 来源 | 积分数量 | 说明 |
|------|----------|------|
| 每日打卡 | 5-50 | 递增奖励 |
| 每日任务 | 10-30 | 完成4任务 |
| 联赛奖励 | 0-100 | 周联赛排名奖励 |
| 徽章奖励 | 20-100 | 徽章解锁奖励 |

## 性能优化

| 优化点 | 方法 |
|--------|------|
| 打卡查询 | Redis缓存今日打卡状态 |
| 任务生成 | 定时任务批量生成 |
| 联赛排名 | Redis缓存排行榜 |
| 徽章检测 | 定时任务批量检测 |

## 错误处理

| 错误类型 | 处理方式 |
|----------|---------|
| 重复打卡 | 提示已打卡 |
| 任务未生成 | 自动生成 |
| 积分不足购买断签保护 | 提示积分不足 |
| 徽章已解锁 | 忽略重复解锁 |