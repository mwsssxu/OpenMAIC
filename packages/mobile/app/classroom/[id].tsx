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
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth/auth-context';

interface Scene {
  id: string;
  type: string;
  title: string;
  content: any;
  actions: any[];
}

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  persona?: string;
}

interface ClassroomData {
  stage: {
    id: string;
    name: string;
    description?: string;
    agentIds?: string[];
    generatedAgentConfigs?: Agent[];
  };
  scenes: Scene[];
}

export default function ClassroomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<ClassroomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // 教学工具状态
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showPointer, setShowPointer] = useState(false);
  const [pointerMode, setPointerMode] = useState<'laser' | 'spotlight'>('laser');
  const [showThumbnailNav, setShowThumbnailNav] = useState(false);

  // 智能体互动
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ agent: string; message: string }>>([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  // 场景切换动画
  const slideAnim = useRef(new Animated.Value(0)).current;

  const screenWidth = Dimensions.get('window').width - 40;
  const screenHeight = screenWidth * 0.5625;

  useEffect(() => {
    if (!authLoading && isAuthenticated && id) {
      loadClassroom();
    }
  }, [id, authLoading, isAuthenticated]);

  // 手势导航
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          goToPrevScene();
        } else if (gestureState.dx < -50) {
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

      // 加载智能体配置
      if (classroomData.stage?.generatedAgentConfigs?.length > 0) {
        setAgents(classroomData.stage.generatedAgentConfigs);
      } else {
        // 默认智能体
        setAgents([
          { id: 'teacher', name: '老师', role: 'teacher', color: '#5b9bd5', persona: '专业教师' },
          { id: 'assistant', name: '助教', role: 'assistant', color: '#10b981', persona: '辅助讲解' },
          { id: 'curious', name: '好奇同学', role: 'student', color: '#f59e0b', persona: '提问互动' },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
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

  function goToScene(index: number) {
    if (index !== currentSceneIndex) {
      setCurrentSceneIndex(index);
      setShowThumbnailNav(false);
    }
  }

  // 发送消息给智能体
  async function sendMessage() {
    if (!chatMessage.trim() || !selectedAgent) return;

    setSendingMessage(true);
    const userMessage = chatMessage.trim();
    setChatMessage('');

    // 添加用户消息
    setChatHistory(prev => [...prev, { agent: '我', message: userMessage }]);

    try {
      // 调用聊天API
      const response = await apiClient.sendPersonaSession(selectedAgent.id, userMessage);
      const agentResponse = response.response || '收到你的问题了，让我思考一下...';

      setChatHistory(prev => [...prev, { agent: selectedAgent.name, message: agentResponse }]);
    } catch (err) {
      // 模拟回复
      setChatHistory(prev => [...prev, {
        agent: selectedAgent.name,
        message: `${selectedAgent.role === 'teacher' ? '这是一个很好的问题！' : '我也有同样的疑问...'}`
      }]);
    } finally {
      setSendingMessage(false);
    }
  }

  // 打开智能体聊天
  function openAgentChat(agent: Agent) {
    setSelectedAgent(agent);
    setChatHistory([]);
    setShowChatModal(true);
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
          onPress={() => router.replace('/auth/login')}
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
        <Text style={styles.errorText}>加载失败: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadClassroom}>
          <Text style={styles.retryButtonText}>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentScene = data.scenes[currentSceneIndex];

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* 头部：标题 + 返回按钮 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#5b9bd5" />
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{data.stage.name}</Text>
        <Text style={styles.progress}>
          {currentSceneIndex + 1} / {data.scenes.length}
        </Text>
      </View>

      {/* 场景内容 */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX: slideAnim }] }]}
      >
        {currentScene?.type === 'slide' && (
          <View style={styles.slideContainer}>
            <Text style={styles.sceneTitle}>{currentScene.title}</Text>
            {currentScene.content?.text && (
              <Text style={styles.sceneText}>{currentScene.content.text}</Text>
            )}
          </View>
        )}

        {currentScene?.type === 'quiz' && (
          <View style={styles.quizContainer}>
            <Text style={styles.quizTitle}>{currentScene.title}</Text>
            <Text style={styles.quizHint}>测验场景 - 回答问题检验学习效果</Text>
          </View>
        )}

        {currentScene?.type === 'pbl' && (
          <View style={styles.pblContainer}>
            <Text style={styles.pblTitle}>{currentScene.title}</Text>
            <Text style={styles.pblHint}>PBL 项目学习模式</Text>
          </View>
        )}
      </Animated.View>

      {/* 场景缩略图导航（可展开） */}
      <TouchableOpacity
        style={styles.thumbnailToggle}
        onPress={() => setShowThumbnailNav(!showThumbnailNav)}
      >
        <Ionicons name={showThumbnailNav ? "chevron-down" : "chevron-up"} size={20} color="#5b9bd5" />
        <Text style={styles.thumbnailToggleText}>场景导航</Text>
      </TouchableOpacity>

      {showThumbnailNav && (
        <ScrollView
          horizontal
          style={styles.thumbnailBar}
          showsHorizontalScrollIndicator={false}
        >
          {data.scenes.map((scene, index) => (
            <TouchableOpacity
              key={scene.id}
              style={[
                styles.thumbnailItem,
                index === currentSceneIndex && styles.thumbnailItemActive
              ]}
              onPress={() => goToScene(index)}
            >
              <View style={styles.thumbnailIcon}>
                <Ionicons
                  name={scene.type === 'slide' ? 'document-text' :
                       scene.type === 'quiz' ? 'help-circle' : 'layers'}
                  size={16}
                  color={index === currentSceneIndex ? '#5b9bd5' : '#666'}
                />
              </View>
              <Text style={[
                styles.thumbnailTitle,
                index === currentSceneIndex && styles.thumbnailTitleActive
              ]}>
                {scene.title.slice(0, 8)}
              </Text>
              <Text style={styles.thumbnailIndex}>#{index + 1}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 智能体头像栏 */}
      <View style={styles.agentBar}>
        {agents.map(agent => (
          <TouchableOpacity
            key={agent.id}
            style={[styles.agentAvatarBtn, { backgroundColor: agent.color + '20' }]}
            onPress={() => openAgentChat(agent)}
          >
            <Ionicons name="person" size={24} color={agent.color} />
            <Text style={[styles.agentName, { color: agent.color }]}>{agent.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => selectedAgent && openAgentChat(selectedAgent)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#5b9bd5" />
          <Text style={styles.chatBtnText}>提问</Text>
        </TouchableOpacity>
      </View>

      {/* 工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolBtn, currentSceneIndex === 0 && styles.toolBtnDisabled]}
          onPress={goToPrevScene}
          disabled={currentSceneIndex === 0}
        >
          <Ionicons name="chevron-back" size={20} color={currentSceneIndex === 0 ? '#ccc' : '#5b9bd5'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, currentSceneIndex === data.scenes.length - 1 && styles.toolBtnDisabled]}
          onPress={goToNextScene}
          disabled={currentSceneIndex === data.scenes.length - 1}
        >
          <Ionicons name="chevron-forward" size={20} color={currentSceneIndex === data.scenes.length - 1 ? '#ccc' : '#5b9bd5'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, showWhiteboard && styles.toolBtnActive]}
          onPress={() => setShowWhiteboard(!showWhiteboard)}
        >
          <Ionicons name="pencil" size={20} color={showWhiteboard ? 'white' : '#666'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, showPointer && styles.toolBtnActive]}
          onPress={() => setShowPointer(!showPointer)}
        >
          <Ionicons name="radio-button-on" size={20} color={showPointer ? 'white' : '#666'} />
        </TouchableOpacity>
      </View>

      {/* 智能体聊天模态框 */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* 模态框头部 */}
            <View style={styles.modalHeader}>
              {selectedAgent && (
                <View style={[styles.modalAgentAvatar, { backgroundColor: selectedAgent.color + '20' }]}>
                  <Ionicons name="person" size={32} color={selectedAgent.color} />
                </View>
              )}
              <Text style={styles.modalTitle}>
                {selectedAgent ? `与 ${selectedAgent.name} 对话` : '智能体对话'}
              </Text>
              <TouchableOpacity onPress={() => setShowChatModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 聊天历史 */}
            <ScrollView style={styles.chatHistory}>
              {chatHistory.length === 0 && (
                <Text style={styles.chatHint}>开始提问吧，{selectedAgent?.name} 会帮助你理解课程内容</Text>
              )}
              {chatHistory.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.chatBubble,
                    item.agent === '我' ? styles.chatBubbleUser : styles.chatBubbleAgent
                  ]}
                >
                  <Text style={styles.chatBubbleAgentName}>{item.agent}</Text>
                  <Text style={styles.chatBubbleText}>{item.message}</Text>
                </View>
              ))}
            </ScrollView>

            {/* 输入框 */}
            <View style={styles.chatInputArea}>
              <TextInput
                style={styles.chatInput}
                placeholder="输入你的问题..."
                value={chatMessage}
                onChangeText={setChatMessage}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!chatMessage.trim() || sendingMessage) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!chatMessage.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 头部
  header: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#5b9bd5', fontSize: 16 },
  title: { flex: 1, fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  progress: { fontSize: 14, color: '#666' },

  // 内容
  content: { flex: 1, padding: 20 },
  slideContainer: { alignItems: 'center' },
  sceneTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  sceneText: { fontSize: 16, color: '#666', textAlign: 'center' },
  quizContainer: { alignItems: 'center', justifyContent: 'center' },
  quizTitle: { fontSize: 20, fontWeight: 'bold' },
  quizHint: { fontSize: 14, color: '#666', marginTop: 10 },
  pblContainer: { alignItems: 'center', justifyContent: 'center' },
  pblTitle: { fontSize: 20, fontWeight: 'bold' },
  pblHint: { fontSize: 14, color: '#666', marginTop: 10 },

  // 缩略图导航
  thumbnailToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  thumbnailToggleText: { color: '#5b9bd5', marginLeft: 5 },
  thumbnailBar: {
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 15,
    maxHeight: 80,
  },
  thumbnailItem: {
    width: 70,
    alignItems: 'center',
    marginRight: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f5f7fa',
  },
  thumbnailItemActive: { backgroundColor: '#e8f4fd', borderWidth: 2, borderColor: '#5b9bd5' },
  thumbnailIcon: { marginBottom: 5 },
  thumbnailTitle: { fontSize: 12, color: '#666', textAlign: 'center' },
  thumbnailTitleActive: { color: '#5b9bd5', fontWeight: '600' },
  thumbnailIndex: { fontSize: 10, color: '#999' },

  // 智能体栏
  agentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  agentAvatarBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  agentName: { fontSize: 10, marginTop: 2 },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e8f4fd',
    marginLeft: 'auto',
  },
  chatBtnText: { color: '#5b9bd5', marginLeft: 5 },

  // 工具栏
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 15,
    padding: 10,
    backgroundColor: 'white',
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f7fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: '#5b9bd5' },
  toolBtnDisabled: { opacity: 0.5 },

  // 模态框
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalAgentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', marginLeft: 10 },

  // 聊天
  chatHistory: { flex: 1, marginBottom: 15 },
  chatHint: { color: '#999', textAlign: 'center', padding: 20 },
  chatBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    maxWidth: '80%',
  },
  chatBubbleUser: { backgroundColor: '#5b9bd5', alignSelf: 'flex-end' },
  chatBubbleAgent: { backgroundColor: '#f5f7fa', alignSelf: 'flex-start' },
  chatBubbleAgentName: { fontSize: 12, color: '#666', marginBottom: 3 },
  chatBubbleText: { fontSize: 14, color: '#333' },
  chatInputArea: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxHeight: 80,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5b9bd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ccc' },

  // 错误/登录
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  loginButton: { backgroundColor: '#5b9bd5', padding: 15, borderRadius: 8 },
  loginButtonText: { color: 'white', fontSize: 16 },
  retryButton: { backgroundColor: '#5b9bd5', padding: 15, borderRadius: 8 },
  retryButtonText: { color: 'white', fontSize: 16 },
});