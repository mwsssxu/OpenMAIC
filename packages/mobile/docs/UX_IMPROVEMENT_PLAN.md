# Mobile UI 交互友善性改进计划

## 概览

| 阶段 | 内容 | 预估工作量 | 优先级 |
|------|------|-----------|--------|
| P0 | 修复技术问题 + 关键体验 | 2小时 | 立即执行 |
| P1 | 统一触觉反馈 + 输入优化 | 2小时 | 本周 |
| P2 | 数据真实化 + 可访问性 | 3小时 | 下周 |
| P3 | 错误状态 + 细节完善 | 2小时 | 迭代优化 |

---

## P0: 立即修复 (技术问题 + 关键体验)

### 1. 修复 classroom quizFooter gap 属性

**文件**: `app/classroom/[id].tsx`
**问题**: React Native StyleSheet 不支持 `gap` 属性

```tsx
// 修改前 (约第1801行)
quizFooter: {
  flexDirection: 'row',
  gap: Spacing.sm,  // ❌ 不支持
  ...
}

// 修改后
quizFooter: {
  flexDirection: 'row',
  paddingHorizontal: Spacing.md,
  paddingVertical: Spacing.sm,
  borderTopWidth: 1,
  borderTopColor: '#ddd',
  backgroundColor: 'white',
},
submitButton: {
  ...existingStyles,
  marginRight: Spacing.sm,  // ✅ 替代方案
},
```

### 2. 首页统计卡片添加真实数据源

**文件**: `app/(tabs)/index.tsx`
**问题**: 统计数据是硬编码，无加载态

**改动**:
1. 新增 API 调用获取统计数据
2. 添加 loading 状态
3. 卡片添加点击跳转功能

```tsx
// 新增状态
const [statsLoading, setStatsLoading] = useState(true);
const [statsData, setStatsData] = useState<Stat[]>([]);

// 加载函数
async function loadStats() {
  setStatsLoading(true);
  try {
    const data = await apiClient.getDashboardStats();
    setStatsData(data);
  } catch (e) {
    // 使用默认数据
  } finally {
    setStatsLoading(false);
  }
}

// 卡片改为可点击
<TouchableOpacity 
  style={styles.statCard}
  onPress={() => router.push('/analytics')}
  accessibilityLabel={`${item.label}: ${item.value}`}
>
```

### 3. 笔记购买添加确认弹窗

**文件**: `app/(tabs)/notes.tsx`
**问题**: 直接购买无确认，可能误操作扣费

```tsx
// 修改 purchaseNote 函数
const purchaseNote = async (noteId: string, notePrice: number) => {
  Alert.alert(
    '确认购买',
    `将花费 ${notePrice} 积分购买此笔记，确认吗？`,
    [
      { text: '取消', style: 'cancel' },
      {
        text: '确认购买',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            await apiClient.purchaseNote(noteId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onSuccess();
            loadData();
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            onError();
          }
        }
      }
    ]
  );
};
```

---

## P1: 触觉反馈统一 + 输入优化

### 4. 创建触觉反馈 Hook

**新文件**: `lib/hooks/use-haptics.ts`

```ts
import * as Haptics from 'expo-haptics';

export const useHaptics = () => {
  const light = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const medium = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const heavy = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const warning = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  const error = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  
  return { light, medium, heavy, success, warning, error };
};
```

### 5. 应用触觉反馈到各页面

| 页面 | 触觉点 | 反馈类型 |
|------|--------|---------|
| courses.tsx | 删除确认 | medium |
| courses.tsx | 重命名成功 | success |
| questions.tsx | 排序切换 | light |
| questions.tsx | FAB 点击 | medium |
| notes.tsx | 发布成功 | success |
| notes.tsx | 购买成功 | success |
| index.tsx | 功能按钮 | light |
| classroom | 场景切换 | light (已有) |
| classroom | Quiz 提交 | success (已有) |

### 6. 输入框焦点状态优化

**文件**: `app/auth/login.tsx`, `app/auth/register.tsx`

```tsx
// 新增焦点状态
const [emailFocused, setEmailFocused] = useState(false);
const [passwordFocused, setPasswordFocused] = useState(false);

// 样式
inputFocused: {
  borderColor: Colors.primary.main,
  borderWidth: 2,
  shadowColor: Colors.primary.main,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
},

// TextInput
<TextInput
  style={[styles.input, emailFocused && styles.inputFocused]}
  onFocus={() => setEmailFocused(true)}
  onBlur={() => setEmailFocused(false)}
/>
```

---

## P2: 数据真实化 + 可访问性

### 7. 首页数据 API 集成

**需要新增 API**:
```ts
// lib/api-client.ts
async getDashboardStats(): Promise<{
  students: { value: number; trend: string };
  hours: { value: number; trend: string };
  renewal: { value: number; trend: string };
  loss: { value: number; trend: string };
}>;
```

### 8. 渐变卡片功能实现

**文件**: `app/(tabs)/index.tsx`

```tsx
// "查看详情"按钮添加实际跳转
<TouchableOpacity 
  style={styles.gradientBtn}
  onPress={() => router.push('/analytics/students')}
>
  <Text style={styles.gradientBtnText}>查看详情</Text>
</TouchableOpacity>
```

### 9. 可访问性标签添加

**文件**: 所有页面

**检查清单**:
- [ ] 所有 TouchableOpacity 添加 `accessibilityLabel`
- [ ] 关键图标添加 `accessibilityLabel`
- [ ] 状态变化添加 `accessibilityLiveRegion`
- [ ] 禁用按钮添加 `accessibilityState={{ disabled: true }}`

```tsx
// 示例
<TouchableOpacity
  accessibilityLabel="发布新问题"
  accessibilityRole="button"
  accessibilityHint="点击创建一个新的问题帖"
>
```

### 10. 字数限制提示

**文件**: `app/(tabs)/notes.tsx` (发布弹窗)

```tsx
// 标题字数限制
<Text style={styles.inputLabel}>
  标题 ({title.length}/50)
</Text>
<TextInput
  maxLength={50}
  ...
/>

// 内容字数提示
<Text style={styles.inputLabel}>
  内容 ({content.length}/1000)
</Text>
```

---

## P3: 错误状态 + 细节完善

### 11. 统一错误状态组件

**新文件**: `components/common/ErrorState.tsx`

```tsx
interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  icon?: string;
}

export function ErrorState({ message, onRetry, icon = 'alert-circle' }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon as any} size={48} color={Colors.feedback.errorText} />
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Ionicons name="refresh" size={20} color={Colors.neutral.white} />
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

### 12. 网络错误友好提示

**文件**: `lib/api-client.ts`

```ts
// 添加错误类型判断
function getErrorMessage(error: any): string {
  if (!error.response) {
    return '网络连接失败，请检查网络后重试';
  }
  if (error.response.status === 401) {
    return '登录已过期，请重新登录';
  }
  if (error.response.status === 403) {
    return '无权限执行此操作';
  }
  if (error.response.status >= 500) {
    return '服务器暂时不可用，请稍后再试';
  }
  return error.response?.data?.detail || '操作失败，请重试';
}
```

### 13. OAuth 按钮 hitSlop 优化

**文件**: `app/auth/login.tsx`

```tsx
oauthButton: {
  paddingHorizontal: Spacing.lg,
  paddingVertical: Spacing.md,
  borderRadius: Rounded.md,
  marginLeft: Spacing.sm,
  minHeight: 44,  // ✅ 确保触控区域足够
},
```

### 14. 下拉刷新颜色统一

**文件**: questions.tsx, notes.tsx, courses.tsx, gamification.tsx

```tsx
// 统一使用主色调
<RefreshControl 
  refreshing={isLoading}
  onRefresh={onRefresh}
  colors={[Colors.primary.main]}  // ✅ 统一橙色
  tintColor={Colors.primary.main}
/>
```

---

## 执行计划

### 本周任务 (P0 + P1)

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 1 | 修复 quizFooter gap | classroom/[id].tsx | 待执行 |
| 2 | 笔记购买确认弹窗 | notes.tsx | 待执行 |
| 3 | 创建 useHaptics hook | lib/hooks/use-haptics.ts | 待执行 |
| 4 | 添加触觉反馈 | 5个页面 | 待执行 |
| 5 | 输入框焦点状态 | login.tsx, register.tsx | 待执行 |

### 下周任务 (P2)

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 6 | 统计数据 API | index.tsx + api-client.ts | 待执行 |
| 7 | 渐变卡片跳转 | index.tsx | 待执行 |
| 8 | 可访问性标签 | 所有页面 | 待执行 |
| 9 | 字数限制提示 | notes.tsx | 待执行 |

### 迭代任务 (P3)

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 10 | ErrorState 组件 | components/common/ | 待执行 |
| 11 | 网络错误友好化 | api-client.ts | 待执行 |
| 12 | OAuth 按钮 hitSlop | login.tsx | 待执行 |
| 13 | 下拉刷新颜色统一 | 4个页面 | 待执行 |

---

## 验收标准

### 交互友善性验收清单

- [ ] 所有按钮点击有视觉或触觉反馈
- [ ] 所有加载状态有 ActivityIndicator
- [ ] 所有空状态有图标 + 提示 + 引导
- [ ] 所有错误状态有重试按钮
- [ ] 所有表单有焦点状态高亮
- [ ] 所有敏感操作有确认弹窗
- [ ] 所有 FAB 按钮 ≥ 56px
- [ ] 所有工具按钮 ≥ 44px
- [ ] 关键交互有 accessibilityLabel
- [ ] 无 `gap` 属性使用 (RN 不支持)

---

*文档版本: 1.0*
*创建日期: 2026-05-15*
*预估总工时: 9小时*