import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

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
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    onPress();
    router.push('/classroom/create' as any);
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

    setDeleteModalVisible(false);
    try {
      await apiClient.deleteClassroom(pendingDeleteId);
      setClassrooms(prev => prev.filter(c => c.id !== pendingDeleteId));
      onSuccess();
      if (Platform.OS === 'web') {
        window.alert('课程已删除');
      } else {
        Alert.alert('成功', '课程已删除');
      }
    } catch (err: any) {
      onError();
      if (Platform.OS === 'web') {
        window.alert('删除失败: ' + err.message);
      } else {
        Alert.alert('错误', '删除失败: ' + err.message);
      }
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

    setRenameModalVisible(false);
    try {
      // 更新课程名称
      await apiClient.updateClassroom(pendingRenameId, newName.trim());
      setClassrooms(prev => prev.map(c =>
        c.id === pendingRenameId ? { ...c, name: newName.trim() } : c
      ));
      onSuccess();
    } catch (err: any) {
      onError();
      if (Platform.OS === 'web') {
        window.alert('重命名失败: ' + err.message);
      } else {
        Alert.alert('错误', '重命名失败: ' + err.message);
      }
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
      activeOpacity={0.7}
    >
      {/* 缩略图区域 */}
      <View style={styles.thumbnailArea}>
        <View style={styles.thumbnailPlaceholder}>
          <Ionicons name="document-text-outline" size={32} color={Colors.secondary.info} />
        </View>
        {/* 删除和重命名按钮 */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => openRename(item)}
          >
            <Ionicons name="pencil" size={16} color={Colors.neutral.textInverse} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardActionBtn, styles.deleteBtn]}
            onPress={() => openDeleteConfirm(item)}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.neutral.textInverse} />
          </TouchableOpacity>
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
              autoFocus
            />
            <TouchableOpacity
              style={styles.searchCloseBtn}
              onPress={() => {
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
                onPress={() => setSearchOpen(true)}
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
              <Ionicons name="search-outline" size={48} color={Colors.neutral.textMuted} />
              <Text style={styles.emptyTitle}>{t('classroom.noResults') || '未找到匹配的课程'}</Text>
              <Text style={styles.emptyHint}>{t('classroom.searchHint') || '尝试其他关键词'}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color={Colors.neutral.textMuted} />
              <Text style={styles.emptyTitle}>{t('classroom.noClassrooms') || '暂无课程'}</Text>
              <Text style={styles.emptyHint}>点击右上角按钮创建您的第一个课程</Text>
              <TouchableOpacity style={styles.emptyCreateBtn} onPress={handleCreate}>
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
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Ionicons name="warning-outline" size={48} color={Colors.feedback.warningText} />
            <Text style={styles.modalTitle}>确认删除</Text>
            <Text style={styles.modalMessage}>
              确定要删除课程 "{pendingDeleteName}" 吗？此操作无法撤销。
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
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
          </View>
        </View>
      </Modal>

      {/* 重命名模态框 */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Ionicons name="pencil-outline" size={48} color={Colors.secondary.info} />
            <Text style={styles.modalTitle}>重命名课程</Text>
            <TextInput
              style={styles.renameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="输入新名称"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRenameModalVisible(false)}
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
          </View>
        </View>
      </Modal>
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
    gap: Spacing.sm,
  },
  searchToggleBtn: {
    padding: Spacing.sm,
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
  cardActions: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  cardActionBtn: {
    width: 28,
    height: 28,
    borderRadius: Rounded.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { backgroundColor: Colors.feedback.errorText },
  cardInfo: { padding: Spacing.sm },
  classroomName: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: Spacing.xs },
  classroomDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginBottom: Spacing.sm },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  classroomMeta: { fontSize: 11, color: Colors.neutral.textMuted, marginLeft: Spacing.xs },

  // 空状态
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', padding: Spacing.xxl + 8 },
  emptyTitle: { fontSize: 18, color: Colors.neutral.textPrimary, marginTop: Spacing.md },
  emptyHint: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.sm },
  emptyCreateBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary.main,
    borderRadius: Rounded.full,
  },
  emptyCreateText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },

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
    gap: Spacing.md,
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    backgroundColor: Colors.neutral.disabled,
  },
  modalCancelText: { color: Colors.neutral.textSecondary, fontSize: 16, fontWeight: '600' },
  modalConfirmBtn: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: Rounded.full,
    backgroundColor: Colors.primary.main,
  },
  modalConfirmText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
});
