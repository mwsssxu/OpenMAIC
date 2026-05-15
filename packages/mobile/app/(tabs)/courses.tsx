import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { useHaptics } from '@/lib/hooks/use-haptics';
import { useFirstTimeHint } from '@/lib/hooks/use-first-time-hint';
import { HintToast } from '@/components/common/HintToast';
import { BottomSheetModal } from '@/components/common/BottomSheetModal';
import { showAlert } from '@/lib/utils/alert';

interface Classroom {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  scene_count?: number;
}

export default function CoursesScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { onPress, onSuccess, onError } = useFeedback();
  const haptics = useHaptics();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 首次进入提示：长按卡片的操作菜单 — 有课程才提示，避免在空列表显示无意义提示
  const longPressHintStore = useFirstTimeHint('courses.cardLongPress', { autoHideMs: 4500 });

  // 搜索状态
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 删除确认模态框
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteName, setPendingDeleteName] = useState<string>('');

  // 重命名模态框
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [pendingRenameId, setPendingRenameId] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>('');

  // 长按弹出的底部操作菜单
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionTarget, setActionTarget] = useState<Classroom | null>(null);

  useEffect(() => {
    loadClassrooms();
  }, []);

  // 搜索过滤
  const filteredClassrooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter((c) => {
      const name = c.name?.toLowerCase() ?? '';
      const desc = c.description?.toLowerCase() ?? '';
      return name.includes(q) || desc.includes(q);
    });
  }, [classrooms, searchQuery]);

  const loadClassrooms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getClassrooms();
      setClassrooms(data);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    haptics.light();
    onPress();
    router.push('/classroom/create' as any);
  };

  // 长按卡片 → 弹出底部操作菜单（移动端常用手势）
  const openActionSheet = (classroom: Classroom) => {
    haptics.medium();
    setActionTarget(classroom);
    setActionSheetVisible(true);
  };

  const closeActionSheet = () => {
    setActionSheetVisible(false);
    setActionTarget(null);
  };

  // 打开删除确认
  const openDeleteConfirm = (classroom: Classroom) => {
    setPendingDeleteId(classroom.id);
    setPendingDeleteName(classroom.name);
    setDeleteModalVisible(true);
  };

  // 执行删除
  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    haptics.medium();
    setDeleteModalVisible(false);
    try {
      await apiClient.deleteClassroom(pendingDeleteId);
      setClassrooms(prev => prev.filter(c => c.id !== pendingDeleteId));
      haptics.success();
      onSuccess();
      showAlert('成功', '课程已删除');
    } catch (err: any) {
      haptics.error();
      onError();
      showAlert('错误', '删除失败: ' + err.message);
    } finally {
      setPendingDeleteId(null);
      setPendingDeleteName('');
    }
  };

  // 打开重命名
  const openRename = (classroom: Classroom) => {
    setPendingRenameId(classroom.id);
    setNewName(classroom.name);
    setRenameModalVisible(true);
  };

  // 执行重命名
  const confirmRename = async () => {
    if (!pendingRenameId || !newName.trim()) return;

    haptics.light();
    setRenameModalVisible(false);
    try {
      // 更新课程名称
      await apiClient.updateClassroom(pendingRenameId, newName.trim());
      setClassrooms(prev => prev.map(c =>
        c.id === pendingRenameId ? { ...c, name: newName.trim() } : c
      ));
      haptics.success();
      onSuccess();
    } catch (err: any) {
      haptics.error();
      onError();
      showAlert('错误', '重命名失败: ' + err.message);
    } finally {
      setPendingRenameId(null);
      setNewName('');
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString();
  };

  const renderClassroom = ({ item }: { item: Classroom }) => (
    <TouchableOpacity
      style={styles.classroomCard}
      onPress={() => router.push(`/classroom/${item.id}` as any)}
      onLongPress={() => openActionSheet(item)}
      delayLongPress={350}
      activeOpacity={0.7}
    >
      {/* 缩略图区域 */}
      <View style={styles.thumbnailArea}>
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons name="document-text-outline" size={32} color={Colors.semantic.teal} />
        </View>
        {/* 长按提示微标签 */}
        <View style={styles.longPressHint}>
          <Ionicons name="ellipsis-horizontal" size={14} color={Colors.neutral.textInverse} />
        </View>
      </View>

      {/* 课程信息 */}
      <View style={styles.cardInfo}>
        <Text style={styles.classroomName} numberOfLines={2}>{item.name}</Text>
        {item.description && (
          <Text style={styles.classroomDesc} numberOfLines={1}>{item.description}</Text>
        )}
        <View style={styles.cardMeta}>
          <Ionicons name="layers-outline" size={12} color={Colors.neutral.textMuted} />
          <Text style={styles.classroomMeta}>
            {item.scene_count || 0} 场景 · {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary.main} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.feedback.errorText} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadClassrooms}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        {searchOpen ? (
          // 搜索模式
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color={Colors.neutral.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('classroom.searchPlaceholder') || '搜索课程...'}
              placeholderTextColor={Colors.neutral.textMuted}
              autoFocus
            />
            <TouchableOpacity
              style={styles.searchCloseBtn}
              onPress={() => {
                haptics.light();
                setSearchOpen(false);
                setSearchQuery('');
              }}
            >
              <Ionicons name="close-circle" size={20} color={Colors.neutral.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          // 正常模式
          <>
            <Text style={styles.headerTitle}>{t('classroom.title') || '我的课程'}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.searchToggleBtn}
                onPress={() => {
                  haptics.light();
                  setSearchOpen(true);
                }}
              >
                <Ionicons name="search-outline" size={22} color={Colors.neutral.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Ionicons name="add-outline" size={24} color={Colors.neutral.textInverse} />
                <Text style={styles.createBtnText}>{t('classroom.create') || '新建'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* 课程列表 */}
      <FlatList
        data={filteredClassrooms}
        keyExtractor={(item) => item.id}
        renderItem={renderClassroom}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          searchQuery.trim() ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search-outline" size={44} color={Colors.neutral.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{t('classroom.noResults') || '未找到匹配的课程'}</Text>
              <Text style={styles.emptyHint}>{t('classroom.searchHint') || '试试其他关键词'}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="folder-open-outline" size={44} color={Colors.primary.main} />
              </View>
              <Text style={styles.emptyTitle}>{t('classroom.noClassrooms') || '开始创建你的第一个课程'}</Text>
              <Text style={styles.emptyHint}>上传教材，AI 自动为你生成互动课堂</Text>
              <TouchableOpacity style={styles.emptyCreateBtn} onPress={handleCreate}>
                <Ionicons name="add" size={18} color={Colors.neutral.white} style={{ marginRight: 6 }} />
                <Text style={styles.emptyCreateText}>{t('classroom.create') || '创建课程'}</Text>
              </TouchableOpacity>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={loadClassrooms}
        contentContainerStyle={styles.listContent}
      />

      {/* 删除确认模态框 */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <Pressable style={styles.modalContainer} onPress={() => setDeleteModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="warning-outline" size={48} color={Colors.feedback.warningText} />
            <Text style={styles.modalTitle}>确认删除</Text>
            <Text style={styles.modalMessage}>
              确定要删除课程 "{pendingDeleteName}" 吗？此操作无法撤销。
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  haptics.light();
                  setDeleteModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmDelete}
              >
                <Text style={styles.modalConfirmText}>删除</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 重命名模态框 */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <Pressable style={styles.modalContainer} onPress={() => setRenameModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Ionicons name="pencil-outline" size={48} color={Colors.semantic.blue} />
            <Text style={styles.modalTitle}>重命名课程</Text>
            <TextInput
              style={styles.renameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="输入新名称"
              placeholderTextColor={Colors.neutral.textMuted}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  haptics.light();
                  setRenameModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmRename}
              >
                <Text style={styles.modalConfirmText}>保存</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* 长按底部操作菜单 - 基于 BottomSheetModal 统一下滑关闭交互 */}
      <BottomSheetModal
        visible={actionSheetVisible}
        onClose={closeActionSheet}
        contentStyle={styles.actionSheetContent}
      >
        {actionTarget && (
          <Text style={styles.sheetTitle} numberOfLines={1}>{actionTarget.name}</Text>
        )}
        <TouchableOpacity
          style={styles.sheetItem}
          onPress={() => {
            const target = actionTarget;
            closeActionSheet();
            if (target) openRename(target);
          }}
        >
          <Ionicons name="pencil-outline" size={20} color={Colors.neutral.textPrimary} />
          <Text style={styles.sheetItemText}>重命名</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sheetItem}
          onPress={() => {
            const target = actionTarget;
            closeActionSheet();
            if (target) openDeleteConfirm(target);
          }}
        >
          <Ionicons name="trash-outline" size={20} color={Colors.feedback.errorText} />
          <Text style={[styles.sheetItemText, { color: Colors.feedback.errorText }]}>删除</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sheetCancelBtn} onPress={closeActionSheet}>
          <Text style={styles.sheetCancelText}>取消</Text>
        </TouchableOpacity>
      </BottomSheetModal>

      {/* 首次进入操作提示 */}
      <HintToast
        visible={longPressHintStore.visible && classrooms.length > 0}
        onClose={longPressHintStore.dismiss}
        icon="hand-left-outline"
        text="长按课程卡片可重命名或删除"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },

  // 头部
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.neutral.textPrimary },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchToggleBtn: {
    padding: Spacing.sm,
    marginRight: Spacing.sm,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.md - 1,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
  },
  createBtnText: { color: Colors.neutral.white, marginLeft: 5, fontWeight: '600' },

  // 搜索栏
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.background,
    borderRadius: Rounded.full,
    paddingHorizontal: Spacing.sm,
    height: 40,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral.textPrimary,
  },
  searchCloseBtn: { padding: Spacing.xs },

  // 列表
  listContent: { padding: Spacing.sm + 4 },
  gridRow: { justifyContent: 'space-between' },

  // 课程卡片
  classroomCard: {
    width: '48%',
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.md,
    marginBottom: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  thumbnailArea: {
    height: 100,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderTopLeftRadius: Rounded.md,
    borderTopRightRadius: Rounded.md,
    position: 'relative',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  longPressHint: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: Rounded.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { padding: Spacing.sm },
  classroomName: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: Spacing.xs },
  classroomDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginBottom: Spacing.sm },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  classroomMeta: { fontSize: 11, color: Colors.neutral.textMuted, marginLeft: Spacing.xs },

  // 空状态
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', padding: Spacing.xxl + 8 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.neutral.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: Spacing.xs },
  emptyHint: { fontSize: 13, color: Colors.neutral.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md + 4,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.primary.main,
    borderRadius: Rounded.full,
  },
  emptyCreateText: { color: Colors.neutral.white, fontSize: 15, fontWeight: '600' },

  // 错误
  errorText: { color: Colors.feedback.errorText, fontSize: 16, marginTop: 10 },
  retryBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary.main,
    borderRadius: Rounded.full,
  },
  retryText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },

  // 模态框
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.neutral.card,
    borderRadius: Rounded.lg,
    padding: Spacing.md + 4,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginTop: Spacing.md, color: Colors.neutral.textPrimary },
  modalMessage: { fontSize: 14, color: Colors.neutral.textSecondary, textAlign: 'center', marginTop: 10 },
  renameInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: Rounded.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    fontSize: 16,
    backgroundColor: Colors.neutral.backgroundAlt,
    color: Colors.neutral.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    backgroundColor: Colors.neutral.disabled,
    marginRight: Spacing.md,
  },
  modalCancelText: { color: Colors.neutral.textSecondary, fontSize: 16, fontWeight: '600' },
  modalConfirmBtn: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    backgroundColor: Colors.primary.main,
  },
  modalConfirmText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },

  // 底部操作菜单（内容样式，外壳由 BottomSheetModal 统一提供）
  actionSheetContent: {
    paddingBottom: Spacing.xl,
  },
  sheetTitle: {
    fontSize: 13,
    color: Colors.neutral.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.neutral.border,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sheetItemText: {
    fontSize: 16,
    color: Colors.neutral.textPrimary,
    marginLeft: Spacing.md,
  },
  sheetCancelBtn: {
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Rounded.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 16,
    color: Colors.neutral.textSecondary,
    fontWeight: '500',
  },
});
