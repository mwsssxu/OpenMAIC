import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { apiClient } from '@/lib/api-client';

interface Classroom {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export default function CoursesScreen() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClassrooms();
  }, []);

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

  const renderClassroom = ({ item }: { item: Classroom }) => (
    <TouchableOpacity
      style={styles.classroomCard}
      onPress={() => router.push(`/classroom/${item.id}` as any)}
    >
      <Text style={styles.classroomName}>{item.name}</Text>
      {item.description && (
        <Text style={styles.classroomDesc}>{item.description}</Text>
      )}
      <Text style={styles.classroomDate}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const handleCreate = () => {
    router.push('/classroom/create' as any);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5b9bd5" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadClassrooms}>
          <Text style={styles.retryText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.createHeaderBtn}
        onPress={handleCreate}
      >
        <Text style={styles.createHeaderText}>+ 创建新课程</Text>
      </TouchableOpacity>

      <FlatList
        data={classrooms}
        keyExtractor={(item) => item.id}
        renderItem={renderClassroom}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>暂无课程</Text>
            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleCreate}
            >
              <Text style={styles.createText}>创建新课程</Text>
            </TouchableOpacity>
          </View>
        }
        refreshing={loading}
        onRefresh={loadClassrooms}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  createHeaderBtn: {
    backgroundColor: '#5b9bd5',
    padding: 12,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  createHeaderText: { color: 'white', fontSize: 16, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  classroomCard: {
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 15,
    marginTop: 10,
    borderRadius: 10,
  },
  classroomName: { fontSize: 16, fontWeight: '600', color: '#333' },
  classroomDesc: { fontSize: 14, color: '#666', marginTop: 5 },
  classroomDate: { fontSize: 12, color: '#999', marginTop: 8 },
  errorText: { color: '#ef4444', fontSize: 16 },
  retryBtn: { marginTop: 15, padding: 10, backgroundColor: '#5b9bd5', borderRadius: 5 },
  retryText: { color: 'white' },
  empty: { alignItems: 'center', paddingTop: 50 },
  emptyText: { color: '#666', fontSize: 16 },
  createBtn: { marginTop: 20, padding: 15, backgroundColor: '#5b9bd5', borderRadius: 8 },
  createText: { color: 'white', fontSize: 16 },
});