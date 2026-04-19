import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/lib/api-client';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth/auth-context';
import { SlideCanvas } from '@/components/playback/slide-canvas';
import { WhiteboardInteractive } from '@/components/playback/WhiteboardInteractive';
import { Quiz } from '@/components/playback/Quiz';
import { PointerOverlay } from '@/components/playback/PointerOverlay';
import { AgentAvatar } from '@/components/playback/agent-avatar';

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
  const { t } = useI18n();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // 教学工具状态
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showPointer, setShowPointer] = useState(false);
  const [pointerMode, setPointerMode] = useState<'laser' | 'spotlight'>('laser');

  // 场景切换动画
  const slideAnim = useRef(new Animated.Value(0)).current;

  const screenWidth = Dimensions.get('window').width - 20;
  const screenHeight = screenWidth * 0.5625;

  useEffect(() => {
    // 等待认证加载完成后再请求
    if (!authLoading && isAuthenticated) {
      loadClassroom();
    }
  }, [id, authLoading, isAuthenticated]);

  // 手势导航（左滑下一页，右滑上一页）
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          // 右滑：上一页
          goToPrevScene();
        } else if (gestureState.dx < -50) {
          // 左滑：下一页
          goToNextScene();
        }
      },
    })
  ).current;

  async function loadClassroom() {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const classroomData = await apiClient.getClassroom(id);
      setData(classroomData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  }

  function goToNextScene() {
    if (data && currentSceneIndex < data.scenes.length - 1) {
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSceneIndex(currentSceneIndex + 1);
        slideAnim.setValue(0);
      });
    }
  }

  function goToPrevScene() {
    if (currentSceneIndex > 0) {
      Animated.timing(slideAnim, {
        toValue: screenWidth,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSceneIndex(currentSceneIndex - 1);
        slideAnim.setValue(0);
      });
    }
  }

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5b9bd5" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>请先登录</Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => {
            // 跳转到登录页
            const router = require('expo-router').useRouter();
            router.replace('/auth/login');
          }}
        >
          <Text style={styles.loginButtonText}>去登录</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5b9bd5" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('errors.serverError')}: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadClassroom}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentScene = data.scenes[currentSceneIndex];

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* 课程标题 */}
      <View style={styles.header}>
        <Text style={styles.title}>{data.stage.name}</Text>
        <Text style={styles.progress}>
          {t('classroom.sceneProgress', { current: currentSceneIndex + 1, total: data.scenes.length })}
        </Text>
      </View>

      {/* 场景内容 */}
      <Animated.View
        style={[
          styles.content,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {currentScene?.type === 'slide' && (
          <View style={styles.slideContainer}>
            <SlideCanvas
              elements={currentScene.content?.canvas?.elements || []}
              width={screenWidth}
            />
            {/* 激光笔/聚光灯覆盖层 */}
            {showPointer && (
              <PointerOverlay
                width={screenWidth}
                height={screenHeight}
                enabled={showPointer}
                mode={pointerMode}
              />
            )}
          </View>
        )}

        {currentScene?.type === 'quiz' && (
          <Quiz
            questions={currentScene.content?.questions || []}
            onSubmit={(answers) => console.log('Quiz answers:', answers)}
            onComplete={(score) => console.log('Quiz score:', score)}
          />
        )}

        {currentScene?.type === 'pbl' && (
          <View style={styles.pblContainer}>
            <Text style={styles.pblTitle}>{currentScene.title}</Text>
            <Text style={styles.pblHint}>PBL 项目学习模式</Text>
          </View>
        )}
      </Animated.View>

      {/* 白板（可选显示） */}
      {showWhiteboard && (
        <View style={styles.whiteboardOverlay}>
          <WhiteboardInteractive
            width={screenWidth}
            height={screenHeight}
            editable={true}
            onClear={() => setShowWhiteboard(false)}
          />
          <TouchableOpacity
            style={styles.closeWhiteboard}
            onPress={() => setShowWhiteboard(false)}
          >
            <Text style={styles.closeButtonText}>{t('whiteboard.close')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Agent 头像 */}
      <View style={styles.agentBar}>
        <AgentAvatar
          agentId="teacher"
          name={t('agent.teacher')}
          color="#4caf50"
          avatar="👨‍🏫"
          speaking={false}
        />
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => {/* TODO: 打开聊天 */}}
        >
          <Text style={styles.chatButtonText}>{t('agent.askQuestion')}</Text>
        </TouchableOpacity>
      </View>

      {/* 工具栏 */}
      <View style={styles.toolbar}>
        {/* 场景导航 */}
        <TouchableOpacity
          style={[styles.toolButton, currentSceneIndex === 0 && styles.toolButtonDisabled]}
          onPress={goToPrevScene}
          disabled={currentSceneIndex === 0}
        >
          <Text style={styles.toolButtonText}>◀</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, currentSceneIndex === data.scenes.length - 1 && styles.toolButtonDisabled]}
          onPress={goToNextScene}
          disabled={currentSceneIndex === data.scenes.length - 1}
        >
          <Text style={styles.toolButtonText}>▶</Text>
        </TouchableOpacity>

        {/* 白板 */}
        <TouchableOpacity
          style={[styles.toolButton, showWhiteboard && styles.toolButtonActive]}
          onPress={() => setShowWhiteboard(!showWhiteboard)}
        >
          <Text style={styles.toolButtonText}>📝</Text>
        </TouchableOpacity>

        {/* 激光笔 */}
        <TouchableOpacity
          style={[styles.toolButton, showPointer && styles.toolButtonActive]}
          onPress={() => {
            setShowPointer(!showPointer);
            setPointerMode('laser');
          }}
        >
          <Text style={styles.toolButtonText}>🔴</Text>
        </TouchableOpacity>

        {/* 聚光灯 */}
        <TouchableOpacity
          style={[styles.toolButton, showPointer && pointerMode === 'spotlight' && styles.toolButtonActive]}
          onPress={() => {
            setShowPointer(true);
            setPointerMode('spotlight');
          }}
        >
          <Text style={styles.toolButtonText}>💡</Text>
        </TouchableOpacity>
      </View>

      {/* 导航提示 */}
      <View style={styles.navHint}>
        <Text style={styles.navHintText}>
          {t('navigation.swipeLeft')} | {t('navigation.swipeRight')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f7fa' },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  loginButton: { backgroundColor: '#5b9bd5', padding: 15, borderRadius: 8 },
  loginButtonText: { color: 'white', fontSize: 16 },
  retryButton: { backgroundColor: '#5b9bd5', padding: 10, borderRadius: 5, marginTop: 15 },
  retryButtonText: { color: 'white', fontSize: 14 },
  header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: 'bold' },
  progress: { fontSize: 14, color: '#666', marginTop: 5 },
  content: { flex: 1, padding: 10 },
  slideContainer: {
    alignItems: 'center',
  },
  pblContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pblTitle: { fontSize: 18, fontWeight: 'bold' },
  pblHint: { fontSize: 14, color: '#666', marginTop: 10 },
  whiteboardOverlay: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  closeWhiteboard: {
    position: 'absolute',
    top: -30,
    right: 0,
    padding: 8,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  closeButtonText: { color: '#fff', fontSize: 12 },
  agentBar: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  chatButtonText: { color: '#fff', fontSize: 14 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  toolButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolButtonActive: { backgroundColor: '#007AFF' },
  toolButtonDisabled: { opacity: 0.5 },
  toolButtonText: { fontSize: 20 },
  navHint: {
    padding: 8,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
  },
  navHintText: { fontSize: 12, color: '#999' },
  retryButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  retryButtonText: { color: '#fff', fontSize: 16 },
});