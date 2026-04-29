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
import { Colors } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
            <Ionicons name="pencil" size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardActionBtn, styles.deleteBtn]}
            onPress={() => openDeleteConfirm(item)}
          >
            <Ionicons name="trash-outline" size={16} color="white" />
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
          <Ionicons name="layers-outline" size={12} color="#999" />
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
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
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
              <Ionicons name="close-circle" size={20} color="#999" />
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
                <Ionicons name="search-outline" size={22} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Ionicons name="add-circle" size={24} color="white" />
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
              <Ionicons name="search-outline" size={48} color="#999" />
              <Text style={styles.emptyTitle}>{t('classroom.noResults') || '未找到匹配的课程'}</Text>
              <Text style={styles.emptyHint}>{t('classroom.searchHint') || '尝试其他关键词'}</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="folder-open-outline" size={48} color="#999" />
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.neutral.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.border,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.neutral.textPrimary },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchToggleBtn: {
    padding: 8,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.main,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnText: { color: Colors.neutral.white, marginLeft: 5, fontWeight: '600' },

  // 搜索栏
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.background,
    borderRadius: 25,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.neutral.textPrimary,
  },
  searchCloseBtn: { padding: 4 },

  // 列表
  listContent: { padding: 15 },
  gridRow: { justifyContent: 'space-between' },

  // 课程卡片
  classroomCard: {
    width: '48%',
    backgroundColor: Colors.neutral.card,
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  thumbnailArea: {
    height: 100,
    backgroundColor: Colors.neutral.backgroundAlt,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    position: 'relative',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 5,
  },
  cardActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: { backgroundColor: Colors.feedback.errorText },
  cardInfo: { padding: 12 },
  classroomName: { fontSize: 14, fontWeight: '600', color: Colors.neutral.textPrimary, marginBottom: 4 },
  classroomDesc: { fontSize: 12, color: Colors.neutral.textSecondary, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  classroomMeta: { fontSize: 11, color: Colors.neutral.textMuted, marginLeft: 4 },

  // 空状态
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, color: Colors.neutral.textPrimary, marginTop: 15 },
  emptyHint: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: 8 },
  emptyCreateBtn: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: Colors.primary.main,
    borderRadius: 25,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCreateText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },

  // 错误
  errorText: { color: Colors.feedback.errorText, fontSize: 16, marginTop: 10 },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: Colors.primary.main,
    borderRadius: 25,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    borderRadius: 20,
    padding: 25,
    width: '85%',
    alignItems: 'center',
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, color: Colors.neutral.textPrimary },
  modalMessage: { fontSize: 14, color: Colors.neutral.textSecondary, textAlign: 'center', marginTop: 10 },
  renameInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 15,
    fontSize: 16,
    backgroundColor: Colors.neutral.backgroundAlt,
    color: Colors.neutral.textPrimary,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 15,
  },
  modalCancelBtn: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: Colors.neutral.disabled,
  },
  modalCancelText: { color: Colors.neutral.textSecondary, fontSize: 16, fontWeight: '600' },
  modalConfirmBtn: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: Colors.primary.main,
    shadowColor: Colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modalConfirmText: { color: Colors.neutral.white, fontSize: 16, fontWeight: '600' },
});
