import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { SlideCanvas } from '@/components/playback/slide-canvas';

interface Scene {
  id: string;
  type: string;
  title: string;
  content: any;
  actions: any[];
}

interface ClassroomData {
  stage: any;
  scenes: Scene[];
}

export default function ClassroomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  useEffect(() => {
    loadClassroom();
  }, [id]);

  async function loadClassroom() {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const classroomData = await apiClient.getClassroom(id);
      setData(classroomData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>加载课程...</Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text>加载失败: {error}</Text>
      </View>
    );
  }

  const currentScene = data.scenes[currentSceneIndex];

  return (
    <View style={styles.container}>
      {/* 课程标题 */}
      <View style={styles.header}>
        <Text style={styles.title}>{data.stage.name}</Text>
        <Text style={styles.progress}>
          场景 {currentSceneIndex + 1} / {data.scenes.length}
        </Text>
      </View>

      {/* 场景内容 */}
      <View style={styles.content}>
        {currentScene?.type === 'slide' && (
          <SlideCanvas
            elements={currentScene.content?.canvas?.elements || []}
            width={Dimensions.get('window').width - 20}
          />
        )}
        {currentScene?.type === 'quiz' && (
          <View style={styles.quizContainer}>
            <Text style={styles.quizTitle}>{currentScene.title}</Text>
            <Text style={styles.quizHint}>测验功能即将上线</Text>
          </View>
        )}
      </View>

      {/* Agent 信息 */}
      <View style={styles.agentBar}>
        <Text style={styles.agentName}>AI 教师</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  progress: { fontSize: 14, color: '#666', marginTop: 5 },
  content: { flex: 1, padding: 10 },
  quizContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  quizTitle: { fontSize: 18, fontWeight: 'bold' },
  quizHint: { fontSize: 14, color: '#666', marginTop: 10 },
  agentBar: { padding: 15, borderTopWidth: 1, borderTopColor: '#eee' },
  agentName: { fontSize: 16 },
});