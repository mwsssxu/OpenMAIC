import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

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
      Alert.alert('成功', `已选择「${buddyType.name}」作为你的学习搭子`);
      loadData();
    } catch (error) {
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  section: {
    backgroundColor: 'white',
    marginBottom: 10,
    padding: 15,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 10 },
  currentBuddy: {
    backgroundColor: '#e8f4fd',
    padding: 15,
    borderRadius: 8,
  },
  buddyName: { fontSize: 20, fontWeight: 'bold', color: '#5b9bd5' },
  buddyType: { fontSize: 14, color: '#666', marginTop: 5 },
  buddyTone: { fontSize: 14, color: '#666' },
  typeCard: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
  },
  activeTypeCard: {
    borderColor: '#5b9bd5',
    backgroundColor: '#e8f4fd',
  },
  typeName: { fontSize: 16, fontWeight: '500' },
  typeDesc: { fontSize: 14, color: '#666', marginTop: 5 },
  messageItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
  },
  unreadMessage: { backgroundColor: '#fff3e0' },
  messageContent: { fontSize: 14 },
  messageTime: { fontSize: 12, color: '#999', marginTop: 5 },
  emptyText: { color: '#999', textAlign: 'center', padding: 20 },
});