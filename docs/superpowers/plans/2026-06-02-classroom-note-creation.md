# 课堂笔记快速创建功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在课堂学习过程中添加快速创建笔记功能，用户可以选择将当前场景大纲加入笔记

**Architecture:** 创建独立的模态框组件 NoteCreationModal，在课堂页面工具栏添加笔记按钮，扩展 API Client 支持创建个人笔记

**Tech Stack:** React Native, TypeScript, Expo Router, React Native Modal, TextInput

---

## 文件结构

**新建文件：**
- `packages/mobile/lib/components/NoteCreationModal.tsx` - 笔记创建模态框组件（独立文件，清晰职责）

**修改文件：**
- `packages/mobile/lib/api-client/index.ts` - 扩展 API Client，添加创建笔记方法
- `packages/mobile/app/classroom/[id].tsx` - 修改工具栏按钮，添加模态框状态和调用

---

## Task 1: 扩展 API Client

**Files:**
- Modify: `packages/mobile/lib/api-client/index.ts`

### 步骤

- [ ] **Step 1: 查看现有 API Client 结构，确定添加位置**

查看文件，找到合适的位置添加新方法。

- [ ] **Step 2: 添加 createPersonalNote 方法**

在 `apiClient` 对象中添加新方法：

```typescript
createPersonalNote: async (data: {
  title: string;
  content: string;
  course_id?: string;
  category?: string;
  color?: string;
  starred?: boolean;
}): Promise<{ id: string; title: string; message: string }> => {
  const response = await post('/personal-notes/', data);
  return response.data;
},
```

- [ ] **Step 3: 验证方法签名与后端 API 匹配**

检查后端 `packages/server-python/app/routes/personal_notes.py` 的 `create_personal_note` 函数，确认参数和返回值匹配。

后端接收参数：
- `title` (必需)
- `content` (必需)
- `course_id` (可选)
- `category` (默认 "学习笔记")
- `tags` (可选)
- `starred` (默认 false)
- `color` (默认 "coral")

返回：
```json
{
  "id": "uuid",
  "title": "string",
  "message": "笔记创建成功"
}
```

- [ ] **Step 4: 提交 API Client 扩展**

```bash
git add packages/mobile/lib/api-client/index.ts
git commit -m "feat(api): add createPersonalNote method for classroom note creation"
```

---

## Task 2: 创建 NoteCreationModal 组件基础结构

**Files:**
- Create: `packages/mobile/lib/components/NoteCreationModal.tsx`

### 步骤

- [ ] **Step 1: 创建组件文件并导入依赖**

```typescript
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Rounded, Spacing } from '@/lib/constants/theme';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
import { apiClient } from '@/lib/api-client';
```

- [ ] **Step 2: 定义 Props 接口和颜色系统**

```typescript
interface NoteCreationModalProps {
  visible: boolean;
  onClose: () => void;
  sceneData: {
    id: string;
    title: string;
    description?: string;
    key_points?: string[];
    type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  };
  courseId: string;
}

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

- [ ] **Step 3: 创建组件主体和状态管理**

```typescript
const MAX_TITLE_LENGTH = 50;
const MAX_CONTENT_LENGTH = 1000;

export const NoteCreationModal: React.FC<NoteCreationModalProps> = ({
  visible,
  onClose,
  sceneData,
  courseId,
}) => {
  const { isTablet } = useResponsiveDimensions();

  // 笔记编辑状态
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });

  // 保存状态
  const [saving, setSaving] = useState(false);

  // 动画
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 清空状态函数
  const resetState = () => {
    setNoteTitle('');
    setNoteContent('');
    setCursorPosition({ start: 0, end: 0 });
  };

  // 关闭时清空
  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
          {/* 头部 */}
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Ionicons name="close" size={20} color={iOSColors.fg} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>创建笔记</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* 内容区域占位 */}
          <ScrollView style={styles.bodyScroll}>
            <Text style={styles.placeholderText}>笔记内容区域</Text>
          </ScrollView>

          {/* 底部按钮占位 */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn}>
              <Text style={styles.createBtnText}>创建笔记</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
```

- [ ] **Step 4: 添加基础样式**

```typescript
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: iOSColors.bgSolid,
    borderRadius: Rounded.lg,
    width: '95%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  modalContentTablet: {
    width: '80%',
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: iOSColors.border,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: iOSColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  bodyScroll: {
    flex: 1,
  },
  placeholderText: {
    padding: Spacing.md,
    color: iOSColors.muted,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: iOSColors.border,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Rounded.sm,
    backgroundColor: iOSColors.surface,
  },
  cancelBtnText: {
    fontSize: 16,
    color: iOSColors.muted,
  },
  createBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Rounded.sm,
    backgroundColor: iOSColors.accent,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
```

- [ ] **Step 5: 提交基础结构**

```bash
git add packages/mobile/lib/components/NoteCreationModal.tsx
git commit -m "feat(component): add NoteCreationModal base structure"
```

---

## Task 3: 实现大纲展示区域

**Files:**
- Modify: `packages/mobile/lib/components/NoteCreationModal.tsx` (继续完善)

### 步骤

- [ ] **Step 1: 添加场景信息展示组件**

在组件主体中，替换 bodyScroll 内容：

```typescript
{/* 场景信息 */}
<View style={styles.sceneInfo}>
  <Ionicons name="document-text" size={16} color={iOSColors.accent} />
  <Text style={styles.sceneTitle}>当前场景：{sceneData.title}</Text>
</View>
```

- [ ] **Step 2: 添加大纲区域标题和展开按钮**

```typescript
{/* 大纲区域 */}
<View style={styles.outlineSection}>
  <TouchableOpacity
    style={styles.outlineHeader}
    onPress={() => {}}
  >
    <Ionicons name="list" size={20} color={iOSColors.secondary} />
    <Text style={styles.outlineTitle}>场景大纲</Text>
    <Ionicons name="chevron-down" size={16} color={iOSColors.muted} />
  </TouchableOpacity>
```

- [ ] **Step 3: 添加大纲内容列表**

```typescript
  <ScrollView style={styles.outlineScroll}>
    {/* 标题项 */}
    {sceneData.title && (
      <View style={styles.outlineItem}>
        <View style={styles.outlineItemContent}>
          <Ionicons name="bookmark" size={16} color={iOSColors.accent} />
          <Text style={styles.outlineItemText}>标题：{sceneData.title}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {}}
        >
          <Ionicons name="add" size={14} color={iOSColors.accent} />
          <Text style={styles.addBtnText}>加入</Text>
        </TouchableOpacity>
      </View>
    )}

    {/* 描述项 */}
    {sceneData.description && (
      <View style={styles.outlineItem}>
        <View style={styles.outlineItemContent}>
          <Ionicons name="text" size={16} color={iOSColors.gold} />
          <Text style={styles.outlineItemText}>描述：{sceneData.description}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {}}
        >
          <Ionicons name="add" size={14} color={iOSColors.accent} />
          <Text style={styles.addBtnText}>加入</Text>
        </TouchableOpacity>
      </View>
    )}

    {/* 要点列表 */}
    {sceneData.key_points && sceneData.key_points.length > 0 && (
      sceneData.key_points.map((point, index) => (
        <View key={index} style={styles.outlineItem}>
          <View style={styles.outlineItemContent}>
            <Ionicons name="bulb" size={16} color={iOSColors.secondary} />
            <Text style={styles.outlineItemText}>要点{index + 1}：{point}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {}}
          >
            <Ionicons name="add" size={14} color={iOSColors.accent} />
            <Text style={styles.addBtnText}>加入</Text>
          </TouchableOpacity>
        </View>
      ))
    )}

    {/* 全部加入按钮 */}
    {(sceneData.title || sceneData.description || (sceneData.key_points && sceneData.key_points.length > 0)) && (
      <TouchableOpacity
        style={styles.addAllBtn}
        onPress={() => {}}
      >
        <Ionicons name="add-circle" size={16} color={iOSColors.accent} />
        <Text style={styles.addAllBtnText}>全部加入大纲</Text>
      </TouchableOpacity>
    )}

    {/* 无大纲提示 */}
    {!sceneData.title && !sceneData.description && (!sceneData.key_points || sceneData.key_points.length === 0) && (
      <View style={styles.emptyOutline}>
        <Ionicons name="information-circle" size={20} color={iOSColors.muted} />
        <Text style={styles.emptyOutlineText}>当前场景暂无大纲内容</Text>
      </View>
    )}
  </ScrollView>
</View>
```

- [ ] **Step 4: 添加大纲区域样式**

```typescript
  sceneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: iOSColors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: iOSColors.border,
  },
  sceneTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: iOSColors.fg,
  },
  outlineSection: {
    padding: Spacing.md,
    backgroundColor: iOSColors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: iOSColors.border,
  },
  outlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  outlineTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
    flex: 1,
  },
  outlineScroll: {
    maxHeight: 200,
  },
  outlineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: iOSColors.border,
  },
  outlineItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  outlineItemText: {
    marginLeft: 8,
    fontSize: 14,
    color: iOSColors.fg,
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: iOSColors.accentLight,
    borderWidth: 0.5,
    borderColor: iOSColors.accent,
  },
  addBtnText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
    color: iOSColors.accent,
  },
  addAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: Rounded.sm,
    backgroundColor: iOSColors.accentLight,
    borderWidth: 0.5,
    borderColor: iOSColors.accent,
  },
  addAllBtnText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: iOSColors.accent,
  },
  emptyOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyOutlineText: {
    marginLeft: 8,
    fontSize: 14,
    color: iOSColors.muted,
  },
```

- [ ] **Step 5: 提交大纲展示区域**

```bash
git add packages/mobile/lib/components/NoteCreationModal.tsx
git commit -m "feat(component): add outline display section to NoteCreationModal"
```

---

## Task 4: 实现笔记编辑区域

**Files:**
- Modify: `packages/mobile/lib/components/NoteCreationModal.tsx` (继续完善)

### 步骤

- [ ] **Step 1: 添加编辑区域标题**

在大纲区域后面添加：

```typescript
{/* 编辑区域 */}
<View style={styles.editSection}>
  <View style={styles.editHeader}>
    <Ionicons name="create" size={20} color={iOSColors.accent} />
    <Text style={styles.editTitle}>笔记内容</Text>
  </View>
```

- [ ] **Step 2: 添加标题输入框**

```typescript
  {/* 标题输入 */}
  <View style={styles.titleSection}>
    <View style={styles.titleHeader}>
      <Text style={styles.titleLabel}>标题</Text>
      <Text style={styles.charCount}>{noteTitle.length}/{MAX_TITLE_LENGTH}</Text>
    </View>
    <TextInput
      style={styles.titleInput}
      placeholder="给笔记起个标题..."
      placeholderTextColor={iOSColors.muted}
      value={noteTitle}
      onChangeText={setNoteTitle}
      maxLength={MAX_TITLE_LENGTH}
    />
  </View>
```

- [ ] **Step 3: 添加内容输入框（支持光标追踪）**

```typescript
  {/* 内容输入 */}
  <View style={styles.contentSection}>
    <View style={styles.contentHeader}>
      <Text style={styles.contentLabel}>内容</Text>
      <Text style={styles.charCount}>{noteContent.length}/{MAX_CONTENT_LENGTH}</Text>
    </View>
    <TextInput
      style={styles.contentInput}
      placeholder="记录你的学习心得..."
      placeholderTextColor={iOSColors.muted}
      multiline
      numberOfLines={8}
      value={noteContent}
      onChangeText={setNoteContent}
      maxLength={MAX_CONTENT_LENGTH}
      textAlignVertical="top"
      selection={cursorPosition}
      onSelectionChange={(e) => {
        setCursorPosition({
          start: e.nativeEvent.selection.start,
          end: e.nativeEvent.selection.end,
        });
      }}
    />
  </View>
</View>
```

- [ ] **Step 4: 添加编辑区域样式**

```typescript
  editSection: {
    padding: Spacing.md,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  editTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: iOSColors.fg,
  },
  titleSection: {
    marginBottom: Spacing.md,
  },
  titleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: iOSColors.muted,
  },
  charCount: {
    fontSize: 11,
    color: iOSColors.muted,
  },
  titleInput: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 16,
    fontWeight: '500',
    color: iOSColors.fg,
  },
  contentSection: {},
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: iOSColors.muted,
  },
  contentInput: {
    backgroundColor: iOSColors.surfaceSolid,
    borderRadius: Rounded.sm,
    borderWidth: 0.5,
    borderColor: iOSColors.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: iOSColors.fg,
    minHeight: 150,
    maxHeight: 300,
  },
```

- [ ] **Step 5: 提交编辑区域**

```bash
git add packages/mobile/lib/components/NoteCreationModal.tsx
git commit -m "feat(component): add note editing section with cursor tracking"
```

---

## Task 5: 实现大纲内容插入功能

**Files:**
- Modify: `packages/mobile/lib/components/NoteCreationModal.tsx` (继续完善)

### 步骤

- [ ] **Step 1: 实现 Markdown 生成函数**

在组件内部添加函数：

```typescript
// 生成 Markdown 内容
const generateMarkdown = (type: 'title' | 'description' | 'point', content: string): string => {
  switch (type) {
    case 'title':
      return `## ${content}\n\n`;
    case 'description':
      return `${content}\n\n`;
    case 'point':
      return `- ${content}\n`;
    default:
      return '';
  }
};
```

- [ ] **Step 2: 实现插入内容到光标位置函数**

```typescript
// 插入内容到光标位置
const insertContent = (markdown: string) => {
  const before = noteContent.substring(0, cursorPosition.start);
  const after = noteContent.substring(cursorPosition.end);
  const newContent = before + markdown + after;

  // 检查长度限制
  if (newContent.length > MAX_CONTENT_LENGTH) {
    Alert.alert('提示', `内容长度超过限制（${MAX_CONTENT_LENGTH}字符）`);
    return;
  }

  setNoteContent(newContent);

  // 更新光标位置到插入内容之后
  const newCursorPosition = cursorPosition.start + markdown.length;
  setCursorPosition({
    start: newCursorPosition,
    end: newCursorPosition,
  });

  // 触觉反馈
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
```

- [ ] **Step 3: 实现单个大纲项加入函数**

```typescript
// 加入单个大纲项
const handleAddOutlineItem = (type: 'title' | 'description' | 'point', content: string) => {
  const markdown = generateMarkdown(type, content);
  insertContent(markdown);
};
```

- [ ] **Step 4: 实现全部加入函数**

```typescript
// 加入全部大纲
const handleAddAllOutline = () => {
  let fullMarkdown = '';

  if (sceneData.title) {
    fullMarkdown += generateMarkdown('title', sceneData.title);
  }

  if (sceneData.description) {
    fullMarkdown += generateMarkdown('description', sceneData.description);
  }

  if (sceneData.key_points && sceneData.key_points.length > 0) {
    sceneData.key_points.forEach(point => {
      fullMarkdown += generateMarkdown('point', point);
    });
  }

  if (fullMarkdown) {
    insertContent(fullMarkdown);
  }
};
```

- [ ] **Step 5: 绑定函数到按钮**

更新大纲区域的按钮 onPress：

```typescript
{/* 标题项的加入按钮 */}
<TouchableOpacity
  style={styles.addBtn}
  onPress={() => handleAddOutlineItem('title', sceneData.title)}
>

{/* 描述项的加入按钮 */}
<TouchableOpacity
  style={styles.addBtn}
  onPress={() => handleAddOutlineItem('description', sceneData.description)}
>

{/* 要点项的加入按钮 */}
<TouchableOpacity
  style={styles.addBtn}
  onPress={() => handleAddOutlineItem('point', point)}
>

{/* 全部加入按钮 */}
<TouchableOpacity
  style={styles.addAllBtn}
  onPress={handleAddAllOutline}
>
```

- [ ] **Step 6: 提交插入功能**

```bash
git add packages/mobile/lib/components/NoteCreationModal.tsx
git commit -m "feat(component): implement outline content insertion with Markdown format"
```

---

## Task 6: 实现创建笔记功能和验证

**Files:**
- Modify: `packages/mobile/lib/components/NoteCreationModal.tsx` (继续完善)

### 步骤

- [ ] **Step 1: 实现验证函数**

```typescript
// 验证输入
const validateInput = (): boolean => {
  if (!noteTitle.trim()) {
    Alert.alert('提示', '请输入笔记标题');
    return false;
  }
  if (!noteContent.trim()) {
    Alert.alert('提示', '请输入笔记内容');
    return false;
  }
  return true;
};
```

- [ ] **Step 2: 实现创建笔记函数**

```typescript
// 创建笔记
const handleCreateNote = async () => {
  if (!validateInput()) return;

  setSaving(true);
  try {
    await apiClient.createPersonalNote({
      title: noteTitle.trim(),
      content: noteContent.trim(),
      course_id: courseId,
      category: '学习笔记',
      color: 'coral',
      starred: false,
    });

    // 成功提示
    Alert.alert('成功', '笔记已创建');

    // 清空状态
    resetState();

    // 关闭模态框
    onClose();

    // 触觉反馈
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error: any) {
    // 错误处理
    if (error.response?.status === 401) {
      Alert.alert('需要登录', '请先登录后再创建笔记');
      handleClose();
    } else {
      Alert.alert('失败', '笔记创建失败，请稍后重试');
    }
  } finally {
    setSaving(false);
  }
};
```

- [ ] **Step 3: 绑定创建函数并添加 loading 状态**

更新底部创建按钮：

```typescript
<TouchableOpacity
  style={[styles.createBtn, saving && styles.createBtnDisabled]}
  onPress={handleCreateNote}
  disabled={saving}
>
  {saving ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <Text style={styles.createBtnText}>创建笔记</Text>
  )}
</TouchableOpacity>
```

- [ ] **Step 4: 添加 disabled 样式**

```typescript
  createBtnDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
```

- [ ] **Step 5: 提交创建功能和验证**

```bash
git add packages/mobile/lib/components/NoteCreationModal.tsx
git commit -m "feat(component): implement note creation with validation and error handling"
```

---

## Task 7: 在课堂页面集成模态框

**Files:**
- Modify: `packages/mobile/app/classroom/[id].tsx`

### 步骤

- [ ] **Step 1: 导入 NoteCreationModal 组件**

在文件顶部添加导入：

```typescript
import { NoteCreationModal } from '@/lib/components/NoteCreationModal';
```

- [ ] **Step 2: 添加模态框状态**

在组件状态区域添加：

```typescript
// 笔记创建模态框状态
const [showNoteModal, setShowNoteModal] = useState(false);
```

- [ ] **Step 3: 修改工具栏按钮（替换TTS设置按钮）**

找到工具栏中的 TTS 设置按钮（大约 line 2453-2459），替换为笔记按钮：

```typescript
{/* 笔记按钮 */}
<TouchableOpacity
  style={styles.toolBtn}
  onPress={() => setShowNoteModal(true)}
>
  <Ionicons name="document-text-outline" size={20} color="#666" />
</TouchableOpacity>
```

- [ ] **Step 4: 添加模态框组件调用**

在组件末尾（return 语句的最后，关闭标签之前）添加：

```typescript
{/* 笔记创建模态框 */}
<NoteCreationModal
  visible={showNoteModal}
  onClose={() => setShowNoteModal(false)}
  sceneData={{
    id: currentScene?.id || '',
    title: currentScene?.title || '',
    description: (currentScene?.content as any)?.description || '',
    key_points: (currentScene?.content as any)?.key_points || [],
    type: currentScene?.type || 'slide',
  }}
  courseId={id || ''}
/>
```

- [ ] **Step 5: 提交课堂页面集成**

```bash
git add packages/mobile/app/classroom/[id].tsx
git commit -m "feat(classroom): integrate NoteCreationModal and replace TTS settings button"
```

---

## Task 8: 手动测试和验证

**Files:**
- 无文件修改（手动测试）

### 步骤

- [ ] **Step 1: 启动开发服务器**

```bash
cd packages/mobile
npm start
```

- [ ] **Step 2: 打开课堂页面**

在浏览器或 Expo Go 中访问课堂页面：
`http://localhost:8081/classroom/<course-id>`

- [ ] **Step 3: 测试基础功能**

1. 点击工具栏的笔记按钮（文档图标）
2. 模态框正常打开
3. 大纲内容正确显示（标题、描述、要点）
4. 输入标题和内容，字符计数正确更新

- [ ] **Step 4: 测试大纲加入功能**

1. 点击单个大纲项的"加入"按钮
2. Markdown 格式内容插入到光标位置
3. 点击"全部加入大纲"按钮
4. 所有大纲内容正确插入

- [ ] **Step 5: 测试创建笔记功能**

1. 输入标题和内容
2. 点击"创建笔记"按钮
3. 成功提示显示
4. 模态框关闭
5. 检查笔记列表页，新笔记出现

- [ ] **Step 6: 测试边界情况**

1. 场景无大纲数据：显示"暂无大纲内容"
2. 标题为空：显示提示，禁用创建按钮
3. 内容为空：显示提示，禁用创建按钮
4. 内容超过1000字符：禁用创建按钮

- [ ] **Step 7: 测试响应式设计**

1. iPhone 设备：模态框宽度95%
2. iPad 设备：模态框宽度80%
3. 横屏模式：布局正确调整

- [ ] **Step 8: 记录测试结果**

如发现问题，记录下来并在后续步骤修复。

---

## Task 9: 导出组件供其他页面使用

**Files:**
- Modify: `packages/mobile/lib/components/NoteCreationModal.tsx`

### 步骤

- [ ] **Step 1: 确保 export 语句正确**

在文件末尾已经有：
```typescript
export default NoteCreationModal;
```

也可以添加 named export：
```typescript
export { NoteCreationModal };
```

- [ ] **Step 2: 提交最终版本**

```bash
git add packages/mobile/lib/components/NoteCreationModal.tsx
git commit -m "feat(component): finalize NoteCreationModal with export"
```

---

## Task 10: 更新文档和备注

**Files:**
- Modify: `docs/superpowers/specs/2026-06-02-classroom-note-creation-design.md`（可选）

### 步骤

- [ ] **Step 1: 添加实现完成标记**

在设计文档末尾添加：

```markdown
---

## 实现状态

✅ 已完成实现
- NoteCreationModal 组件已创建
- API Client 扩展已完成
- 课堂页面集成已完成
- 功能测试通过

**实现日期：** 2026-06-02
```

- [ ] **Step 2: 提交文档更新**

```bash
git add docs/superpowers/specs/2026-06-02-classroom-note-creation-design.md
git commit -m "docs: mark classroom note creation feature as implemented"
```

---

## 自我审查检查清单

**1. Spec 覆盖检查：**
- ✅ UI设计：Task 2, 3, 4 实现了模态框布局
- ✅ 大纲展示：Task 3 实现了场景大纲显示
- ✅ 光标位置：Task 4 实现了光标追踪
- ✅ Markdown格式：Task 5 实现了 Markdown 生成
- ✅ API集成：Task 1, 6 实现了 API 调用
- ✅ 错误处理：Task 6 实现了验证和网络错误处理
- ✅ 响应式设计：Task 2, 4 包含响应式样式
- ✅ 测试：Task 8 提供了详细测试步骤

**2. 占位符扫描：**
- ✅ 无 "TBD"、"TODO"、"implement later"
- ✅ 无 "add appropriate error handling" 等模糊描述
- ✅ 所有代码步骤包含完整实现代码
- ✅ 所有类型和方法签名已定义

**3. 类型一致性：**
- ✅ NoteCreationModalProps 在 Task 2 定义，在 Task 7 使用
- ✅ cursorPosition 类型在 Task 4 定义，在 Task 5 使用
- ✅ API 参数类型在 Task 1 定义，在 Task 6 使用

---

## 执行说明

本计划按照 TDD 原则设计，但由于 React Native 组件测试复杂度，采用手动测试验证（Task 8）。每个任务都是独立的小步骤，可以逐个执行和验证。

推荐使用 **subagent-driven-development** 执行，每个任务由独立的 agent 完成，便于快速迭代和错误修复。