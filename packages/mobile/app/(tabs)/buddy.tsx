import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Colors, Rounded, Spacing } from '@/lib/constants/theme';
import { useFeedback } from '@/lib/hooks/use-feedback';

interface BuddyType {
  id: string;
  name: string;
  description: string;
  tone: string;
}

interface BuddyMessage {
  id: string;
  trigger_event: string;
  message_type: string;
  content: string;
  read: boolean;
  created_at: string;
}

export default function BuddyScreen() {
  const { onSuccess, onError } = useFeedback();
  const [buddyTypes, setBuddyTypes] = useState<BuddyType[]>([]);
  const [myConfig, setMyConfig] = useState<any>(null);
  const [messages, setMessages] = useState<BuddyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [typesData, configData, messagesData] = await Promise.all([
        apiClient.getBuddyTypes(),
        apiClient.getMyBuddyConfig(),
        apiClient.getBuddyMessages(1, 20),
      ]);
      setBuddyTypes(typesData.types || []);
      setMyConfig(configData);
      setMessages(messagesData.items || []);
    } catch (error) {
      console.error('Load buddy data error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const onRefresh = useCallback(() => {
    loadData();
  }, []);

  const selectBuddyType = async (buddyType: BuddyType) => {
    try {
      await apiClient.setBuddyConfig(buddyType.id);
      onSuccess();
      Alert.alert('成功', `已选择「${buddyType.name}」作为你的学习搭子`);
      loadData();
    } catch (error) {
      onError();
      Alert.alert('失败', '设置失败，请稍后重试');
    }
  };

  const renderMessage = ({ item }: { item: BuddyMessage }) => (
    <View style={[styles.messageItem, !item.read && styles.unreadMessage]}>
      <Text style={styles.messageContent}>{item.content}</Text>
      <Text style={styles.messageTime}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} />}
    >
      {/* 当前搭子 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>我的学习搭子</Text>
        {myConfig && (
          <View style={styles.currentBuddy}>
            <Text style={styles.buddyName}>
              {myConfig.buddy_name || '鼓励者'}
            </Text>
            <Text style={styles.buddyType}>
              类型: {myConfig.buddy_type}
            </Text>
            <Text style={styles.buddyTone}>
              风格: {myConfig.tone_style}
            </Text>
          </View>
        )}
      </View>

      {/* 选择搭子类型 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>选择搭子类型</Text>
        {buddyTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeCard,
              myConfig?.buddy_type === type.id && styles.activeTypeCard,
            ]}
            onPress={() => selectBuddyType(type)}
          >
            <Text style={styles.typeName}>{type.name}</Text>
            <Text style={styles.typeDesc}>{type.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 搭子消息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>搭子消息</Text>
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>暂无消息</Text>
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral.background },
  section: {
    backgroundColor: Colors.neutral.card,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Rounded.lg,
    marginHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.sm, color: Colors.neutral.textPrimary },
  currentBuddy: {
    backgroundColor: Colors.neutral.backgroundAlt,
    padding: Spacing.md,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  buddyName: { fontSize: 20, fontWeight: 'bold', color: Colors.primary.main },
  buddyType: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.sm - 2 },
  buddyTone: { fontSize: 14, color: Colors.neutral.textMuted },
  typeCard: {
    padding: Spacing.md,
    borderRadius: Rounded.md,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.neutral.backgroundAlt,
  },
  activeTypeCard: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary.transparent,
  },
  typeName: { fontSize: 16, fontWeight: '600', color: Colors.neutral.textPrimary },
  typeDesc: { fontSize: 14, color: Colors.neutral.textSecondary, marginTop: Spacing.sm - 2 },
  messageItem: {
    padding: Spacing.sm + 6,
    borderRadius: Rounded.md,
    backgroundColor: Colors.neutral.backgroundAlt,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.neutral.border,
  },
  unreadMessage: { backgroundColor: Colors.primary.transparent, borderColor: Colors.primary.main },
  messageContent: { fontSize: 14, color: Colors.neutral.textPrimary },
  messageTime: { fontSize: 12, color: Colors.neutral.textMuted, marginTop: Spacing.sm - 2 },
  emptyText: { color: Colors.neutral.textMuted, textAlign: 'center', padding: Spacing.lg + 4 },
});
