# 移动端场景和Action交互适配优化方案

## 一、当前实现分析

### 1. 场景类型

| 类型 | 描述 | 当前适配状态 |
|------|------|-------------|
| `slide` | 幻灯片 | ✅ 基本适配（响应式缩放） |
| `quiz` | 测验 | ⚠️ 部分适配（滑动手势、持久化） |
| `interactive` | 互动内容 | ❌ 未适配 |
| `pbl` | 项目学习 | ❌ 未适配 |

### 2. 白板Action类型

| Action | 功能 | 当前适配状态 |
|--------|------|-------------|
| `wb_draw_text` | 文本绘制 | ✅ 垂直布局 + 背景色 |
| `wb_draw_shape` | 形状绘制 | ✅ 自适应位置 |
| `wb_draw_chart` | 图表 | ✅ 自适应尺寸 |
| `wb_draw_table` | 表格 | ⚠️ 宽表格溢出 |
| `wb_draw_code` | 代码块 | ⚠️ 水平滚动 |
| `wb_draw_latex` | LaTeX公式 | ✅ 自适应高度 |
| `wb_edit_code` | 代码编辑 | ❌ 未实现移动端编辑 |

### 3. 布局模式

| 模式 | 设备 | 实现 |
|------|------|------|
| `vertical` | 小屏手机 (<500px) | 单列垂直堆叠 |
| `limited-horizontal` | 大屏手机 (500-768px) | 双列布局 |
| `horizontal` | 平板 (≥768px) | 三列布局 |

---

## 二、需要优化的场景

### 场景A: Quiz测验

**现状问题：**
1. 长题目/选项可能溢出容器
2. 简答题输入框缺少键盘适配
3. 多选题选项过多时滚动体验差

**优化方案：**

```typescript
// 1. 响应式字体和容器
const questionFontSize = responsiveValue({
  compact: 14, regular: 16, medium: 18, large: 20
}, breakpoint);

// 2. 选项卡片网格布局（平板）
<ResponsiveGrid columns={{ compact: 1, regular: 1, medium: 2, large: 2 }}>
  {options.map(opt => <OptionCard />)}
</ResponsiveGrid>

// 3. 键盘适配
<KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={80}>
  <TextInput />
</KeyboardAvoidingView>
```

### 场景B: 白板代码块

**现状问题：**
1. 水平滚动体验不佳
2. 无语法高亮
3. 无行号显示
4. 无复制功能

**优化方案：**

```typescript
// 1. 代码块组件增强
const CodeBlock = ({ code, lang }) => {
  const [expanded, setExpanded] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  return (
    <View style={styles.codeBlock}>
      <View style={styles.codeHeader}>
        <Text style={styles.codeLang}>{lang}</Text>
        <TouchableOpacity onPress={() => Clipboard.setString(code)}>
          <Ionicons name="copy-outline" size={16} />
        </TouchableOpacity>
      </View>
      {/* 折叠/展开 */}
      <ScrollView
        horizontal={!expanded}
        showsHorizontalScrollIndicator={false}
      >
        <Text style={styles.codeText}>
          {showLineNumbers && codeWithLineNumbers(code)}
        </Text>
      </ScrollView>
      {code.split('\n').length > 10 && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text>{expanded ? '收起' : '展开全部'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### 场景C: 白板表格

**现状问题：**
1. 宽表格在移动端显示不完整
2. 无横向滚动指示

**优化方案：**

```typescript
// 表格组件增强
const TableElement = ({ data, outline, theme }) => {
  const scrollX = useSharedValue(0);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(true);

  return (
    <View style={styles.tableContainer}>
      {/* 左侧阴影指示器 */}
      {showLeftShadow && <View style={styles.leftShadow} />}

      <ScrollView
        horizontal
        onScroll={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          setShowLeftShadow(contentOffset.x > 10);
          setShowRightShadow(
            contentOffset.x < contentSize.width - layoutMeasurement.width - 10
          );
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.table}>
          {data.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              {row.map((cell, j) => (
                <Text key={j} style={styles.tableCell}>{cell}</Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 右侧阴影指示器 */}
      {showRightShadow && <View style={styles.rightShadow} />}
    </View>
  );
};
```

### 场景D: 聚光灯/激光笔动画

**现状问题：**
1. 低端设备性能问题
2. 无障碍支持缺失

**优化方案：**

```typescript
// 1. 性能优化：减少重绘
const SpotlightOverlay = memo(({ geometry, ... }) => {
  // 使用 useDerivedValue 合并动画
  const animatedStyle = useAnimatedStyle(() => {
    const padding = paddingAnim.value;
    const radius = borderRadiusAnim.value;
    return {
      padding,
      borderRadius: radius,
    };
  });

  // 2. 低端设备降级
  const { isTablet } = useResponsiveDimensions();
  const animationDuration = isLowEndDevice ? 300 : 600;

  // 3. 无障碍
  return (
    <View
      accessible={true}
      accessibilityLabel="聚焦区域"
      accessibilityRole="none"
    >
      {/* overlay layers */}
    </View>
  );
});

// 3. 激光笔简化
const LaserOverlay = ({ position }) => {
  // 减少粒子数量
  const particleCount = isLowEndDevice ? 1 : 3;
};
```

### 场景E: 多Agent讨论

**现状问题：**
1. 文字流式更新频繁导致重渲染
2. 当前发言者指示不明显
3. 平板上可利用更大屏幕

**优化方案：**

```typescript
// 1. 批量更新优化
const useBatchedUpdates = () => {
  const pendingUpdates = useRef<string[]>([]);
  const flushTimeout = useRef<NodeJS.Timeout>();

  const addUpdate = useCallback((text: string) => {
    pendingUpdates.current.push(text);
    if (!flushTimeout.current) {
      flushTimeout.current = setTimeout(() => {
        setDisplayText(prev => prev + pendingUpdates.current.join(''));
        pendingUpdates.current = [];
        flushTimeout.current = null;
      }, 100); // 每100ms批量更新
    }
  }, []);
};

// 2. 平板分屏讨论视图
const DiscussionPanel = ({ agents }) => {
  const { isTablet } = useResponsiveDimensions();

  if (isTablet) {
    return (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 2 }}>
          <ChatMessages />
        </View>
        <View style={{ flex: 1 }}>
          <AgentList agents={agents} />
        </View>
      </View>
    );
  }

  return <ChatMessages />;
};
```

---

## 三、交互优化建议

### 1. 触摸目标尺寸

```typescript
// 确保44x44pt最小触摸区域
const TOUCH_TARGET_MIN = 44;

const styles = StyleSheet.create({
  button: {
    minWidth: TOUCH_TARGET_MIN,
    minHeight: TOUCH_TARGET_MIN,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

### 2. 手势冲突处理

```typescript
// 场景切换 vs 内部滚动
const gesture = Gesture.Pan()
  .activeOffsetX([-20, 20]) // 需要移动20px才激活
  .failOffsetY([-10, 10])  // 垂直移动则失败
  .onStart(() => {
    // 取消内部滚动
  });
```

### 3. 横屏适配

```typescript
// 检测横屏
const { width, height } = useWindowDimensions();
const isLandscape = width > height;

// 横屏布局调整
const slideHeight = isLandscape ? height * 0.7 : height * 0.5;
```

### 4. 分屏模式（iPad）

```typescript
// 检测分屏
const { width } = useWindowDimensions();
const isCompactMode = width < 600; // 分屏时的紧凑模式

// 功能降级
if (isCompactMode) {
  // 隐藏次要功能
  // 简化布局
}
```

---

## 四、性能优化清单

| 优化项 | 方法 | 优先级 |
|--------|------|--------|
| 减少重渲染 | React.memo, useMemo | 高 |
| 动画性能 | useAnimatedStyle, useDerivedValue | 高 |
| 列表优化 | FlatList virtualization | 中 |
| 图片优化 | resize, cache | 中 |
| 网络请求 | 缓存, 分页 | 中 |
| 内存管理 | 清理定时器, 取消订阅 | 高 |

---

## 五、实现优先级

### P0 - 立即优化
1. Quiz键盘适配
2. 代码块折叠/展开
3. 触摸目标尺寸检查

### P1 - 短期优化
1. 表格横向滚动指示
2. 多Agent讨论批处理
3. 动画性能优化

### P2 - 中期优化
1. 横屏布局支持
2. iPad分屏适配
3. 互动场景WebView集成
