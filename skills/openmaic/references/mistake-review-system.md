# 错题复习系统（Mistake Review）

轻量级"每日错题复习"闭环：测评做错的题自动入库，按固定遗忘梯度重新弹给用户，连续答对 2 次即"掌握"退出复习池。配合首页 Banner 入口 + RewardToast 即时反馈，构建碎片化学习的日活抓手。

## 何时用本文档

- 调整复习算法（间隔、掌握阈值、上限）
- 接入新的"错题来源"（不只 assessment）
- Banner 不显示 / API 404 / 错题不入库

## 数据架构

**`mistake_records` 表**（`migrations/add_mistake_records.sql`）：

```sql
(user_id, question_id) UNIQUE   -- 同一题再错只更新计数
question_snapshot       JSONB    -- 题目快照（题干/选项/正解/解析），离线可读
attempt_count           INT      -- 复习+提交累计次数
wrong_count             INT      -- 答错累计
correct_streak          INT      -- 当前连对次数
mastered                BOOL     -- 掌握后退出复习池
next_review_at          TIMESTAMPTZ  -- <=NOW() 即"今日待复习"
```

**索引**：`(user_id, mastered, next_review_at)` 覆盖 today 拉取查询。

## 关键设计决策

### 1. 不复用 `review_schedules` 表

历史 `review_schedules`/`records` 表存在但 0 行——按完整 SRS 设计太重。新建 `mistake_records` 独立表，专攻"错题→复习→掌握"单一场景，避免污染。

### 2. 刚错的题立即进入复习池

写入时 `next_review_at = NOW()`（不是 +1 day）。**理由**：用户提交测评看到错题反馈后，立刻有动力点首页 Banner"趁热打铁"——延后到明天等于丢失最佳复习窗口。

### 3. 固定遗忘梯度（非自适应 SRS）

```python
INTERVALS = [1, 3, 7, 14]  # 答对 N 次后间隔 N 天
```

简单、可解释、无算法黑箱。`correct_streak >= 2` → `mastered=true`，从复习池移除。答错任意一次重置 streak 并立即进入下一轮（`next_review_at=NOW()`）。

### 4. 业务零侵入：best-effort 错题写入

`assessments.py:submit_assessment` 末尾 try/except 调 `record_mistakes_from_assessment`：

```python
try:
    await record_mistakes_from_assessment(db, ...)
except Exception as exc:
    logger.warning("[Assessment] failed to record mistakes: %s", exc)
```

**理由**：错题统计失败不能阻塞测评提交（这是用户最关心的主流程）。

### 5. 答题积分走 `grant_points` 统一账本

```python
new_balance = await grant_points(db, user_id, 2,
    source="mistake_review", context={...})
```

返回值合并到响应 `earned_points + new_balance`，前端 `api-client.tapReward()` 自动拦截弹 RewardToast——业务页面 0 改动。

## API 速查

| 路由 | 用途 |
|------|------|
| `GET /mistakes/today?limit=10` | 拉今日待复习（`next_review_at<=NOW()` 且未掌握），按错的次数+到期时间排序 |
| `GET /mistakes/stats` | `{total, mastered_count, due_count}`，首页 Banner 决定显隐 |
| `POST /mistakes/{id}/answer` | 提交答案，返回 `is_correct/correct_answer/explanation/mastered/earned_points/new_balance` |
| `GET /mistakes/list?only_unmastered=true` | 错题本（分页），未来"我的错题本"页面用 |

## 移动端 UX 要点

### 首页 Banner（`(tabs)/index.tsx`）

- 仅 `mistakeStats.due_count > 0` 时渲染（不打扰）
- 橙色品牌色 `#fff5ed/#fed7aa` 强调感，与通知卡视觉区分
- 标题用具体数字 `"今日复习 · N 道错题"`，不是模糊"待复习"
- 未掌握/已掌握态有差异化副文案

### Review 页面（`app/review.tsx`）

- **一屏一题**：横向 `FlatList pagingEnabled`，按钮控制翻页（`scrollEnabled={false}`），不靠手势避免误触
- **顶部进度条** + `N/M` 计数，让用户感知节奏
- **即时反馈**：答完显示 ✓/✗ + 解析 + 掌握徽章
- **完成卡**：本轮题数/答对数/正确率/新掌握数 + "再来一轮"
- **空态友好**：区分"从未做错"vs"今天没到期"

### Theme 嵌套陷阱

`packages/mobile/lib/constants/theme.ts` 的 `Colors` 是嵌套对象（`Colors.primary.main`、`Colors.neutral.background`），不是平级。新页面建议在文件顶部做扁平化别名：

```ts
import { Colors as RawColors } from '@/lib/constants/theme';
const Colors = {
  primary: RawColors.primary.main,
  text: RawColors.neutral.textPrimary,
  // ...
};
```

否则会触发一堆 TS 类型错误（`{main, light, dark}` 不能赋给 `ColorValue`）。

## 常见问题

### "今日复习"为空但 stats.total > 0

检查 `next_review_at`：可能在写入时被设成了未来时间（旧代码 `+1 day`）。应为 `NOW()`。

### Banner 始终不显示

1. 后端是否注册路由（`main.py` 末尾 `include_router(mistakes.router)`）
2. `mistakeStats.due_count` 是否有值——首页 useEffect 失败时静默 warn，不会显式报错
3. `due_count` 不等于 `total - mastered_count`：到期时间还没到的也不算 due

### 答题不发积分

只有 `is_correct=true` 才发，且 `grant_points(2, source="mistake_review")`。如要调整奖励规则，改 `mistakes.py:answer_mistake` 里的判断。

### 错题没自动入库

1. `learning_assessments.questions` 是否标准格式（含 `id/correct_answer`）
2. 看 server log `[Assessment] failed to record mistakes: ...`——best-effort 失败会 warn 不会抛
3. UPSERT 用 `(user_id, question_id)` 去重——同一题多次错只会累加 `wrong_count`

## 相关文件

- 表结构：`packages/server-python/migrations/add_mistake_records.sql`
- 服务层：`packages/server-python/app/services/mistake_service.py`
- 路由：`packages/server-python/app/routes/mistakes.py`
- 入库点：`packages/server-python/app/routes/assessments.py:submit_assessment`
- RN 页面：`packages/mobile/app/review.tsx`
- 首页 Banner：`packages/mobile/app/(tabs)/index.tsx`（搜 `mistakeStats`）
- API client：`packages/mobile/lib/api-client/index.ts`（搜 `getTodayMistakes`）

## 相关文档

- `reward-toast-feedback.md`：积分发放 → Toast 弹出的拦截范式
- `token-ledger-schema.md`：`grant_points` 与 `point_accounts` 的关系
