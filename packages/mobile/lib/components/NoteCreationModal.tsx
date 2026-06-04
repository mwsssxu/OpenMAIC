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
import { Rounded, Spacing, Colors } from '@/lib/constants/theme';
import { useResponsiveDimensions } from '@/lib/utils/responsive';
import { apiClient } from '@/lib/api-client';

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

const MAX_TITLE_LENGTH = 50;
const MAX_CONTENT_LENGTH = 1000;

export const NoteCreationModal: React.FC<NoteCreationModalProps> = ({
  visible,
  onClose,
  sceneData,
  courseId,
}) => {
  const { isTablet } = useResponsiveDimensions();

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState({ start: 0, end: 0 });
  const [saving, setSaving] = useState(false);
  const [outlineExpanded, setOutlineExpanded] = useState(true);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const resetState = () => {
    setNoteTitle('');
    setNoteContent('');
    setCursorPosition({ start: 0, end: 0 });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ──── Markdown 生成 ────

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

  // ──── 插入内容到光标位置 ────

  const insertContent = (markdown: string) => {
    const before = noteContent.substring(0, cursorPosition.start);
    const after = noteContent.substring(cursorPosition.end);
    const newContent = before + markdown + after;

    if (newContent.length > MAX_CONTENT_LENGTH) {
      Alert.alert('提示', `内容长度超过限制（${MAX_CONTENT_LENGTH}字符）`);
      return;
    }

    setNoteContent(newContent);
    const newPos = cursorPosition.start + markdown.length;
    setCursorPosition({ start: newPos, end: newPos });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddOutlineItem = (type: 'title' | 'description' | 'point', content: string) => {
    const markdown = generateMarkdown(type, content);
    insertContent(markdown);
  };

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

  // ──── 验证与创建 ────

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

      Alert.alert('成功', '笔记已创建');
      resetState();
      onClose();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
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

  // ──── 大纲是否有内容 ────

  const hasOutline = !!sceneData.title || !!sceneData.description || (sceneData.key_points && sceneData.key_points.length > 0);

  // ──── 场景类型标签 ────

  const sceneTypeLabel: Record<string, string> = {
    slide: '幻灯片',
    quiz: '测验',
    interactive: '互动',
    pbl: '项目',
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
              <Ionicons name="close" size={20} color={Colors.neutral.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>创建笔记</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* 场景信息 */}
          <View style={styles.sceneInfo}>
            <Ionicons name="document-text" size={16} color={Colors.primary.main} />
            <Text style={styles.sceneTitle} numberOfLines={1}>
              当前场景：{sceneData.title || '无标题'}
            </Text>
            <View style={styles.sceneTypeTag}>
              <Text style={styles.sceneTypeTagText}>
                {sceneTypeLabel[sceneData.type] || sceneData.type}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled">
            {/* 大纲区域 */}
            {hasOutline && (
              <View style={styles.outlineSection}>
                <TouchableOpacity
                  style={styles.outlineHeader}
                  onPress={() => setOutlineExpanded(!outlineExpanded)}
                >
                  <Ionicons name="list" size={20} color={Colors.secondary.info} />
                  <Text style={styles.outlineTitle}>场景大纲</Text>
                  <Ionicons
                    name={outlineExpanded ? 'chevron-down' : 'chevron-up'}
                    size={16}
                    color={Colors.neutral.textMuted}
                  />
                </TouchableOpacity>

                {outlineExpanded && (
                  <ScrollView style={styles.outlineScroll}>
                    {sceneData.title && (
                      <View style={styles.outlineItem}>
                        <View style={styles.outlineItemContent}>
                          <Ionicons name="bookmark" size={16} color={Colors.primary.main} />
                          <Text style={styles.outlineItemText} numberOfLines={2}>
                            标题：{sceneData.title}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => handleAddOutlineItem('title', sceneData.title)}
                        >
                          <Ionicons name="add" size={14} color={Colors.primary.main} />
                          <Text style={styles.addBtnText}>加入</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {sceneData.description && (
                      <View style={styles.outlineItem}>
                        <View style={styles.outlineItemContent}>
                          <Ionicons name="text" size={16} color={Colors.accent.main} />
                          <Text style={styles.outlineItemText} numberOfLines={2}>
                            描述：{sceneData.description}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.addBtn}
                          onPress={() => handleAddOutlineItem('description', sceneData.description!)}
                        >
                          <Ionicons name="add" size={14} color={Colors.primary.main} />
                          <Text style={styles.addBtnText}>加入</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {sceneData.key_points && sceneData.key_points.length > 0 && (
                      sceneData.key_points.map((point, index) => (
                        <View key={index} style={styles.outlineItem}>
                          <View style={styles.outlineItemContent}>
                            <Ionicons name="bulb" size={16} color={Colors.secondary.info} />
                            <Text style={styles.outlineItemText} numberOfLines={2}>
                              要点{index + 1}：{point}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() => handleAddOutlineItem('point', point)}
                          >
                            <Ionicons name="add" size={14} color={Colors.primary.main} />
                            <Text style={styles.addBtnText}>加入</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}

                    <TouchableOpacity
                      style={styles.addAllBtn}
                      onPress={handleAddAllOutline}
                    >
                      <Ionicons name="add-circle" size={16} color={Colors.primary.main} />
                      <Text style={styles.addAllBtnText}>全部加入大纲</Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            )}

            {!hasOutline && (
              <View style={styles.emptyOutline}>
                <Ionicons name="information-circle" size={20} color={Colors.neutral.textMuted} />
                <Text style={styles.emptyOutlineText}>当前场景暂无大纲内容</Text>
              </View>
            )}

            {/* 编辑区域 */}
            <View style={styles.editSection}>
              <View style={styles.editHeader}>
                <Ionicons name="create" size={20} color={Colors.primary.main} />
                <Text style={styles.editTitle}>笔记内容</Text>
              </View>

              {/* 标题输入 */}
              <View style={styles.titleSection}>
                <View style={styles.titleHeader}>
                  <Text style={styles.titleLabel}>标题</Text>
                  <Text style={styles.charCount}>{noteTitle.length}/{MAX_TITLE_LENGTH}</Text>
                </View>
                <TextInput
                  style={styles.titleInput}
                  placeholder="给笔记起个标题..."
                  placeholderTextColor={Colors.neutral.textMuted}
                  value={noteTitle}
                  onChangeText={setNoteTitle}
                  maxLength={MAX_TITLE_LENGTH}
                />
              </View>

              {/* 内容输入 */}
              <View style={styles.contentSection}>
                <View style={styles.contentHeader}>
                  <Text style={styles.contentLabel}>内容</Text>
                  <Text style={styles.charCount}>{noteContent.length}/{MAX_CONTENT_LENGTH}</Text>
                </View>
                <TextInput
                  style={styles.contentInput}
                  placeholder="记录你的学习心得..."
                  placeholderTextColor={Colors.neutral.textMuted}
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
          </ScrollView>

          {/* 底部按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default NoteCreationModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.neutral.background,
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
    borderBottomColor: Colors.neutral.borderAlt,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.neutral.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral.textPrimary,
  },
  sceneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.neutral.borderAlt,
  },
  sceneTitle: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.neutral.textPrimary,
    flex: 1,
  },
  sceneTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Rounded.full,
    backgroundColor: Colors.primary.transparent,
    borderWidth: 0.5,
    borderColor: Colors.primary.main,
  },
  sceneTypeTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primary.main,
  },
  bodyScroll: {
    flex: 1,
  },
  outlineSection: {
    padding: Spacing.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.neutral.borderAlt,
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
    color: Colors.neutral.textPrimary,
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
    borderBottomColor: Colors.neutral.border,
  },
  outlineItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  outlineItemText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.neutral.textPrimary,
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.primary.transparent,
    borderWidth: 0.5,
    borderColor: Colors.primary.main,
  },
  addBtnText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primary.main,
  },
  addAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.primary.transparent,
    borderWidth: 0.5,
    borderColor: Colors.primary.main,
  },
  addAllBtnText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary.main,
  },
  emptyOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: Spacing.md,
  },
  emptyOutlineText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.neutral.textMuted,
  },
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
    color: Colors.neutral.textPrimary,
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
    color: Colors.neutral.textSecondary,
  },
  charCount: {
    fontSize: 11,
    color: Colors.neutral.textMuted,
  },
  titleInput: {
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    padding: Spacing.sm,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral.textPrimary,
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
    color: Colors.neutral.textSecondary,
  },
  contentInput: {
    backgroundColor: Colors.neutral.backgroundAlt,
    borderRadius: Rounded.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    padding: Spacing.sm,
    fontSize: 14,
    color: Colors.neutral.textPrimary,
    minHeight: 150,
    maxHeight: 300,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Colors.neutral.borderAlt,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.neutral.backgroundAlt,
  },
  cancelBtnText: {
    fontSize: 16,
    color: Colors.neutral.textSecondary,
  },
  createBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Rounded.sm,
    backgroundColor: Colors.primary.main,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.textInverse,
  },
  createBtnDisabled: {
    backgroundColor: Colors.neutral.disabled,
    opacity: 0.6,
  },
});