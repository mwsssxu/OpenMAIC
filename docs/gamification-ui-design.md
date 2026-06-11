# 成长体系页面UI设计文档

**版本**: v1.0  
**日期**: 2026-06-10  
**目标**: 将五层粘性架构转化为具体的UI实现，提供组件结构、交互细节、视觉规范

---

## 1. 页面信息架构

### 1.1 信息层次（从上到下，按优先级排列）

```
P0 - 即时反馈层：今日任务进度、当前状态、即时激励
P1 - 中期目标层：赛季进度、搭子状态、连续天数
P2 - 长期积累层：联赛等级、成就收集、学习档案
P3 - 社交互动层：排行榜、成就分享、搭子互动
P4 - 情感连接层：学习故事、里程碑回顾、个性化推荐
```

### 1.2 页面结构图

```
┌──────────────────────────────────────┐
│ [返回] 成长体系              [设置]   │  ← 导航栏
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 🥈 银牌 · 150积分 · 排名#42     │ │  ← 联赛卡片
│ │ ████████░░░░ 距金牌还差151分    │ │     (P2长期)
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ 📅 六月学习季 · 还剩15天            │  ← 赛季横幅
│ 赛季排名#8 · 450分                   │     (P1中期)
│ 里程碑 ████░ 450/500 白银头像框     │
├──────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │  5天 │ │ 23分 │ │ 新手 │ │ 🤗小明││  ← 今日学习
│ │连续  │ │今日  │ │等级  │ │已学  ││     (P0即时)
│ └──────┘ └──────┘ └──────┘ └──────┘│
│ ● ● ● ○ ○ ○ ○                      │  ← 7日日历条
├──────────────────────────────────────┤
│ 今日任务 (3/6) · 难度:标准    [?帮助]│  ← 任务列表
│ ┌──────────────────────────────────┐│     (P0即时)
│ │ 📅 每日打卡               ✅ +5 ││
│ ├──────────────────────────────────┤│
│ │ ⏰ 学习30分钟  12/30        +10 ││
│ │   ████████░░░░ 40%              ││
│ ├──────────────────────────────────┤│
│ │ ... 其余4个任务                  ││
│ └──────────────────────────────────┘│
├──────────────────────────────────────┤
│ 成就 (3/20)          [学习][社交]    │  ← 成就区域
│ ████████░░░░░ 总进度15%              │     (P2长期)
│                                      │
│ 即将达成                             │
│ ┌──────────────┐ ┌────────────────┐ │
│ │ 🗺️ 探索者    │ │ 🔥 连续学习者  │ │
│ │ ████░ 60%    │ │ ██████░ 71%    │ │
│ │ 再完成2个课程 │ │ 再学习2天      │ │
│ └──────────────┘ └────────────────┘ │
│                                      │
│ 已获得                               │
│ 🎓初学者  📚学者  ✨创作者  →        │
├──────────────────────────────────────┤
│ 积分: 1,250                          │  ← 积分经济
│ 今日+45  本周+180  本赛季+450       │     (P3社交)
│ ┌──────────────────────────────────┐│
│ │ 💎 赛季白银头像框      300积分  ││
│ │ 📝 高级笔记模板        200积分  ││
│ └──────────────────────────────────┘│
├──────────────────────────────────────┤
│ 🤖 已连续学习5天，距金牌差151分     │  ← 激励消息
│ 📖 本周学习故事已生成，点击查看 →    │     (P4情感)
└──────────────────────────────────────┘
```

---

## 2. 核心组件设计

### 2.1 联赛等级卡片 (LeagueCard)

**组件结构：**
```tsx
<LeagueCard
  tier="silver"
  name="银牌"
  icon="🥈"
  currentPoints={150}
  nextTier="gold"
  pointsToNext={151}
  rank={42}
  onPress={() => navigation.navigate('Leaderboard')}
/>
```

**视觉规范：**
- 背景：渐变 (根据等级变化)
  - 铜牌: #CD7F32 → #A0522D
  - 银牌: #C0C0C0 → #808080
  - 金牌: #FFD700 → #FFA500
  - 铂金: #E5E4E2 → #78C6D9
  - 钻石: #B9F2FF → #00BFFF
  - 大师: #FFD700 → #FF6347
  - 冠军: #FFD700 → #FF1493
- 高度: 80px
- 圆角: 12px
- 内边距: 16px
- 字体: 等级名 18px bold, 积分 24px bold, 排名 14px

**交互：**
- 点击跳转到排行榜页面
- 升级时触发金色光效动画

### 2.2 赛季横幅 (SeasonBanner)

**组件结构：**
```tsx
<SeasonBanner
  seasonName="六月学习季"
  daysRemaining={15}
  seasonRank={8}
  seasonPoints={450}
  milestones={[
    { threshold: 200, reward: "青铜头像框", claimed: true },
    { threshold: 500, reward: "白银头像框", claimed: false, progress: 450 }
  ]}
  onPress={() => navigation.navigate('SeasonDetail')}
/>
```

**视觉规范：**
- 背景: 主题色渐变 (#6366F1 → #8B5CF6)
- 高度: 70px
- 左侧: 赛季信息 (名称、剩余天数)
- 右侧: 赛季进度 (里程碑进度条)
- 圆角: 0 (与上一卡片连接)

**交互：**
- 点击跳转到赛季详情页
- 里程碑达成时触发粒子动画

### 2.3 今日学习状态 (TodayStatus)

**组件结构：**
```tsx
<TodayStatus
  streak={5}
  todayMinutes={23}
  streakLevel="新手"
  buddyName="小明"
  buddyLearningToday={true}
  weekCalendar={[true, true, true, false, false, false, false]}
/>
```

**视觉规范：**
- 4个卡片横向排列 (每个宽度: 22%)
- 卡片背景: 白色/半透明
- 卡片圆角: 8px
- 卡片内边距: 12px
- 数据字体: 18px bold
- 标签字体: 12px muted

**7日日历条：**
- 7个圆点横向排列
- 已学习: 主题色实心圆
- 未学习: 灰色空心圆
- 下方标签: 一 二 三 四 五 六 日

### 2.4 任务列表 (TaskList)

**组件结构：**
```tsx
<TaskList
  tasks={[
    {
      id: "checkin",
      name: "每日打卡",
      icon: "📅",
      completed: true,
      rewardPoints: 5,
    },
    {
      id: "learn_30min",
      name: "学习30分钟",
      icon: "⏰",
      completed: false,
      progress: 12,
      target: 30,
      rewardPoints: 10,
    }
  ]}
  difficulty="normal"
  onTaskPress={(task) => showTaskDetail(task)}
/>
```

**任务卡片样式：**
```tsx
// 已完成状态
<TaskCard completed>
  <Row>
    <Icon>📅</Icon>
    <Text style={strikethrough}>每日打卡</Text>
    <Badge>✅</Badge>
    <Text style={green}>+5</Text>
  </Row>
</TaskCard>

// 进度中状态
<TaskCard>
  <Row>
    <Icon>⏰</Icon>
    <Text>学习30分钟</Text>
    <ProgressText>12/30</Text>
    <Text style={accent}>+10</Text>
  </Row>
  <ProgressBar progress={40} color={theme.primary} />
</TaskCard>

// 未开始状态
<TaskCard dimmed>
  <Row>
    <Icon>📤</Icon>
    <Text>分享笔记</Text>
    <Text style={muted}>未开始</Text>
    <Text style={muted}>+20</Text>
  </Row>
</TaskCard>
```

**交互：**
- 点击任务卡片显示任务详情弹窗
- 进度更新时触发滑入动画
- 任务完成时触发庆祝效果 (confetti)

### 2.5 成就区域 (AchievementSection)

**组件结构：**
```tsx
<AchievementSection
  earnedCount={3}
  totalCount={20}
  totalProgress={15}
  categories={[
    { name: "学习", earned: 2, total: 8 },
    { name: "社交", earned: 1, total: 6 },
  ]}
  nextAchievements={[
    {
      id: "five_lessons",
      name: "探索者",
      icon: "🗺️",
      current: 3,
      target: 5,
      percentage: 60,
      hint: "再完成2个课程"
    }
  ]}
  earnedItems={[
    { id: "first_lesson", name: "初学者", icon: "🎓" }
  ]}
/>
```

**布局结构：**
```
[成就标题] (3/20)          [分类筛选Tab]
[总进度条] ████████░░░░░ 15%

[即将达成标题]
[成就卡片1] [成就卡片2] [成就卡片3]

[已获得标题]
[横向滚动列表] 🎓初学者 📚学者 ✨创作者 →
```

**成就卡片样式：**
```tsx
<NextAchievementCard>
  <Icon size={32}>🗺️</Icon>
  <Title>探索者</Title>
  <ProgressBar progress={60} />
  <Hint>再完成2个课程</Hint>
</NextAchievementCard>
```

**交互：**
- 点击成就卡片显示成就详情
- 成就解锁时触发烟花动画
- 横向滚动展示已获得成就

### 2.6 积分经济 (PointsEconomy)

**组件结构：**
```tsx
<PointsEconomy
  currentBalance={1250}
  todayEarned={45}
  weekEarned={180}
  seasonEarned={450}
  recommendedSpends={[
    { item: "赛季白银头像框", cost: 300, canAfford: true },
    { item: "高级笔记模板", cost: 200, canAfford: true }
  ]}
  onSpend={(item) => handleSpend(item)}
/>
```

**视觉规范：**
- 背景: 金色渐变 (#FFD700 → #FFA500)
- 积分数字: 28px bold
- 统计信息: 12px muted, 横向排列
- 推荐消费: 卡片列表，每个可点击

**交互：**
- 点击推荐消费项弹出确认弹窗
- 消费成功时触发金币动画

### 2.7 激励消息 (MotivationMessage)

**组件结构：**
```tsx
<MotivationMessage
  message="已连续学习5天，距离金牌还差151分！"
  learningStoryAvailable={true}
  onViewStory={() => navigation.navigate('LearningStory')}
/>
```

**视觉规范：**
- 背景: AI助手气泡样式
- 左侧: AI头像
- 右侧: 消息文本
- 下方: 学习故事入口 (如果有)

---

## 3. 交互设计细节

### 3.1 页面加载

```
1. 显示骨架屏 (Skeleton)
   - 联赛卡片占位
   - 赛季横幅占位
   - 今日学习状态占位
   - 任务列表占位
   - 成就区域占位

2. 数据加载完成
   - 按层级依次淡入动画
   - P0 → P1 → P2 → P3 → P4
   - 每个层级间隔 100ms

3. 加载失败
   - 显示错误状态
   - 提供重试按钮
   - 保留缓存数据 (如果有)
```

### 3.2 任务完成动画

```
1. 任务进度更新
   - 进度条滑入动画 (300ms ease-out)
   - 数字变化时缩放动画 (200ms)

2. 任务完成
   - 弹出庆祝卡片 (从底部滑入)
   - 显示 confetti 粒子效果
   - 播放音效 (可选)
   - 3秒后自动消失

3. 成就解锁
   - 全屏烟花动画 (500ms)
   - 显示成就详细信息
   - 提供分享按钮
   - 5秒后自动收起
```

### 3.3 搭子互动

```
1. 搭子今日已学习
   - 显示搭子状态卡片 (绿色边框)
   - 显示默契积分 (+2)
   - 点击可查看搭子详情

2. 搭子未学习
   - 显示搭子状态卡片 (灰色边框)
   - 提供"提醒搭子"按钮
   - 点击发送提醒消息

3. 默契里程碑达成
   - 触发特殊动画 (心形粒子)
   - 显示"搭子默契"成就
   - 双方各获得额外积分
```

### 3.4 赛季进度

```
1. 赛季横幅更新
   - 剩余天数实时更新
   - 排名变化时显示箭头 (↑↓)
   - 里程碑达成时进度条变色

2. 赛季结束
   - 提前7天显示倒计时
   - 最后一天显示"冲刺"提示
   - 结算时显示全屏动画
```

---

## 4. 子页面设计

### 4.1 赛季详情页 (SeasonDetail)

**页面结构：**
```
┌──────────────────────────────────────┐
│ [返回] 六月学习季                    │
├──────────────────────────────────────┤
│ 赛季信息                             │
│ 开始: 2026-06-01  结束: 2026-06-28   │
│ 剩余: 15天                           │
├──────────────────────────────────────┤
│ 我的赛季数据                         │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ 450 │ │ 12  │ │ 35  │ │ 3   │    │
│ │积分 │ │天数 │ │任务 │ │课程 │    │
│ └─────┘ └─────┘ └─────┘ └─────┘    │
├──────────────────────────────────────┤
│ 赛季排名: #8                         │
│ [查看完整排行榜 →]                   │
├──────────────────────────────────────┤
│ 赛季任务                             │
│ ┌──────────────────────────────────┐│
│ │ ✅ 连续学习7天         成就徽章  ││
│ │ 🔄 完成5门课程         2/5       ││
│ │ ❌ 分享20条笔记        0/20      ││
│ └──────────────────────────────────┘│
├──────────────────────────────────────┤
│ 赛季里程碑                           │
│ ┌──────────────────────────────────┐│
│ │ ✅ 200分: 青铜头像框              ││
│ │ 🔄 500分: 白银头像框  450/500    ││
│ │ ❌ 1000分: 黄金头像框+100Token   ││
│ └──────────────────────────────────┘│
├──────────────────────────────────────┤
│ 历史赛季                             │
│ 2026-05: 排名#12, 380分, 白银头像框 │
│ 2026-04: 排名#18, 290分, 青铜头像框 │
└──────────────────────────────────────┘
```

### 4.2 成就详情页 (AchievementDetail)

**页面结构：**
```
┌──────────────────────────────────────┐
│ [返回] 成就                           │
├──────────────────────────────────────┤
│ 分类筛选: [学习] [社交] [连续] [隐藏] │
├──────────────────────────────────────┤
│ 已获得 (3)                           │
│ ┌──────────────────────────────────┐│
│ │ 🎓 初学者                         ││
│ │ 完成第一个课程                    ││
│ │ 获得于: 2026-06-01                ││
│ │ 积分: +10                         ││
│ └──────────────────────────────────┘│
│ ┌──────────────────────────────────┐│
│ │ 📚 学者                           ││
│ │ 完成10个课程                      ││
│ │ 获得于: 2026-06-08                ││
│ │ 积分: +50                         ││
│ └──────────────────────────────────┘│
├──────────────────────────────────────┤
│ 未获得 (17)                          │
│ ┌──────────────────────────────────┐│
│ │ 🗺️ 探索者                         ││
│ │ 完成5个课程                       ││
│ │ 进度: 3/5 (60%)                   ││
│ │ ████████░░░░                      ││
│ └──────────────────────────────────┘│
│ ┌──────────────────────────────────┐│
│ │ ❓ 隐藏成就                       ││
│ │ ???                               ││
│ │ 继续探索解锁                      ││
│ └──────────────────────────────────┘│
└──────────────────────────────────────┘
```

### 4.3 学习档案页 (LearningProfile)

**页面结构：**
```
┌──────────────────────────────────────┐
│ [返回] 学习档案                      │
├──────────────────────────────────────┤
│ 终身统计                             │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│ │ 45  │ │3200 │ │  8  │ │ 15  │    │
│ │ 天数│ │分钟 │ │课程 │ │笔记 │    │
│ └─────┘ └─────┘ └─────┘ └─────┘    │
│ 加入日期: 2026-01-15                 │
│ 当前连续: 12天  最长连续: 25天       │
├──────────────────────────────────────┤
│ 学习风格                             │
│ 🌙 夜猫子 — 更喜欢在晚上9-11点学习   │
│ 📝 笔记达人 — 分享的笔记比90%用户多  │
│ 💬 提问高手 — 平均每个课程问3.2个问题 │
├──────────────────────────────────────┤
│ 里程碑时间线                         │
│ ┌──────────────────────────────────┐│
│ │ 2026-06-08                       ││
│ │ 连续学习7天                      ││
│ │ 🔥 周战士成就                    ││
│ └──────────────────────────────────┘│
│ ┌──────────────────────────────────┐│
│ │ 2026-04-22                       ││
│ │ 达到金牌等级                     ││
│ │ 🏆 联赛升级                      ││
│ └──────────────────────────────────┘│
│ ...                                 │
├──────────────────────────────────────┤
│ 学习故事                             │
│ [第8周故事] [第7周故事] [第6周故事]  │
│ 点击查看详情                         │
└──────────────────────────────────────┘
```

### 4.4 排行榜页 (Leaderboard)

**页面结构：**
```
┌──────────────────────────────────────┐
│ [返回] 排行榜                         │
├──────────────────────────────────────┤
│ Tab: [今日] [本周] [赛季] [连续学习]  │
├──────────────────────────────────────┤
│ 🥇 1. 张三    1500分    💎 钻石      │
│ 🥈 2. 李四    1200分    🥇 金牌      │
│ 🥉 3. 王五    1000分    🥈 银牌      │
│ 4. 赵六      800分     🥈 银牌      │
│ 5. 钱七      600分     🥈 银牌      │
│ ...                                 │
│ ──────────────────────────────────  │
│ 42. 我        150分     🥈 银牌      │ ← 高亮
│ ──────────────────────────────────  │
│ ...                                 │
└──────────────────────────────────────┘
```

---

## 5. 状态设计

### 5.1 加载状态

```tsx
<GamificationSkeleton>
  <LeagueCardSkeleton />
  <SeasonBannerSkeleton />
  <TodayStatusSkeleton />
  <TaskListSkeleton count={6} />
  <AchievementSectionSkeleton />
  <PointsEconomySkeleton />
</GamificationSkeleton>
```

### 5.2 空状态

```tsx
<EmptyState
  icon="📚"
  title="开始你的学习之旅"
  description="完成第一个课程即可解锁成长体系"
  actionLabel="去学习"
  onAction={() => navigation.navigate('Courses')}
/>
```

### 5.3 错误状态

```tsx
<ErrorState
  icon="⚠️"
  title="加载失败"
  description="网络连接异常，请检查网络后重试"
  actionLabel="重试"
  onAction={() => refreshData()}
/>
```

### 5.4 新手状态

```tsx
<NewbieState
  title="欢迎来到成长体系！"
  description="完成学习即可自动打卡，每日任务奖励积分"
  features={[
    "📅 每日任务",
    "🏆 联赛等级",
    "🎯 成就解锁",
    "🤝 搭子互动"
  ]}
  actionLabel="开始学习"
/>
```

---

## 6. 响应式适配

### 6.1 断点设计

```
Small (iPhone SE):     320px - 375px
Medium (iPhone 12):    375px - 414px
Large (iPhone 14 Pro): 414px - 430px
Tablet (iPad):         768px+
```

### 6.2 适配规则

```tsx
// 小屏 (<375px)
- 今日学习状态: 2x2网格布局
- 任务列表: 紧凑模式 (减小内边距)
- 成就卡片: 单列布局
- 字体大小: 整体缩小10%

// 中屏 (375-414px)
- 今日学习状态: 横向4列
- 任务列表: 标准模式
- 成就卡片: 横向2列
- 字体大小: 标准

// 大屏 (>414px)
- 今日学习状态: 横向4列 (增加间距)
- 任务列表: 宽松模式 (增加内边距)
- 成就卡片: 横向3列
- 字体大小: 整体放大10%

// 平板 (>768px)
- 双列布局 (左侧信息，右侧详情)
- 页面宽度限制在 500px 居中
```

---

## 7. 视觉规范

### 7.1 颜色系统

```tsx
const GrowthColors = {
  // 联赛等级
  league: {
    bronze: { bg: '#CD7F32', text: '#FFFFFF' },
    silver: { bg: '#C0C0C0', text: '#000000' },
    gold: { bg: '#FFD700', text: '#000000' },
    platinum: { bg: '#E5E4E2', text: '#000000' },
    diamond: { bg: '#B9F2FF', text: '#000000' },
    master: { bg: '#FFD700', text: '#000000' },
    champion: { bg: '#FFD700', text: '#000000' },
  },
  
  // 任务状态
  task: {
    completed: { bg: '#D1FAE5', text: '#059669' },
    inProgress: { bg: '#FFFFFF', text: '#1F2937' },
    notStarted: { bg: '#F3F4F6', text: '#9CA3AF' },
  },
  
  // 成就稀有度
  achievement: {
    common: { bg: '#9E9E9E', glow: false },
    rare: { bg: '#2196F3', glow: true },
    epic: { bg: '#9C27B0', glow: true },
    legendary: { bg: '#FFD700', glow: true },
  },
  
  // 赛季
  season: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    accent: '#EC4899',
  },
  
  // 积分
  points: {
    earn: '#10B981',
    spend: '#EF4444',
    balance: '#F59E0B',
  },
};
```

### 7.2 间距系统

```tsx
const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
```

### 7.3 圆角系统

```tsx
const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
};
```

### 7.4 字体大小

```tsx
const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  huge: 32,
};
```

---

## 8. 动效设计

### 8.1 页面级动效

```tsx
// 页面进入
<Animated.View
  entering={FadeInDown.duration(300)}
  exiting={FadeOutUp.duration(200)}
>
```

### 8.2 组件级动效

```tsx
// 任务进度更新
<Animated.View
  entering={SlideInRight.duration(300)}
  exiting={SlideOutLeft.duration(200)}
>

// 成就解锁
<Animated.View
  entering={BounceIn.duration(500)}
  exiting={FadeOut.duration(300)}
>

// 积分变化
<Animated.Text
  entering={ZoomIn.duration(200)}
  exiting={ZoomOut.duration(200)}
>
```

### 8.3 粒子效果

```tsx
// 任务完成 - confetti
<Confetti
  count={30}
  colors={['#FF6B6B', '#4ECDC4', '#FFE66D']}
  duration={1500}
/>

// 成就解锁 - fireworks
<Fireworks
  count={5}
  colors={['#FFD700', '#FF6B6B', '#9C27B0']}
  duration={2000}
/>

// 搭子默契 - hearts
<Hearts
  count={10}
  color="#EC4899"
  duration={1500}
/>
```

---

## 9. 组件实现示例

### 9.1 任务卡片组件

```tsx
interface TaskCardProps {
  task: TaskItem;
  onPress: (task: TaskItem) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  const progress = (task.progress / task.target) * 100;
  
  return (
    <TouchableOpacity
      style={[
        styles.taskCard,
        task.completed && styles.taskCardCompleted,
        !task.completed && progress === 0 && styles.taskCardNotStarted,
      ]}
      onPress={() => onPress(task)}
      activeOpacity={0.7}
    >
      <View style={styles.taskRow}>
        <Text style={styles.taskIcon}>{task.icon}</Text>
        <View style={styles.taskInfo}>
          <Text
            style={[
              styles.taskName,
              task.completed && styles.taskNameCompleted,
            ]}
          >
            {task.name}
          </Text>
          {!task.completed && (
            <View style={styles.taskProgressRow}>
              <Text style={styles.taskProgressText}>
                {task.progress}/{task.target}
              </Text>
              <View style={styles.taskProgressBar}>
                <View
                  style={[
                    styles.taskProgressFill,
                    { width: `${progress}%` },
                  ]}
                />
              </View>
              <Text style={styles.taskProgressPercent}>
                {Math.round(progress)}%
              </Text>
            </View>
          )}
        </View>
        {task.completed ? (
          <View style={styles.taskCompletedBadge}>
            <Text style={styles.taskCompletedText}>✅</Text>
          </View>
        ) : (
          <Text style={styles.taskReward}>+{task.rewardPoints}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  taskCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  taskCardCompleted: {
    backgroundColor: '#F0FDF4',
  },
  taskCardNotStarted: {
    opacity: 0.6,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  taskNameCompleted: {
    textDecorationLine: 'line-through',
    color: '#059669',
  },
  taskProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  taskProgressText: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  taskProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  taskProgressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  taskProgressPercent: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  taskCompletedBadge: {
    marginLeft: 12,
  },
  taskCompletedText: {
    fontSize: 18,
  },
  taskReward: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 12,
  },
});
```

---

## 10. 实现优先级

### Phase 1: 核心展示 (1-2天)
- 联赛等级卡片
- 今日学习状态
- 任务列表 (静态数据)
- 基础布局

### Phase 2: 数据接入 (2-3天)
- 对接 overview API
- 任务进度动态更新
- 成就数据展示
- 加载/错误状态

### Phase 3: 交互完善 (2-3天)
- 任务完成动画
- 成就解锁效果
- 搭子互动展示
- 赛季进度更新

### Phase 4: 子页面 (3-4天)
- 赛季详情页
- 成就详情页
- 排行榜页
- 学习档案页

### Phase 5: 动效优化 (1-2天)
- 粒子效果
- 页面过渡
- 手势交互
- 性能优化

---

**文档结束**

> 本设计文档提供了成长体系页面的完整UI实现指导，包括组件结构、交互细节、视觉规范、动效设计等。实现时应严格按照此文档执行，确保用户体验的一致性和视觉品质。
