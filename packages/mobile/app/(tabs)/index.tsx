import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth/auth-context';
import { useClassrooms } from '@/lib/hooks/use-classrooms';
import { ClassroomCard } from '@/components/classroom-card';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { classrooms, loading, error, refresh } = useClassrooms();

  useEffect(() => {
    refresh();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>加载失败: {error}</Text>
        <TouchableOpacity onPress={refresh} style={styles.retryButton}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={classrooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClassroomCard
            classroom={item}
            onPress={() => router.push(`/classroom/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无课程</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push('/classroom/create')}
            >
              <Text style={styles.createText}>创建新课程</Text>
            </TouchableOpacity>
          </View>
        }
        refreshing={loading}
        onRefresh={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 16, color: '#666' },
  createButton: { marginTop: 20, padding: 15, backgroundColor: '#007AFF', borderRadius: 8 },
  createText: { color: 'white', fontSize: 16 },
  retryButton: { marginTop: 10, padding: 10, backgroundColor: '#007AFF', borderRadius: 5 },
  retryText: { color: 'white' },
});