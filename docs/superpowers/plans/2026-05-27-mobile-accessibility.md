# 移动端无障碍访问改进计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为移动端应用添加完整的无障碍支持，使视障用户能够通过 VoiceOver/TalkBack 有效使用应用。

**Architecture:** 采用分层策略：核心交互组件优先、全局导航其次、辅助功能最后。使用 React Native 内置 accessibility props + 自定义 accessibility actions。

**Tech Stack:** React Native, expo-haptics, i18n 国际化

---

## 背景

当前移动端应用几乎没有无障碍实现（仅 register.tsx 有一个 accessibilityLabel）。需要为：
1. 可交互元素添加 `accessibilityLabel`、`accessibilityHint`、`accessibilityRole`
2. 图片/图标添加替代文本
3. 自定义手势组件添加 `accessibilityActions`
4. 确保颜色对比度符合 WCAG 2.1 AA 标准
5. 支持动态字体大小

---

## 设计要点

### iOS VoiceOver / Android TalkBack 优先级

- **高优先级**：导航、课程卡片、测验、白板、WebView
- **中优先级**：设置页面、列表筛选
- **低优先级**：装饰性元素

### 无障碍属性策略

```typescript
// 标准交互元素
<TouchableOpacity
  accessibilityLabel="课程名称"
  accessibilityHint="点击查看课程详情"
  accessibilityRole="button"
>

// 自定义手势组件
<View
  accessibilityLabel="白板画布"
  accessibilityHint="双指缩放可放大画布，单指绘制"
  accessibilityRole="image"
  accessibilityActions={[
    { name: 'activate', label: '开始绘制' },
    { name: 'increment', label: '放大' },
    { name: 'decrement', label: '缩小' },
  ]}
  onAccessibilityAction={(event) => {
    switch (event.nativeEvent.actionName) {
      case 'activate': startDrawing(); break;
      case 'increment': zoomIn(); break;
      case 'decrement': zoomOut(); break;
    }
  }}
>
```

### 国际化

所有无障碍文本通过 i18n 系统提供，支持多语言。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/mobile/lib/i18n/index.ts` | 修改 | 添加 accessibility 翻译键 |
| `packages/mobile/lib/components/IOSTabBar.tsx` | 修改 | Tab 导航无障碍 |
| `packages/mobile/components/classroom-card.tsx` | 修改 | 课程卡片无障碍 |
| `packages/mobile/app/(tabs)/courses.tsx` | 修改 | 课程列表无障碍 |
| `packages/mobile/components/playback/Quiz.tsx` | 修改 | 测验组件无障碍 |
| `packages/mobile/components/playback/whiteboard.tsx` | 修改 | 白板手势无障碍 |
| `packages/mobile/components/playback/InteractiveWebView.tsx` | 修改 | WebView 无障碍 |
| `packages/mobile/components/playback/PointerOverlay.tsx` | 修改 | 激光笔/聚光灯无障碍 |

---

### Task 1: 添加无障碍国际化翻译键

**Files:**
- Modify: `packages/mobile/lib/i18n/index.ts`

- [ ] **Step 1: 在 zh-CN 翻译对象中添加 accessibility 部分**

在 `translations['zh-CN']` 对象的末尾（`webview` 之后）添加：

```typescript
    // 无障碍
    accessibility: {
      // TabBar
      tabHome: '首页',
      tabCourses: '课程',
      tabNotes: '笔记',
      tabProfile: '我的',
      tabCreate: '创建新课程',
      // 课程卡片
      courseCard: '课程',
      courseCardHint: '点击查看课程详情，长按可弹出操作菜单',
      courseProgress: '进度 {percent}%',
      courseStatusInProgress: '学习中',
      courseStatusCompleted: '已完成',
      courseStatusNotStarted: '未开始',
      // 测验
      quizQuestion: '第 {num} 题，共 {total} 题',
      quizOption: '选项 {letter}',
      quizOptionSelected: '已选中',
      quizOptionNotSelected: '未选中',
      quizSingleChoice: '单选题',
      quizMultipleChoice: '多选题',
      quizShortAnswer: '简答题',
      quizSubmitHint: '提交后查看得分',
      quizPrevHint: '返回上一题',
      quizNextHint: '前往下一题',
      // 白板
      whiteboardCanvas: '白板画布',
      whiteboardCanvasHint: '双指捏合可缩放画布，单指滑动可绘制，双击重置视图',
      whiteboardZoomIn: '放大',
      whiteboardZoomOut: '缩小',
      whiteboardResetView: '重置视图到原始大小',
      whiteboardUndo: '撤销最后一步绘制',
      whiteboardClear: '清空整个画布',
      whiteboardColorPicker: '选择画笔颜色',
      whiteboardStrokePicker: '选择画笔粗细',
      whiteboardColor: '{color}颜色',
      whiteboardStroke: '{width}像素粗细',
      // 激光笔/聚光灯
      laserPointer: '激光笔',
      laserPointerHint: '点击屏幕放置激光点',
      spotlight: '聚光灯',
      spotlightHint: '双指拖动可移动聚光灯位置',
      spotlightEnable: '启用聚光灯',
      spotlightDisable: '关闭聚光灯',
      // WebView
      interactiveContent: '互动内容',
      interactiveContentHint: '包含交互式学习内容',
      webViewReload: '重新加载内容',
      webViewBack: '返回上一页',
      webViewForward: '前进到下一页',
      webViewOpenBrowser: '在浏览器中打开',
      // 导航
      backButton: '返回',
      backButtonHint: '返回上一页',
      closeButton: '关闭',
      closeButtonHint: '关闭当前页面',
      menuButton: '菜单',
      menuButtonHint: '打开操作菜单',
      // 搜索
      searchButton: '搜索',
      searchButtonHint: '搜索课程或内容',
      // 状态
      loading: '正在加载',
      loadingHint: '请稍候',
      error: '加载失败',
      errorHint: '点击重试',
      empty: '暂无内容',
      // 筛选
      filterAll: '全部',
      filterInProgress: '学习中',
      filterCompleted: '已完成',
      filterNotStarted: '未开始',
      filterHint: '筛选显示{status}的课程',
      // 视图切换
      viewModeList: '列表视图',
      viewModeGrid: '网格视图',
      viewModeHint: '切换为{mode}显示',
    },
```

- [ ] **Step 2: 在 en-US 翻译对象中添加 accessibility 部分**

在 `translations['en-US']` 对象的末尾（`webview` 之后）添加：

```typescript
    accessibility: {
      // TabBar
      tabHome: 'Home',
      tabCourses: 'Courses',
      tabNotes: 'Notes',
      tabProfile: 'Me',
      tabCreate: 'Create new course',
      // Course card
      courseCard: 'Course',
      courseCardHint: 'Tap to view course details, long press for options',
      courseProgress: '{percent}% progress',
      courseStatusInProgress: 'In Progress',
      courseStatusCompleted: 'Completed',
      courseStatusNotStarted: 'Not Started',
      // Quiz
      quizQuestion: 'Question {num} of {total}',
      quizOption: 'Option {letter}',
      quizOptionSelected: 'Selected',
      quizOptionNotSelected: 'Not selected',
      quizSingleChoice: 'Single Choice',
      quizMultipleChoice: 'Multiple Choice',
      quizShortAnswer: 'Short Answer',
      quizSubmitHint: 'Submit to view your score',
      quizPrevHint: 'Go to previous question',
      quizNextHint: 'Go to next question',
      // Whiteboard
      whiteboardCanvas: 'Whiteboard canvas',
      whiteboardCanvasHint: 'Pinch to zoom, drag to draw, double tap to reset view',
      whiteboardZoomIn: 'Zoom in',
      whiteboardZoomOut: 'Zoom out',
      whiteboardResetView: 'Reset view to original size',
      whiteboardUndo: 'Undo last stroke',
      whiteboardClear: 'Clear entire canvas',
      whiteboardColorPicker: 'Choose pen color',
      whiteboardStrokePicker: 'Choose pen thickness',
      whiteboardColor: '{color} color',
      whiteboardStroke: '{width} pixel thickness',
      // Laser/Spotlight
      laserPointer: 'Laser pointer',
      laserPointerHint: 'Tap screen to place laser point',
      spotlight: 'Spotlight',
      spotlightHint: 'Drag with two fingers to move spotlight',
      spotlightEnable: 'Enable spotlight',
      spotlightDisable: 'Disable spotlight',
      // WebView
      interactiveContent: 'Interactive content',
      interactiveContentHint: 'Contains interactive learning material',
      webViewReload: 'Reload content',
      webViewBack: 'Go back',
      webViewForward: 'Go forward',
      webViewOpenBrowser: 'Open in browser',
      // Navigation
      backButton: 'Back',
      backButtonHint: 'Go back to previous page',
      closeButton: 'Close',
      closeButtonHint: 'Close current page',
      menuButton: 'Menu',
      menuButtonHint: 'Open action menu',
      // Search
      searchButton: 'Search',
      searchButtonHint: 'Search courses or content',
      // Status
      loading: 'Loading',
      loadingHint: 'Please wait',
      error: 'Failed to load',
      errorHint: 'Tap to retry',
      empty: 'No content',
      // Filter
      filterAll: 'All',
      filterInProgress: 'In Progress',
      filterCompleted: 'Completed',
      filterNotStarted: 'Not Started',
      filterHint: 'Show {status} courses',
      // View mode
      viewModeList: 'List view',
      viewModeGrid: 'Grid view',
      viewModeHint: 'Switch to {mode} view',
    },
```

---

### Task 2: IOSTabBar 无障碍支持

**Files:**
- Modify: `packages/mobile/lib/components/IOSTabBar.tsx`

- [ ] **Step 1: 导入 i18n**

在文件顶部导入区域添加：

```typescript
import { useI18n } from '@/lib/i18n';
```

- [ ] **Step 2: 在组件内使用 i18n**

在 `IOSTabBar` 函数组件开头添加：

```typescript
export const IOSTabBar: React.FC<TabBarProps> = ({ onCreatePress }) => {
  const { t } = useI18n();
  const pathname = usePathname();
  // ... 其他现有代码
```

- [ ] **Step 3: 为左侧 Tab 添加无障碍属性**

替换左侧两个 Tab 的 TouchableOpacity（约第55-70行）：

```typescript
      {/* 左侧两个 Tab */}
      {tabs.slice(0, 2).map((tab) => {
        const isActiveTab = isActive(tab.route);
        const accessibilityLabelMap: Record<string, string> = {
          '首页': t('accessibility.tabHome'),
          '课程': t('accessibility.tabCourses'),
          '笔记': t('accessibility.tabNotes'),
          '我的': t('accessibility.tabProfile'),
        };
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tabItem, isActiveTab && styles.tabItemActive]}
            onPress={() => handleTabPress(tab.route)}
            activeOpacity={0.7}
            accessibilityLabel={accessibilityLabelMap[tab.name] || tab.name}
            accessibilityHint={isActiveTab ? undefined : `点击进入${tab.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActiveTab }}
          >
            <Text style={[styles.tabIcon, { fontSize: emojiSize }]} accessibilityRole="image" accessibilityLabel={tab.emoji}>{tab.emoji}</Text>
            <Text style={[
              styles.tabLabel,
              { fontSize: labelSize },
              isActiveTab && styles.tabLabelActive
            ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
```

- [ ] **Step 4: 为创建按钮添加无障碍属性**

替换中间创建按钮的 TouchableOpacity（约第74-88行）：

```typescript
      {/* 中间创建按钮 */}
      <TouchableOpacity
        style={[
          styles.fabCreate,
          {
            width: fabSize,
            height: fabSize,
            borderRadius: fabSize / 2,
            top: responsiveValue({ compact: -14, regular: -14, medium: -16, large: -18 }, breakpoint),
          }
        ]}
        onPress={onCreatePress || (() => router.push('/classroom/create'))}
        activeOpacity={0.85}
        accessibilityLabel={t('accessibility.tabCreate')}
        accessibilityHint="点击创建新的学习课程"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={fabIconSize} color="white" accessibilityRole="image" accessibilityLabel="添加图标" />
      </TouchableOpacity>
```

- [ ] **Step 5: 为右侧 Tab 添加无障碍属性**

替换右侧两个 Tab 的 TouchableOpacity（约第91-107行）：

```typescript
      {/* 右侧两个 Tab */}
      {tabs.slice(2, 4).map((tab) => {
        const isActiveTab = isActive(tab.route);
        const accessibilityLabelMap: Record<string, string> = {
          '首页': t('accessibility.tabHome'),
          '课程': t('accessibility.tabCourses'),
          '笔记': t('accessibility.tabNotes'),
          '我的': t('accessibility.tabProfile'),
        };
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tabItem, isActiveTab && styles.tabItemActive]}
            onPress={() => handleTabPress(tab.route)}
            activeOpacity={0.7}
            accessibilityLabel={accessibilityLabelMap[tab.name] || tab.name}
            accessibilityHint={isActiveTab ? undefined : `点击进入${tab.name}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActiveTab }}
          >
            <Text style={[styles.tabIcon, { fontSize: emojiSize }]} accessibilityRole="image" accessibilityLabel={tab.emoji}>{tab.emoji}</Text>
            <Text style={[
              styles.tabLabel,
              { fontSize: labelSize },
              isActiveTab && styles.tabLabelActive
            ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
```

---

### Task 3: ClassroomCard 无障碍支持

**Files:**
- Modify: `packages/mobile/components/classroom-card.tsx`

- [ ] **Step 1: 导入 i18n**

在文件顶部导入区域添加：

```typescript
import { useI18n } from '@/lib/i18n';
```

- [ ] **Step 2: 在组件内使用 i18n 并添加无障碍属性**

修改 `ClassroomCard` 函数组件：

```typescript
export function ClassroomCard({ classroom, onPress, onLongPress, thumbnail }: ClassroomCardProps) {
  const { t } = useI18n();
  const handleLongPress = () => {
    if (!onLongPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  // 构建无障碍标签
  const accessibilityLabel = `${t('accessibility.courseCard')}: ${classroom.name}`;
  const accessibilityHint = onLongPress 
    ? t('accessibility.courseCardHint') 
    : '点击查看课程详情';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      delayLongPress={350}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
    >
      {/* 缩略图区域 */}
      {thumbnail && (
        <View 
          style={styles.thumbnailArea}
          accessibilityRole="image"
          accessibilityLabel="课程缩略图"
        >
          {thumbnail}
          {/* Deep-Interactive Badge */}
          {classroom.interactiveMode && (
            <View 
              style={styles.interactiveBadge}
              accessibilityRole="image"
              accessibilityLabel="互动课程标识"
            >
              <Ionicons name="game-controller" size={12} color="white" />
              <Text style={styles.interactiveBadgeText}>互动</Text>
            </View>
          )}
        </View>
      )}

      {/* 内容区域 */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text 
            style={styles.title} 
            numberOfLines={2}
            accessibilityRole="header"
          >{classroom.name}</Text>
          {/* 无缩略图时，Badge 放在标题旁 */}
          {!thumbnail && classroom.interactiveMode && (
            <View 
              style={styles.interactiveBadgeSmall}
              accessibilityRole="image"
              accessibilityLabel="互动课程标识"
            >
              <Ionicons name="game-controller" size={10} color="white" />
            </View>
          )}
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {classroom.description || '暂无描述'}
        </Text>
        <View style={styles.metaRow} accessibilityRole="text">
          <Ionicons name="layers-outline" size={12} color="#999" accessibilityRole="image" accessibilityLabel="场景图标" />
          <Text style={styles.metaText}>
            {classroom.scene_count || 0} 场景
          </Text>
          <Text style={styles.date}>
            {new Date(classroom.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
```

---

### Task 4: Courses 页面无障碍支持

**Files:**
- Modify: `packages/mobile/app/(tabs)/courses.tsx`

- [ ] **Step 1: 导入 i18n**

在文件顶部导入区域（约第14行后）添加：

```typescript
import { useI18n } from '@/lib/i18n';
```

- [ ] **Step 2: 在组件内使用 i18n**

在 `CoursesScreen` 函数组件开头（约第60行后）添加：

```typescript
export default function CoursesScreen() {
  const { t } = useI18n();
  const router = useRouter();
  // ... 其他现有代码
```

- [ ] **Step 3: 为页面头部按钮添加无障碍属性**

修改 pageHeader 部分（约第290-312行）：

```typescript
      {/* 页面头部 */}
      <View style={styles.pageHeader}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.backButton')}
          accessibilityHint={t('accessibility.backButtonHint')}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={20} color={iOSColors.fg} accessibilityRole="image" accessibilityLabel="返回箭头" />
        </TouchableOpacity>
        <Text style={styles.pageTitle} accessibilityRole="header">我的课程</Text>
        <View style={styles.pageHeaderActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => {
              haptics.light();
              onPress();
              // 后续添加搜索功能
            }}
            activeOpacity={0.7}
            accessibilityLabel={t('accessibility.searchButton')}
            accessibilityHint={t('accessibility.searchButtonHint')}
            accessibilityRole="button"
          >
            <Ionicons name="search-outline" size={18} color={iOSColors.muted} accessibilityRole="image" accessibilityLabel="搜索图标" />
          </TouchableOpacity>
        </View>
      </View>
```

- [ ] **Step 4: 为筛选标签添加无障碍属性**

修改 filterTabs 部分（约第315-364行）：

```typescript
      {/* 筛选标签 */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('all');
          }}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.filterAll')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterAll') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'all' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}>
            全部 <Text style={{ opacity: 0.6 }}>({courseStats.total})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'progress' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('progress');
          }}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.filterInProgress')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterInProgress') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'progress' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'progress' && styles.filterTabTextActive]}>
            学习中 <Text style={{ opacity: 0.6 }}>({courseStats.inProgress})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'completed' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('completed');
          }}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.filterCompleted')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterCompleted') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'completed' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'completed' && styles.filterTabTextActive]}>
            已完成 <Text style={{ opacity: 0.6 }}>({courseStats.completed})</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === 'notstarted' && styles.filterTabActive]}
          onPress={() => {
            haptics.light();
            setActiveFilter('notstarted');
          }}
          activeOpacity={0.7}
          accessibilityLabel={t('accessibility.filterNotStarted')}
          accessibilityHint={t('accessibility.filterHint', { status: t('accessibility.filterNotStarted') })}
          accessibilityRole="button"
          accessibilityState={{ selected: activeFilter === 'notstarted' }}
        >
          <Text style={[styles.filterTabText, activeFilter === 'notstarted' && styles.filterTabTextActive]}>
            未开始 <Text style={{ opacity: 0.6 }}>({courseStats.notStarted})</Text>
          </Text>
        </TouchableOpacity>
      </View>
```

- [ ] **Step 5: 为视图切换和排序按钮添加无障碍属性**

修改 sortBar 部分（约第367-400行）：

```typescript
      {/* 排序栏 */}
      <View style={styles.sortBar}>
        <Text style={styles.courseCount} accessibilityRole="text">共 {filteredClassrooms.length} 门课程</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          {/* 视图切换按钮 - 仅平板显示 */}
          {isTablet && (
            <View style={{ flexDirection: 'row', gap: 4, backgroundColor: iOSColors.surface, borderRadius: 8, padding: 2 }} accessibilityRole="tablist">
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('list')}
                accessibilityLabel={t('accessibility.viewModeList')}
                accessibilityHint={t('accessibility.viewModeHint', { mode: t('accessibility.viewModeList') })}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === 'list' }}
              >
                <Ionicons name="list" size={16} color={viewMode === 'list' ? iOSColors.accent : iOSColors.muted} accessibilityRole="image" accessibilityLabel="列表图标" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('grid')}
                accessibilityLabel={t('accessibility.viewModeGrid')}
                accessibilityHint={t('accessibility.viewModeHint', { mode: t('accessibility.viewModeGrid') })}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === 'grid' }}
              >
                <Ionicons name="grid" size={16} color={viewMode === 'grid' ? iOSColors.accent : iOSColors.muted} accessibilityRole="image" accessibilityLabel="网格图标" />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.sortBtn}
            onPress={() => {
              haptics.light();
              onPress();
              // 后续添加排序功能
            }}
            activeOpacity={0.7}
            accessibilityLabel="排序"
            accessibilityHint="按最近更新排序"
            accessibilityRole="button"
          >
            <Text style={styles.sortBtnText}>最近更新</Text>
            <Ionicons name="chevron-down" size={14} color={iOSColors.muted} accessibilityRole="image" accessibilityLabel="下拉箭头" />
          </TouchableOpacity>
        </View>
      </View>
```

- [ ] **Step 6: 为课程卡片添加无障碍属性**

修改 CourseCard 组件内的 TouchableOpacity（约第179-209行和第213-263行）：

列表模式卡片：
```typescript
    // 列表模式
    return (
      <TouchableOpacity
        onPress={() => router.push(`/course/${classroom.id}` as any)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessibilityLabel={`${classroom.name}，${statusInfo.label}，进度${progress}%`}
        accessibilityHint="点击查看课程详情"
        accessibilityRole="button"
      >
```

网格模式卡片：
```typescript
      return (
        <TouchableOpacity
          style={styles.gridCardWrapper}
          onPress={() => router.push(`/course/${classroom.id}` as any)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
          accessibilityLabel={`${classroom.name}，${statusInfo.label}，进度${progress}%`}
          accessibilityHint="点击查看课程详情"
          accessibilityRole="button"
        >
```

- [ ] **Step 7: 为空状态和错误状态添加无障碍属性**

修改空状态和错误状态部分（约第267-284行和第415-423行）：

```typescript
  if (loading) {
    return (
      <View style={styles.center} accessibilityRole="text" accessibilityLabel={t('accessibility.loading')}>
        <ActivityIndicator size="large" color={iOSColors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center} accessibilityRole="text" accessibilityLabel={t('accessibility.error')}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" accessibilityRole="image" accessibilityLabel="错误图标" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryBtn} 
          onPress={loadClassrooms}
          accessibilityLabel={t('common.retry')}
          accessibilityHint={t('accessibility.errorHint')}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }
```

空状态：
```typescript
        ListEmptyComponent={
          <View style={styles.emptyState} accessibilityRole="text" accessibilityLabel={t('accessibility.empty')}>
            <View style={styles.emptyIcon} accessibilityRole="image" accessibilityLabel="空文件夹图标">
              <Ionicons name="folder-open-outline" size={28} color={iOSColors.accent} />
            </View>
            <Text style={styles.emptyTitle}>暂无课程</Text>
            <Text style={styles.emptyDesc}>创建你的第一个课程开始学习</Text>
          </View>
        }
```

---

### Task 5: Quiz 组件无障碍支持

**Files:**
- Modify: `packages/mobile/components/playback/Quiz.tsx`

- [ ] **Step 1: 为进度指示添加无障碍属性**

修改 progress 部分（约第300-309行）：

```typescript
      {/* 进度指示 */}
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: questions.length, now: currentIndex + 1 }}>
        <Text style={styles.progressText} accessibilityRole="text">
          {t('accessibility.quizQuestion', { num: currentIndex + 1, total: questions.length })}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
        </View>
        <Text style={styles.swipeHint}>{t('quiz.swipeHint') || '左右滑动切换题目'}</Text>
      </View>
```

- [ ] **Step 2: 为问题类型标签添加无障碍属性**

修改 questionType 部分（约第316-317行）：

```typescript
            <Text style={styles.questionType} accessibilityRole="header">
              {currentQuestion.type === 'single' ? t('accessibility.quizSingleChoice') :
               currentQuestion.type === 'multiple' ? t('accessibility.quizMultipleChoice') : t('accessibility.quizShortAnswer')}
            </Text>
```

- [ ] **Step 3: 为选项添加无障碍属性**

修改单选题和多选题选项部分（约第322-350行）：

单选题：
```typescript
            {/* 单选题 */}
            {currentQuestion.type === 'single' && currentQuestion.options?.map((option, i) => {
              const isSelected = isOptionSelected(currentQuestion.id, option);
              const letter = ['A', 'B', 'C', 'D', 'E', 'F'][i] || String(i + 1);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSingleSelect(currentQuestion.id, option)}
                  onLongPress={() => handleOptionLongPress(option)}
                  delayLongPress={300}
                  accessibilityLabel={`${t('accessibility.quizOption', { letter })}，${option}`}
                  accessibilityHint={isSelected ? t('accessibility.quizOptionSelected') : t('accessibility.quizOptionNotSelected')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View 
                    style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}
                    accessibilityRole="image"
                    accessibilityLabel={isSelected ? '选中' : '未选中'}
                  >
                    {isSelected && <View style={styles.optionRadioInner} />}
                  </View>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              );
            })}
```

多选题：
```typescript
            {/* 多选题 */}
            {currentQuestion.type === 'multiple' && currentQuestion.options?.map((option, i) => {
              const isSelected = isOptionSelected(currentQuestion.id, option);
              const letter = ['A', 'B', 'C', 'D', 'E', 'F'][i] || String(i + 1);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleMultipleSelect(currentQuestion.id, option)}
                  onLongPress={() => handleOptionLongPress(option)}
                  delayLongPress={300}
                  accessibilityLabel={`${t('accessibility.quizOption', { letter })}，${option}`}
                  accessibilityHint={isSelected ? t('accessibility.quizOptionSelected') : t('accessibility.quizOptionNotSelected')}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                >
                  <View 
                    style={[styles.optionCheckbox, isSelected && styles.optionCheckboxSelected]}
                    accessibilityRole="image"
                    accessibilityLabel={isSelected ? '勾选' : '未勾选'}
                  >
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              );
            })}
```

- [ ] **Step 4: 为简答题输入框添加无障碍属性**

修改简答题部分（约第354-363行）：

```typescript
            {/* 简答题 */}
            {currentQuestion.type === 'short' && (
              <TextInput
                style={styles.shortAnswerInput}
                multiline
                numberOfLines={4}
                placeholder={t('quiz.placeholder')}
                value={(answers[currentQuestion.id] as string) || ''}
                onChangeText={(text) => handleShortAnswer(currentQuestion.id, text)}
                accessibilityLabel={t('accessibility.quizShortAnswer')}
                accessibilityHint="输入你的答案"
                accessibilityRole="textbox"
              />
            )}
```

- [ ] **Step 5: 为导航按钮添加无障碍属性**

修改 navigation 部分（约第369-387行）：

```typescript
      {/* 导航按钮 */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
          accessibilityLabel={t('quiz.prevQuestion')}
          accessibilityHint={currentIndex === 0 ? undefined : t('accessibility.quizPrevHint')}
          accessibilityRole="button"
          accessibilityState={{ disabled: currentIndex === 0 }}
        >
          <Text style={styles.navButtonText}>{t('quiz.prevQuestion')}</Text>
        </TouchableOpacity>

        {!isLastQuestion ? (
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={handleNext}
            accessibilityLabel={t('quiz.nextQuestion')}
            accessibilityHint={t('accessibility.quizNextHint')}
            accessibilityRole="button"
          >
            <Text style={styles.navButtonText}>{t('quiz.nextQuestion')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.submitButton} 
            onPress={handleSubmit}
            accessibilityLabel={t('quiz.submit')}
            accessibilityHint={t('accessibility.quizSubmitHint')}
            accessibilityRole="button"
          >
            <Text style={styles.submitButtonText}>{t('quiz.submit')}</Text>
          </TouchableOpacity>
        )}
      </View>
```

- [ ] **Step 6: 为结果页面添加无障碍属性**

修改 submitted 视图（约第267-291行）：

```typescript
  if (submitted) {
    return (
      <ScrollView style={styles.resultContainer} accessibilityRole="text">
        <Text style={styles.resultTitle} accessibilityRole="header">{t('quiz.score')}: {score}%</Text>

        {/* 结果列表 */}
        {questions.map((q, index) => (
          <View key={q.id} style={styles.resultItem} accessibilityRole="text">
            <Text style={styles.resultQuestion}>{index + 1}. {q.question}</Text>
            <View style={styles.resultStatus}>
              <Text 
                style={[styles.resultBadge, isAnswerCorrect(q) ? styles.correctBadge : styles.incorrectBadge]}
                accessibilityRole="text"
              >
                {isAnswerCorrect(q) ? t('quiz.correct') : t('quiz.incorrect')}
              </Text>
            </View>
            {q.aiAnalysis && (
              <Text style={styles.analysis}>{t('quiz.analysis')}{q.aiAnalysis}</Text>
            )}
          </View>
        ))}

        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={handleRetry}
          accessibilityLabel={t('quiz.retry')}
          accessibilityHint="重新开始答题"
          accessibilityRole="button"
        >
          <Text style={styles.retryButtonText}>{t('quiz.retry')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
```

- [ ] **Step 7: 为批改中状态添加无障碍属性**

修改 grading 视图（约第254-265行）：

```typescript
  if (grading) {
    return (
      <View style={styles.gradingContainer} accessibilityRole="text" accessibilityLabel={t('quiz.aiGrading')}>
        <Text style={styles.gradingText}>{t('quiz.aiGrading')}</Text>
        <View style={styles.progressDots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, styles.dotActive]} accessibilityRole="image" accessibilityLabel="加载指示点" />
          ))}
        </View>
      </View>
    );
  }
```

---

### Task 6: Whiteboard 无障碍支持

**Files:**
- Modify: `packages/mobile/components/playback/whiteboard.tsx`

- [ ] **Step 1: 为画布添加 accessibilityActions**

在画布的 GestureDetector 包裹的 View 中添加无障碍属性（约第279-297行）：

```typescript
      {/* 白板画布 */}
      <GestureDetector gesture={composedGesture}>
        <View 
          style={[styles.canvas, { width: screenWidth, height: screenHeight }]}
          accessibilityLabel={t('accessibility.whiteboardCanvas')}
          accessibilityHint={t('accessibility.whiteboardCanvasHint')}
          accessibilityRole="image"
          accessibilityActions={[
            { name: 'activate', label: t('accessibility.whiteboardZoomIn') },
            { name: 'increment', label: t('accessibility.whiteboardZoomIn') },
            { name: 'decrement', label: t('accessibility.whiteboardZoomOut') },
          ]}
          onAccessibilityAction={(event) => {
            switch (event.nativeEvent.actionName) {
              case 'activate':
              case 'increment':
                // 放大
                scale.value = withSpring(Math.min(MAX_SCALE, scale.value * 1.2));
                savedScale.value = scale.value;
                updateZoomIndicator();
                haptics.light();
                break;
              case 'decrement':
                // 缩小
                scale.value = withSpring(Math.max(MIN_SCALE, scale.value / 1.2));
                savedScale.value = scale.value;
                updateZoomIndicator();
                haptics.light();
                break;
            }
          }}
        >
          {/* 背景 */}
          <View style={{ width: screenWidth, height: screenHeight, backgroundColor: '#ffffff' }} />

          {/* 已绘制的路径 - 应用变换 */}
          <Animated.View style={[styles.pathsContainer, animatedCanvasStyle]}>
            {paths.map((el) => {
              if (el.type === 'path') {
                return renderPath(el.data, el.color, el.strokeWidth);
              }
              return null;
            })}

            {/* 当前正在绘制的路径 */}
            {currentPath && renderPath(currentPath, color, strokeWidth)}
          </Animated.View>
        </View>
      </GestureDetector>
```

- [ ] **Step 2: 为缩放指示器添加无障碍属性**

修改缩放指示器部分（约第272-276行）：

```typescript
      {/* 缩放指示器 */}
      {showZoomIndicator && (
        <View 
          style={styles.zoomIndicator}
          accessibilityRole="text"
          accessibilityLabel={`缩放 ${getZoomPercent()}%`}
        >
          <Text style={styles.zoomText}>{getZoomPercent()}%</Text>
        </View>
      )}
```

- [ ] **Step 3: 为工具栏按钮添加无障碍属性**

修改工具栏部分（约第300-343行）：

```typescript
      {/* 工具栏 */}
      {editable && showTools && (
        <View style={styles.toolbar}>
          {/* 缩放重置按钮 */}
          <TouchableOpacity
            style={styles.resetZoomButton}
            onPress={handleResetView}
            accessibilityLabel={t('accessibility.whiteboardResetView')}
            accessibilityHint="恢复画布到原始大小和位置"
            accessibilityRole="button"
          >
            <Text style={styles.resetZoomText}>{t('whiteboard.resetView')}</Text>
          </TouchableOpacity>

          {/* 颜色选择 */}
          <View 
            style={styles.colorPicker}
            accessibilityRole="tablist"
            accessibilityLabel={t('accessibility.whiteboardColorPicker')}
          >
            {COLORS.map((c, i) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorButton, { backgroundColor: c }, color === c && styles.colorButtonActive]}
                onPress={() => setColor(c)}
                accessibilityLabel={`${t('accessibility.whiteboardColor', { color: ['黑色', '红色', '蓝色', '绿色', '黄色', '紫色', '白色'][i] })}`}
                accessibilityHint={color === c ? '当前选中' : '点击选择此颜色'}
                accessibilityRole="button"
                accessibilityState={{ selected: color === c }}
              />
            ))}
          </View>

          {/* 笔触大小 */}
          <View 
            style={styles.strokePicker}
            accessibilityRole="tablist"
            accessibilityLabel={t('accessibility.whiteboardStrokePicker')}
          >
            {STROKE_WIDTHS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.strokeButton, strokeWidth === s && styles.strokeButtonActive]}
                onPress={() => setStrokeWidth(s)}
                accessibilityLabel={t('accessibility.whiteboardStroke', { width: s })}
                accessibilityHint={strokeWidth === s ? '当前选中' : '点击选择此粗细'}
                accessibilityRole="button"
                accessibilityState={{ selected: strokeWidth === s }}
              >
                <View style={[styles.strokeIndicator, { width: s, height: s }]} accessibilityRole="image" accessibilityLabel={`${s}像素`} />
              </TouchableOpacity>
            ))}
          </View>

          {/* 操作按钮 */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleUndo}
              accessibilityLabel={t('accessibility.whiteboardUndo')}
              accessibilityHint="撤销最后一步绘制"
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>{t('whiteboard.undo')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.clearButton]} 
              onPress={handleClear}
              accessibilityLabel={t('accessibility.whiteboardClear')}
              accessibilityHint="清空整个画布"
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>{t('whiteboard.clear')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
```

---

### Task 7: InteractiveWebView 无障碍支持

**Files:**
- Modify: `packages/mobile/components/playback/InteractiveWebView.tsx`

- [ ] **Step 1: 为 WebView 容器添加无障碍属性**

在组件渲染部分，为 WebView 添加无障碍属性：

```typescript
      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={source}
        style={[styles.webview, style]}
        onMessage={handleMessage}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={handleError}
        onHttpError={handleHttpError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        // 无障碍属性
        accessibilityLabel={t('accessibility.interactiveContent')}
        accessibilityHint={t('accessibility.interactiveContentHint')}
      />
```

- [ ] **Step 2: 为加载指示器添加无障碍属性**

修改加载指示器部分：

```typescript
      {/* 加载指示器 */}
      {isLoading && (
        <View 
          style={styles.loadingContainer}
          accessibilityRole="text"
          accessibilityLabel={t('accessibility.loading')}
          accessibilityHint={t('accessibility.loadingHint')}
        >
          <ActivityIndicator size="large" color={Colors.accent.primary} />
          <Text style={styles.loadingText}>{t('webview.loadingContent')}</Text>
        </View>
      )}
```

- [ ] **Step 3: 为错误状态添加无障碍属性**

修改错误状态部分：

```typescript
      {/* 错误状态 */}
      {error && (
        <View 
          style={styles.errorContainer}
          accessibilityRole="text"
          accessibilityLabel={t('accessibility.error')}
        >
          <Ionicons 
            name="alert-circle-outline" 
            size={48} 
            color={Colors.neutral.textSecondary}
            accessibilityRole="image"
            accessibilityLabel="错误图标"
          />
          <Text style={styles.errorTitle}>{t('webview.networkError')}</Text>
          <Text style={styles.errorHint}>{t('webview.noContentHint')}</Text>
          
          <View style={styles.errorActions}>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={handleRetry}
              accessibilityLabel={t('accessibility.webViewReload')}
              accessibilityHint={t('accessibility.errorHint')}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={20} color="white" accessibilityRole="image" accessibilityLabel="重试图标" />
              <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.openBrowserButton}
              onPress={handleOpenInBrowser}
              accessibilityLabel={t('accessibility.webViewOpenBrowser')}
              accessibilityHint="在系统浏览器中打开此内容"
              accessibilityRole="button"
            >
              <Ionicons name="open-outline" size={20} color={Colors.accent.primary} accessibilityRole="image" accessibilityLabel="打开图标" />
              <Text style={styles.openBrowserButtonText}>{t('webview.openInBrowser')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
```

---

### Task 8: PointerOverlay 无障碍支持

**Files:**
- Modify: `packages/mobile/components/playback/PointerOverlay.tsx`

- [ ] **Step 1: 读取文件内容**

- [ ] **Step 2: 为激光笔/聚光灯添加无障碍属性**

根据文件内容，为相关元素添加适当的 accessibilityLabel、accessibilityHint 和 accessibilityActions。

---

### Task 9: TypeScript 编译验证

- [ ] **Step 1: 运行 TypeScript 编译检查**

Run: `cd packages/mobile && npx tsc --noEmit`
Expected: 无新增错误

---

### Task 10: 提交改进

- [ ] **Step 1: 创建 commit**

```bash
git add packages/mobile/lib/i18n/index.ts \
  packages/mobile/lib/components/IOSTabBar.tsx \
  packages/mobile/components/classroom-card.tsx \
  packages/mobile/app/(tabs)/courses.tsx \
  packages/mobile/components/playback/Quiz.tsx \
  packages/mobile/components/playback/whiteboard.tsx \
  packages/mobile/components/playback/InteractiveWebView.tsx \
  packages/mobile/components/playback/PointerOverlay.tsx

git commit -m "feat(mobile): add comprehensive accessibility support

- Add accessibility i18n translations for all interactive elements
- Add accessibilityLabel, accessibilityHint, accessibilityRole to:
  - IOSTabBar navigation tabs and create button
  - ClassroomCard course cards
  - Courses page header, filters, view modes, sorting
  - Quiz component options, navigation, results
  - Whiteboard canvas with zoom/pan accessibilityActions
  - InteractiveWebView loading states and error handling
- Support VoiceOver (iOS) and TalkBack (Android)
- Add accessibilityState for selected/checked/disabled states

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 所有 TouchableOpacity/Button 有 accessibilityLabel
- [ ] 关键操作有 accessibilityHint 描述效果
- [ ] 选项类元素有正确的 accessibilityRole (radio/checkbox)
- [ ] 状态变化通过 accessibilityState 反映
- [ ] 自定义手势组件有 accessibilityActions
- [ ] 无障碍文本通过 i18n 国际化
- [ ] TypeScript 编译无错误
- [ ] VoiceOver 可正确朗读主要导航路径