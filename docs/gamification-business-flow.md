# 成长体系完整业务流程

**版本**: v1.0  
**日期**: 2026-06-10  
**目标**: 从用户注册到长期使用的全流程，明确每个触发点、状态流转、数据流向

---

## 流程总览

```
注册 → 新手引导 → 搭子匹配 → 首次学习 → 自动打卡
  ↓
每日任务完成 → 积分发放 → 成就检查 → 搭子默契
  ↓
连续学习 → 赛季进度 → 排行榜更新 → 学习故事生成
  ↓
赛季结算 → 奖励发放 → 新赛季开启 → 长期留存
```

---

## 流程一：用户注册与成长体系初始化

### 1.1 触发时机

用户完成注册并首次登录App

### 1.2 流程步骤

```
1. 用户注册成功
   ↓
2. 后端创建用户记录 (users表)
   ↓
3. 初始化积分账户 (point_accounts表, balance=0)
   ↓
4. 创建新手任务包 (daily_task_progress表, 新手难度)
   ↓
5. 分配赛季 (user_season_stats表, 当前赛季ID)
   ↓
6. 推送新手引导弹窗
   "欢迎来到侧伴！完成学习即可自动打卡，
    每日任务奖励积分，积分可兑换Token。"
   ↓
7. 用户点击"我知道了"
   ↓
8. 前端请求 /gamification/overview
   返回: league(铜牌/0分) + tasks(新手难度) + season(当前赛季)
   ↓
9. 前端展示成长体系入口（底部Tab或个人中心）
```

### 1.3 数据流向

```
注册请求 → /auth/register
  → 创建 users 记录
  → 创建 point_accounts 记录 (balance=0)
  → 创建 buddy_configs 记录 (active=false, 等待匹配)
  → 返回用户信息
  → 前端存储 auth token
  → 前端请求 /gamification/overview
  → 返回成长体系初始数据
```

---

## 流程二：首次学习与自动打卡

### 2.1 触发时机

用户进入任意课程，完成第一个场景学习

### 2.2 流程步骤

```
1. 用户点击课程 "开始学习"
   ↓
2. 前端进入课程学习页面
   ↓
3. 用户学习场景内容（AI讲解+白板+对话）
   ↓
4. 用户完成场景（点击"下一步"或关闭课程）
   ↓
5. 前端上报学习完成事件
   POST /learning/complete-stage
   Body: { stage_id: "xxx", duration_minutes: 5 }
   ↓
6. 后端处理学习完成
   → 更新学习记录 (stages表, completed_at=now())
   → 计算学习时长 (duration_minutes=5)
   ↓
7. 触发学习行为事件系统
   record_learning_activity(db, user_uuid, "learn", value=5)
   ↓
8. 事件系统处理
   ┌─────────────────────────────────────┐
   │ 8.1 自动打卡                         │
   │   → 查 daily_checkins: 今日已打卡？   │
   │   → 未打卡: 写入打卡记录              │
   │   → 计算连续天数: new_streak=1        │
   │   → 更新 users.current_streak=1       │
   │   → 发放打卡积分: 5分                 │
   └─────────────────────────────────────┘
   ┌─────────────────────────────────────┐
   │ 8.2 更新任务进度                     │
   │   → checkin任务: progress=1/1 ✅完成  │
   │   → learn_30min任务: progress=5/30   │
   │   → 发放checkin奖励: +5分            │
   └─────────────────────────────────────┘
   ┌─────────────────────────────────────┐
   │ 8.3 搭子默契检查                     │
   │   → 查 buddy_configs: 有搭子？        │
   │   → 无搭子: 跳过                     │
   │   → 有搭子: 查搭子今日是否学习        │
   │   → 搭子未学习: 无默契加成            │
   └─────────────────────────────────────┘
   ┌─────────────────────────────────────┐
   │ 8.4 成就检查                         │
   │   → first_lesson: 条件满足？          │
   │   → 是: 写入 user_achievements        │
   │   → 发放成就积分: +10分               │
   └─────────────────────────────────────┘
   ↓
9. 后端返回结果
   {
     "success": true,
     "checkin": { "already_checked": false, "streak": 1, "reward_points": 5 },
     "tasks_completed": [
       { "task_id": "checkin", "reward_points": 5 }
     ],
     "achievements_earned": [
       { "id": "first_lesson", "name": "初学者", "points": 10 }
     ],
     "buddy_synergy": { "has_buddy": false },
     "total_points_earned": 20
   }
   ↓
10. 前端接收结果
    → 弹出庆祝动画 (🎉 首次学习完成！)
    → 显示成就解锁 (🎓 初学者)
    → 更新积分余额 (+20)
    → 推送通知: "恭喜你完成首次学习，获得20积分！"
```

### 2.3 数据流向

```
前端: 课程学习页面
  ↓ POST /learning/complete-stage
后端: learning.py
  → 更新 stages 表
  → 调用 record_learning_activity()
  → 调用 auto_checkin()
  → 更新 daily_checkins 表
  → 更新 users.current_streak
  → 更新 daily_task_progress 表
  → 更新 point_accounts.balance
  → 插入 point_transactions 记录
  → 检查并更新 user_achievements
  → 返回激励结果
  ↓
前端: 展示庆祝动画 + 积分变化
```

---

## 流程三：每日任务完成与积分循环

### 3.1 触发时机

用户在一天内进行各种学习行为

### 3.2 流程步骤

```
时间线：用户一天内的学习行为

08:00  打开App，查看今日任务
       → GET /gamification/overview
       → 显示: 6个任务，0/6完成，今日积分0
       
08:05  进入课程学习
       → 学习场景A (5分钟)
       → 触发: learn事件
       → 自动打卡: streak=3 (昨日有打卡)
       → checkin任务完成: +5分
       → learn_30min: progress=5/30
       
08:30  继续学习场景B (10分钟)
       → 触发: learn事件
       → 已打卡: skip
       → learn_30min: progress=15/30
       
09:00  完成场景C (15分钟)
       → 触发: learn事件
       → learn_30min: progress=30/30 ✅完成
       → 发放任务奖励: +10分
       → 弹出: "🎯 任务完成！学习30分钟 +10积分"
       
09:15  与AI对话 (3次)
       → 每次对话触发: chat事件
       → interact_agent: progress=1/5, 2/5, 3/5
       
10:00  提交测验
       → 触发: quiz事件
       → complete_quiz: progress=1/1 ✅完成
       → 发放任务奖励: +15分
       → 成就检查: quiz_master (正确率90%？)
       → 是: 解锁成就 +35分
       
12:00  分享笔记
       → 触发: share事件
       → share_note: progress=1/1 ✅完成
       → 发放任务奖励: +20分
       
15:00  回答问题
       → 触发: answer事件
       → answer_question: progress=1/1 ✅完成
       → 发放任务奖励: +15分
       → 搭子默契检查: 搭子今日已学习
       → 默契加成: 各+2分
       
18:00  再次与AI对话 (2次)
       → interact_agent: progress=4/5, 5/5 ✅完成
       → 发放任务奖励: +10分
       
20:00  查看成长体系
       → GET /gamification/overview
       → 显示: 6/6任务完成, 今日积分77分
       → 赛季进度更新: +77分
       → 连续天数: streak=3
       
当日总结:
- 今日积分: 77分 (5+10+15+35+20+15+2+10)
- 任务完成: 6/6
- 连续学习: 3天
- 成就解锁: quiz_master
- 搭子默契: +2分
```

### 3.3 数据流向

```
用户行为 → 前端请求 → 后端路由 → record_learning_activity()
  → auto_checkin() (仅首次)
  → update_task_progress() (每次)
  → check_buddy_synergy() (每次)
  → grant_points() (每次)
  → check_achievements() (特定行为后)
  → 更新 season stats (累计)
  → 返回结果
  → 前端展示庆祝 + 更新UI
```

---

## 流程四：搭子匹配与默契互动

### 4.1 触发时机

用户首次进入"学习搭子"页面，或主动发起匹配

### 4.2 流程步骤

```
1. 用户进入搭子页面
   → GET /buddy/me
   → 返回: 无搭子，显示匹配引导
   
2. 用户点击"寻找搭子"
   → 选择搭子类型 (鼓励型/挑战型/讲解型/激励型)
   → 选择语气风格 (温暖/专业/幽默/沉稳)
   → POST /buddy/config
   Body: { buddy_type: "encourager", tone_style: "warm" }
   
3. 后端匹配搭子
   → 查询 buddy_configs: 寻找相同类型+语气的用户
   → 匹配策略:
     a. 优先匹配学习进度相近的用户
     b. 其次匹配连续天数相近的用户
     c. 随机匹配同类型用户
   → 写入 buddy_configs 双向记录
   
4. 返回匹配结果
   {
     "buddy_user_id": "xxx",
     "buddy_name": "小明",
     "buddy_type": "encourager",
     "tone_style": "warm",
     "buddy_current_streak": 5,
     "buddy_total_points": 200,
     "message": "匹配成功！你的学习搭子是小明"
   }
   
5. 前端展示搭子信息
   → 显示搭子头像、名称、类型、连续天数
   → 显示搭子今日学习状态
   
6. 搭子默契机制启动
   → 每次 record_learning_activity() 时检查搭子状态
   → 如果搭子今日已学习:
     a. 发放默契积分: 各+2分
     b. 更新 buddy_synergy_records
     c. 计算连续一起学习天数
     d. 如果连续≥7天:
        → 解锁隐藏成就 "搭子默契"
        → 各+15分
        → 推送通知: "你们已连续一起学习7天！"
   
7. 搭子提醒机制
   → 每日20:00 cron job 检查搭子状态
   → 如果用户今日未学习但搭子已学习:
     a. 推送通知: "你的搭子小明今天已学习，加油跟上！"
   → 如果搭子今日未学习:
     a. 推送通知: "提醒小明一起学习？"
     b. 用户可点击发送提醒消息
   
8. 搭子更换
   → 用户可随时更换搭子
   → POST /buddy/change
   → 原搭子关系解除，重新匹配
```

### 4.3 数据流向

```
用户选择搭子类型 → POST /buddy/config
  → 查询匹配用户
  → 写入 buddy_configs (双向记录)
  → 返回搭子信息
  
每次学习行为 → record_learning_activity()
  → check_buddy_synergy()
  → 查询 buddy_configs (获取搭子ID)
  → 查询 daily_checkins (搭子今日状态)
  → 如果搭子已学习:
    → grant_points(user, 默契积分, "buddy_synergy")
    → grant_points(buddy, 默契积分, "buddy_synergy")
    → 更新 buddy_synergy_records
  → 返回默契结果

每日20:00 → cron job 检查搭子状态
  → 查询 daily_checkins (今日双方状态)
  → 推送提醒消息 (如适用)
```

---

## 流程五：赛季进度与结算

### 5.1 赛季周期

每月1日开始，28天结束（固定周期）

### 5.2 赛季进行中流程

```
每日学习行为 → record_learning_activity()
  → 更新 user_season_stats:
    a. total_points += earned_points
    b. days_active += 1 (如果今日首次学习)
    c. tasks_completed += 1 (如果完成任务)
    d. courses_finished += 1 (如果完成课程)
    e. updated_at = now()
    
每周更新赛季排名:
  → SELECT user_id, total_points FROM user_season_stats
  → WHERE season_id = '2026-06'
  → ORDER BY total_points DESC
  → 计算用户排名
  
赛季里程碑检查:
  → 如果 total_points >= 200:
    → 解锁青铜头像框
    → 推送通知: "赛季里程碑达成！获得青铜头像框"
  → 如果 total_points >= 500:
    → 解锁白银头像框
    → 推送通知: "赛季里程碑达成！获得白银头像框"
  → 如果 total_points >= 1000:
    → 解锁黄金头像框 + 100 Token
    → 推送通知: "赛季里程碑达成！获得黄金头像框+100Token"
```

### 5.3 赛季结算流程

```
时间: 每月1日 00:00 (cron job触发)

1. 识别上一赛季
   → last_season = f"{year}-{month-1}" (处理12月→11月)
   → 如 2026-07-01 → last_season = "2026-06"
   
2. 计算赛季排名
   → SELECT user_id, total_points FROM user_season_stats
   → WHERE season_id = last_season
   → ORDER BY total_points DESC
   
3. 发放排名奖励
   → 前10%: 钻石头像框 + 200 Token
   → 前30%: 黄金头像框 + 100 Token
   → 前60%: 白银头像框 + 50 Token
   
4. 检查赛季全勤
   → 用户赛季 days_active == 28?
   → 是: 授予"赛季全勤"成就 + 100 Token
   
5. 生成学习故事
   → 调用 generate_learning_story(user_id, last_season)
   → 存储到 user_learning_stories 表
   → 推送通知: "你的六月学习故事已生成，点击查看"
   
6. 开启新赛季
   → 创建新赛季记录 (user_season_stats, season_id="2026-07")
   → 重置赛季统计数据 (total_points=0, days_active=0...)
   → 发布新赛季任务
   
7. 推送赛季结算通知
   → "六月学习季已结束！你的排名是#8，获得白银头像框+100Token"
   → "七月学习季已开始，继续加油！"
```

### 5.4 数据流向

```
每日学习 → 更新 user_season_stats (累计积分/天数/任务)
  ↓
每周排名更新 → 计算赛季排名
  ↓
里程碑检查 → 解锁头像框/Token奖励
  ↓
每月1日 00:00 → cron job 结算
  → 计算最终排名
  → 发放奖励 (Token/头像框)
  → 检查全勤成就
  → 生成学习故事
  → 重置新赛季数据
  → 推送通知
```

---

## 流程六：成就解锁与里程碑

### 6.1 成就触发流程

```
学习行为完成 → record_learning_activity()
  → 成就检查 (异步，不阻塞)
  → POST /achievements/check
  
成就检查逻辑:
  → 查询用户统计数据 (courses_completed, streak, notes_shared...)
  → 遍历 ACHIEVEMENTS 定义
  → 对每个未获得的成就:
    a. 计算当前进度 (calculate_progress)
    b. 如果 current >= target:
      → 授予成就 (INSERT user_achievements)
      → 发放成就积分
      → 检查隐藏成就 (HIDDEN_ACHIEVEMENTS)
      → 返回新获得成就列表
      
成就解锁展示:
  → 前端接收成就列表
  → 弹出解锁动画 (烟花+文字)
  → 生成分享图片
  → 推送通知: "🎉 解锁成就「初学者」！+10积分"
```

### 6.2 里程碑触发流程

```
里程碑类型:
1. 连续学习里程碑
   → streak = 7: 解锁"周战士" + 60分
   → streak = 30: 解锁"月度大师" + 200分
   → streak = 100: 解锁"百日传奇" + 1000分

2. 积分里程碑
   → total_points = 101: 升级到银牌
   → total_points = 301: 升级到金牌
   → total_points = 601: 升级到铂金

3. 赛季里程碑
   → season_points = 200: 青铜头像框
   → season_points = 500: 白银头像框
   → season_points = 1000: 黄金头像框+100Token

4. 搭子里程碑
   → both_learning_streak = 7: "搭子默契"成就
   → both_learning_streak = 30: "搭子挚友"成就

触发流程:
  学习行为 → record_learning_activity()
    → 更新统计数据 (streak, points, season_points...)
    → 检查里程碑条件
    → 如果满足:
      a. 创建里程碑记录
      b. 发放奖励 (积分/Token/头像框)
      c. 生成庆祝效果 (confetti/fireworks)
      d. 推送通知
      e. 前端展示全屏庆祝
```

### 6.3 数据流向

```
学习行为 → 更新统计数据
  → 成就检查 (遍历ACHIEVEMENTS)
  → 里程碑检查 (streak/points/season/buddy)
  → 如果满足:
    → INSERT user_achievements / milestones
    → UPDATE point_accounts / users / user_season_stats
    → 返回奖励结果
  → 前端展示庆祝动画
```

---

## 流程七：学习故事生成与分享

### 7.1 触发时机

- 每周日 23:00 (cron job)
- 赛季结束时
- 用户主动请求

### 7.2 生成流程

```
1. cron job 触发
   → POST /gamification/learning-story/generate (internal)
   
2. 收集用户本周数据
   → 学习天数 (daily_checkins)
   → 学习时长 (stages.duration_minutes)
   → 完成课程 (stages.completed)
   → AI对话次数 (chat_logs)
   → 分享笔记 (shared_notes)
   → 获得成就 (user_achievements)
   → 连续天数 (users.current_streak)
   
3. 分析学习风格
   → 活跃时段分析:
     a. 统计每个小时的学习次数
     b. 识别高峰时段
     c. 分类: early_bird (6-9点) / afternoon (12-15点) / night_owl (21-24点)
   → 学习行为分析:
     a. 课程完成率
     b. 测验正确率
     c. AI对话频率
     d. 笔记分享频率
   → 生成学习风格标签:
     "夜猫子" / "笔记达人" / "提问高手" / "专注学习者"
   
4. 生成故事文本
   → 模板填充:
     "📖 你的第{week}周学习故事
     
     这一周，你：
     • 学习了 {days} 天，比上周 {compare} {diff} 天
     • 完成了 {courses} 门课程：《{course_names}》
     • 与AI对话了 {chat_count} 次，问了最多的是"{top_question}"
     • 分享了 {notes} 条笔记，获得了 {likes} 次点赞
     • 连续学习达到 {streak} 天，解锁了"{achievement}"成就
     
     你的学习风格：
     {style_icon} {style_name} — {style_description}
     
     下周建议：
     • {suggestion_1}
     • {suggestion_2}"
   
5. 存储故事
   → INSERT user_learning_stories (user_id, week, content, created_at)
   
6. 推送通知
   → "你的第8周学习故事已生成，点击查看"
   
7. 用户查看故事
   → GET /gamification/learning-story
   → 返回故事内容
   → 前端展示卡片式故事
   
8. 用户分享故事
   → 点击"分享"按钮
   → 生成分享图片 (HTML → Canvas → PNG)
   → 调用系统分享 (微信/微博/朋友圈)
   → 分享成功: +5积分
```

### 7.3 数据流向

```
cron job 触发 → 收集用户数据
  → 分析学习风格
  → 生成故事文本
  → 存储到 user_learning_stories
  → 推送通知
  
用户点击通知 → GET /gamification/learning-story
  → 返回故事内容
  → 前端展示卡片
  
用户点击分享 → 生成图片
  → 系统分享
  → POST /gamification/learning-story/share
  → 发放分享积分 (+5)
```

---

## 流程八：积分经济循环

### 8.1 积分赚取

```
每日赚取途径:
┌─────────────────────────┬───────┬─────────────┐
│ 行为                    │ 积分  │ 每日上限    │
├─────────────────────────┼───────┼─────────────┤
│ 完成每日任务(6项)       │ 75    │ 75          │
│ 自动打卡                │ 5-60  │ 60          │
│ 完成课程                │ 50    │ 200         │
│ 完成测验满分            │ 30    │ 90          │
│ 搭子默契加成            │ 2-15  │ 15          │
│ 成就解锁                │ 10-200│ 200         │
├─────────────────────────┼───────┼─────────────┤
│ 每日理论最大            │ ~440  │             │
│ 实际平均                │ ~150  │             │
└─────────────────────────┴───────┴─────────────┘
```

### 8.2 积分消费

```
消费项目:
┌─────────────────────────┬───────┬─────────────┬─────────────┐
│ 消费项                  │ 积分  │ 类型        │ 购买频率    │
├─────────────────────────┼───────┼─────────────┼─────────────┤
│ 兑换Token (10:1)        │ 可变  │ 核心        │ 每日        │
│ 连续天数保护卡          │ 150   │ 功能        │ 偶尔        │
│ 高级笔记模板            │ 200   │ 装饰        │ 一次性      │
│ 赛季头像框              │ 300-1K│ 装饰        │ 每赛季      │
│ 搭子改名卡              │ 100   │ 功能        │ 偶尔        │
│ 专属AI模型              │ 500   │ 功能        │ 一次性      │
│ 个性化头像框            │ 200-500│ 装饰       │ 偶尔        │
└─────────────────────────┴───────┴─────────────┴─────────────┘

消费流程:
1. 用户选择消费项
   → 前端检查积分余额
   
2. 用户确认消费
   → POST /points/spend
   Body: { item: "protection_card", quantity: 1 }
   
3. 后端处理消费
   → 检查余额是否足够
   → 扣减积分 (UPDATE point_accounts SET balance -= cost)
   → 记录消费 (INSERT point_transactions, source='spend')
   → 发放物品 (INSERT user_items / 更新 users)
   → 返回结果
   
4. 前端展示
   → 消费成功提示
   → 更新积分余额
   → 物品到账通知
```

### 8.3 经济平衡控制

```
积分通胀监控:
  → 每日统计: 总产出 vs 总消费
  → 如果产出 >> 消费:
    a. 增加消费引导推荐
    b. 推出限时消费活动
    c. 提高消费项积分门槛
  
积分价值锚定:
  → 10积分 = 1 Token
  → Token 有实际价值 (可用于LLM调用)
  → 积分不会无限贬值
  
赛季重置机制:
  → 排行榜重置 (给新用户机会)
  → 赛季任务重置 (新目标)
  → 总积分不重置 (长期积累)
  → 成就永久保留 (情感连接)
```

### 8.4 数据流向

```
学习行为 → grant_points()
  → UPDATE point_accounts SET balance += amount
  → INSERT point_transactions (source='earn', amount=+)
  → 返回新余额

消费请求 → POST /points/spend
  → 检查余额
  → UPDATE point_accounts SET balance -= cost
  → INSERT point_transactions (source='spend', amount=-)
  → INSERT user_items / 更新 users
  → 返回新余额
```

---

## 完整用户旅程示例

```
Day 1: 注册 → 新手引导 → 搭子匹配 → 首次学习 → 自动打卡
       → 获得: 初学者成就 + 20积分 + 打卡5分
       
Day 2: 收到搭子提醒 → 继续学习
       → 完成: checkin任务 + learn_30min(部分)
       → 获得: 打卡10分 + 任务5分
       
Day 3-5: 每日任务激励 → 完成3/6任务 → 积累积分
       → 连续学习3天 → 解锁连续学习者成就
       
Day 7: 连续7天 → 解锁"周战士"成就 + 60分
       → 赛季进度25% → 青铜里程碑达成
       → 生成第一周学习故事
       
Day 14: 赛季过半 → 查看排行榜 → 排名#12
       → 搭子默契7天 → 各+15分 + 搭子默契成就
       
Day 21: 赛季冲刺 → 完成赛季任务 → 获得白银头像框
       → 积分达到301 → 升级到金牌
       
Day 28: 赛季结束 → 排名#8 → 获得白银头像框+100Token
       → 收到学习故事 → 分享给搭子
       → 新赛季开始 → 清零赛季数据，总积分保留
       
Day 30-60: 长期使用 → 每日任务 + 赛季 + 搭子 + 成就
       → 形成学习习惯 → 粘性建立
       
Day 90: 连续90天 → 接近"百日传奇"
       → 积分1501 → 升级到大师
       → 赛季全勤 → 获得全勤成就
```

---

## 关键业务规则

### 9.1 幂等性规则

1. 每日打卡：今日已打卡则跳过
2. 任务进度：已完成的任务不再累加
3. 成就解锁：已获得的成就不再授予
4. 里程碑：已触发的里程碑不再重复

### 9.2 并发安全

1. 积分操作使用 `FOR UPDATE` 行锁
2. 同一学习行为不重复触发同一任务
3. 搭子默契检查使用事务隔离

### 9.3 防刷机制

1. 学习时长单次上报上限30分钟
2. 任务进度每日重置
3. 成就检查频率限制
4. 积分产出日监控

### 9.4 数据一致性

1. 所有积分变动记录在 point_transactions
2. 学习行为记录在 daily_checkins
3. 任务进度记录在 daily_task_progress
4. 成就记录在 user_achievements
5. 赛季数据记录在 user_season_stats

---

**文档结束**

> 本流程文档描述了成长体系从用户注册到长期使用的完整业务流程，明确了每个触发点、状态流转和数据流向。实现时应严格按照此流程执行，确保用户体验的一致性和数据的准确性。
