# 课堂笔记快速创建功能设计

**日期：** 2026-06-02
**功能：** 在课堂学习过程中快速创建笔记，可选择将当前场景大纲加入笔记

---

## 概述

在课堂页面（classroom）的工具栏中，将原有的TTS设置按钮替换为笔记按钮。点击后弹出模态框，展示当前场景的大纲内容，用户可以选择性加入大纲到笔记中，并快速创建个人学习笔记。

---

## UI设计

### 模态框布局

```
┌─────────────────────────────────────┐
│  [关闭]  创建笔记          [保存]    │ ← 头部
├─────────────────────────────────────┤
│  当前场景：机器学习概论 - 第3章      │ ← 场景信息
├─────────────────────────────────────┤
│  📋 场景大纲                         │ ← 大纲区域标题
│  ┌─────────────────────────────────┐│
│  │ 📌 标题：神经网络基础     [+加入] ││ ← 大纲项（每项可单独加入）
│  │ 📝 描述：介绍神经网络的基本概念   ││
│  │   [+加入]                        ││
│  │ 💡 要点1：神经元模型      [+加入] ││
│  │ 💡 要点2：激活函数        [+加入] ││
│  │ 💡 要点3：反向传播        [+加入] ││
│  │ [全部加入大纲]                   ││ ← 批量加入按钮
│  └─────────────────────────────────┐│
├─────────────────────────────────────┤
│  📝 笔记内容                         │ ← 编辑区域标题
│  ┌─────────────────────────────────┐│
│  │ 标题：[输入框]                   ││ ← 标题输入（限制50字符）
│  │                                  ││
│  │ 内容：[多行输入框]               ││ ← 内容编辑（限制1000字符）
│  │       [光标位置]                 ││
│  │                                  ││
│  │ (字符计数: 0/1000)               ││ ← 字符限制提示
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  [取消]                    [创建笔记]│ ← 底部操作按钮
└─────────────────────────────────────┘
```

### 关键特性

- **大纲区域**：展示场景的 title、description、key_points，每项旁边有独立的"+加入"按钮
- **编辑区域**：标题输入框（限制50字符）+ 内容输入框（限制1000字符）
- **光标位置**：点击"加入"按钮时，内容插入到当前光标位置
- **Markdown格式**：插入的内容自动格式化为 Markdown（标题用 `##`，要点用 `-`）

---

## 数据流设计

```
classroom/[id].tsx
    ↓
[currentScene 状态] ← 包含场景数据
    ↓
点击工具栏"笔记"按钮
    ↓
setShowNoteModal(true) ← 打开模态框
    ↓
模态框读取 currentScene 数据：
    - title: "神经网络基础"
    - description: "介绍神经网络的基本概念"
    - key_points: ["神经元模型", "激活函数", "反向传播"]
    ↓
用户编辑笔记内容
    - 输入标题
    - 输入内容（追踪光标位置）
    ↓
用户点击"+加入"按钮
    ↓
生成 Markdown 内容：
    - 标题：## ${scene.title}
    - 描述：${scene.description}
    - 要点：- ${point}
    ↓
插入到 TextInput 的光标位置
    ↓
用户点击"创建笔记"按钮
    ↓
调用 API：apiClient.createPersonalNote({
    title: 用户输入的标题,
    content: 用户输入的内容（包含插入的大纲）,
    course_id: courseId,
    category: "学习笔记",
    color: "coral"
})
    ↓
成功：显示提示 + 关闭模态框
失败：显示错误提示
```

---

## 技术实现

### 状态管理

```typescript
// 模态框状态
const [showNoteModal, setShowNoteModal] = useState(false);

// 笔记编辑状态
const [noteTitle, setNoteTitle] = useState('');
const [noteContent, setNoteContent] = useState('');
const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });

// 保存状态
const [saving, setSaving] = useState(false);

// 大纲展开状态（可选功能）
const [expandedOutline, setExpandedOutline] = useState(true);
```

### 光标位置管理

使用 `TextInput` 的 `selection` 属性追踪光标位置：

```typescript
const insertContent = (markdown: string) => {
  const before = content.substring(0, cursorPosition.start);
  const after = content.substring(cursorPosition.end);
  const newContent = before + markdown + after;
  setContent(newContent);
  // 更新光标位置到插入内容之后
  setCursorPosition({
    start: cursorPosition.start + markdown.length,
    end: cursorPosition.start + markdown.length
  });
};
```

### Markdown 生成逻辑

- 标题项：`## ${scene.title}\n\n`
- 描述项：`${scene.description}\n\n`
- 要点项：`- ${point}\n`

### API调用

使用现有的 `apiClient.createPersonalNote()` 方法：

```typescript
const handleCreateNote = async () => {
  // 验证
  if (!noteTitle.trim()) {
    Alert.alert('提示', '请输入笔记标题');
    return;
  }
  if (!noteContent.trim()) {
    Alert.alert('提示', '请输入笔记内容');
    return;
  }

  setSaving(true);
  try {
    await apiClient.createPersonalNote({
      title: noteTitle.trim(),
      content: noteContent.trim(),
      course_id: id, // 当前课程ID
      category: '学习笔记',
      color: 'coral', // 默认颜色
      starred: false,
    });

    // 成功提示
    Alert.alert('成功', '笔记已创建');
    setShowNoteModal(false);

    // 清空状态
    setNoteTitle('');
    setNoteContent('');

    // 触觉反馈
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    Alert.alert('失败', '笔记创建失败');
  } finally {
    setSaving(false);
  }
};
```

### API Client 扩展

需要在 `api-client/index.ts` 中添加方法：

```typescript
createPersonalNote: async (data: {
  title: string;
  content: string;
  course_id?: string;
  category?: string;
  color?: string;
  starred?: boolean;
}) => {
  return await post('/personal-notes/', data);
}
```

---

## 错误处理

### 网络错误
- 显示友好提示："网络连接失败，请稍后重试"
- 保持模态框打开，用户可以再次尝试

### 验证错误
- 标题为空：Alert 提示 + 禁用创建按钮
- 内容为空：Alert 提示 + 禁用创建按钮
- 标题超过50字符：显示字符计数警告
- 内容超过1000字符：显示字符计数警告 + 禁用创建按钮

### 未登录错误
- 检测到401响应：提示"请先登录" + 跳转到登录页
- 关闭模态框

---

## 边界情况处理

### 场景无大纲数据
- `description` 为空：显示提示"当前场景暂无描述"
- `key_points` 为空数组：显示提示"当前场景暂无要点"
- 大纲区域仍然展示，但按钮禁用

### 多次点击加入按钮
- 允许重复加入同一内容（用户可能需要）
- 每次点击独立插入到当前光标位置

### 光标位置丢失
- 用户点击其他区域导致光标丢失
- 默认插入到内容末尾
- 提示用户："内容已追加到末尾"

### 模态框滚动冲突
- 大纲区域：可独立滚动
- 编辑区域：可独立滚动
- 防止与课堂页面的滚动冲突

### 键盘弹出遮挡
- 使用 `KeyboardAvoidingView` 自动调整布局
- iOS: behavior="padding"
- Android: behavior="height"

---

## 样式和响应式设计

### 颜色系统

使用现有的 iOS 风格颜色系统：

```typescript
const iOSColors = {
  bgSolid: '#f5f3f2',
  surface: 'rgba(255, 255, 255, 0.55)',
  surfaceSolid: '#FFFFFF',
  fg: '#1a1a1a',
  muted: '#666666',
  border: 'rgba(230, 225, 220, 0.6)',
  accent: '#c45a1a',
  accentLight: '#fde8e0',
  secondary: '#1a8a8a',
  secondaryLight: '#e8f5f5',
  gold: '#f59e0b',
  goldLight: '#fef3c7',
};
```

### 响应式设计

适配不同设备尺寸：

```typescript
const { isTablet, breakpoint } = useResponsiveDimensions();

// 模态框宽度
const modalWidth = isTablet ? '80%' : '95%';
const maxWidth = isTablet ? 600 : 400;

// 字体大小
const titleSize = isTablet ? 18 : 16;
const contentSize = isTablet ? 16 : 14;

// 大纲项间距
const outlineGap = isTablet ? 12 : 8;
```

---

## 测试计划

### 功能测试

1. **基础功能**
   - 点击笔记按钮，模态框正常打开
   - 大纲内容正确显示（标题、描述、要点）
   - 输入标题和内容，字符限制生效
   - 光标位置正确追踪

2. **加入大纲功能**
   - 点击单个大纲项的"+加入"按钮，内容插入到光标位置
   - 点击"全部加入"按钮，所有大纲内容插入
   - Markdown格式正确生成（标题 `##`，要点 `-`）
   - 多次点击加入，内容正确追加

3. **保存功能**
   - 点击"创建笔记"，API调用成功
   - 笔记保存到个人笔记列表
   - 模态框关闭，状态清空
   - 触觉反馈触发

4. **错误场景**
   - 网络失败时显示错误提示
   - 未登录时跳转到登录页
   - 验证失败时禁用创建按钮

### 边界测试

1. **空数据处理**
   - 场景无 description：显示提示
   - 场景无 key_points：显示提示
   - 大纲按钮禁用状态

2. **字符限制**
   - 标题达到50字符：显示警告
   - 内容达到1000字符：禁用创建按钮
   - 字符计数实时更新

3. **键盘交互**
   - 键盘弹出时布局调整
   - 键盘收起时恢复正常
   - 光标位置不丢失

### 响应式测试

1. **不同设备**
   - iPhone：模态框宽度95%，字体14px
   - iPad：模态框宽度80%，字体16px
   - 横屏模式：布局正确调整

2. **不同场景类型**
   - Slide场景：正常显示大纲
   - Quiz场景：显示题目作为大纲
   - Interactive场景：显示讨论主题
   - PBL场景：显示项目步骤

### 集成测试

1. **与现有系统集成**
   - 创建的笔记出现在笔记列表页
   - 笔记详情页可以查看和编辑
   - 笔记关联到当前课程（course_id）

2. **与课堂流程集成**
   - 创建笔记不影响课堂播放
   - 模态框关闭后返回课堂
   - 可以在任意场景创建笔记

---

## 实现步骤

1. **修改工具栏按钮** - 将TTS设置按钮替换为笔记按钮
2. **创建模态框组件** - NoteCreationModal 组件
3. **实现大纲展示** - 显示场景大纲内容
4. **实现加入功能** - 光标位置插入 Markdown 内容
5. **实现API集成** - 调用创建笔记 API
6. **添加错误处理** - 验证和网络错误处理
7. **添加样式和动画** - iOS风格样式和响应式设计
8. **测试和验证** - 功能、边界、响应式测试

---

## 文件修改清单

### 新建文件
- `packages/mobile/lib/components/NoteCreationModal.tsx` - 笔记创建模态框组件

### 修改文件
- `packages/mobile/app/classroom/[id].tsx` - 添加笔记按钮和模态框调用
- `packages/mobile/lib/api-client/index.ts` - 添加 createPersonalNote 方法

---

## 备注

- 保持与现有笔记创建页面（`/notes/new`）的风格一致
- 使用相同的字符限制（标题50，内容1000）
- 遵循 iOS 风格设计系统
- 支持触觉反馈提升用户体验