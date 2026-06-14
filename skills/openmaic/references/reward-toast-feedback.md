# Reward Toast / Points 即时反馈

## 问题

后端的 6 个奖励路径（assessment/programming/note_reminder/scene/
share_card/persona_feedback）历史上全部静默失败，2026-06-13 修复了
ledger schema 问题后数据正确了，但**用户仍然感知不到积分到账**——只有
classroom assessment 页面有一个朴素的 "获得 X 积分" 文字行，其他 5 个
路径在 RN 端**完全没有反馈**。

## 解决方案

### 1. 后端统一 response 形状

`grant_points()` 改为返回 `int`（新余额），所有 6 个奖励接口的 response
都包含：

```json
{
  "earned_points": 25,
  "new_balance": 710,
  ...
}
```

share_cards / persona_feedback 还保留 legacy `reward` 字段以兼容旧客户端。

### 2. RewardController 全局组件（mobile/lib/utils/reward-toast.tsx）

挂在 `app/_layout.tsx` root 层（与 GlobalDialog 同级）。其他业务代码不
需要感知它的存在。

### 3. 一行 imperative API

```ts
import { showReward } from '@/lib/utils/reward-toast';

showReward({
  points: 25,
  newBalance: 710,
  source: 'assessment',  // 决定文案 "完成测评"
});
```

- 节流 800ms（避免一次请求触发多次）
- 自动消失 2.6s
- 触觉反馈 `Haptics.NotificationFeedbackType.Success`
- 弹性入场 + 金币旋转 + 6 个 ✨ 粒子飘出
- 顶部悬浮，pointerEvents=none，不阻塞主流程

### 4. api-client `tapReward` 拦截器

业务页面**完全不需要改动**。在 api-client 里：

```ts
function tapReward<T>(data: T, source: RewardSource): T {
  if (data && typeof data === 'object') {
    const points = Number((data as any).earned_points ?? (data as any).reward ?? 0);
    if (points > 0) showReward({ points, newBalance: ..., source });
  }
  return data;
}

async submitAssessment(...) {
  const { data } = await this.client.post('/assessments/submit', ...);
  return tapReward(data, 'assessment');  // ← 一行
}
```

接入了 5 个奖励接口：
- `submitAssessment` → 'assessment'
- `createShareCard` → 'share_card'
- `submitPersonaFeedback` → 'persona_feedback'
- `submitProgrammingExercise` → 'programming'
- `completeNoteReminder` → 'note_reminder'

未来添加新奖励接口只需在 return 处包一层 `tapReward(data, '...')`。

## 移动端适配要点

1. **触觉**：`expo-haptics` 在 web 平台 no-op，所以代码里已加 `Platform.OS !== 'web'` 守卫。
2. **动画**：用 RN `Animated`（不用 reanimated），`USE_NATIVE_DRIVER`
   动态适配 Expo Go 缺 RCTAnimation 模块的情况。
3. **顶部位置**：iOS 60px (避刘海/灵动岛)，Android 30px。SafeArea 不
   适合用——不挡 status bar 但视觉上更接近通知。
4. **粒子层用 pointerEvents="none"**：粒子飘出时不挡住底层按钮。

## 修复 questions/create.tsx 真实余额

之前 `// 积分余额（从用户信息获取，这里用模拟值） const userBalance = 1000;`
改为：
```ts
const [userBalance, setUserBalance] = useState(0);
useEffect(() => {
  if (authLoading || !isAuthenticated) return;
  apiClient.getPointsBalance().then(d => setUserBalance(Number(d?.balance ?? 0)));
}, [authLoading, isAuthenticated]);
```

API 已存在 `getPointsBalance() → /points/balance`，response `{balance: number}`。

## 测试验证

- TS 编译：0 新增错误（其他 3 个错误是预先存在的）
- 后端 response 形状：share_cards / persona_feedback 验证 earned_points
  + new_balance 字段完整
- 后端 12/12 单元测试通过
- 容器 healthy

## 下一步可扩展

1. **Wallet 页面 Token 消耗反馈**：用同一组件做 `-N Token` 红色版
2. **大胜利场景升级 CelebrationPopup**：完成整个 course / 升级 league
   时切换到全屏 modal 版本
3. **历史流水页面**：用户点 RewardToast 跳到 point_transactions 列表
   （后端已 ready）
