import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.110:8000';

// Web端使用localStorage，Mobile端使用SecureStore
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    return SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    return SecureStore.deleteItemAsync(key);
  },
};

// Types
export interface UserStats {
  total_classrooms: number;
  total_scenes: number;
  total_media_files: number;
  total_chat_sessions: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: 'teacher' | 'assistant' | 'student';
  color?: string;
  persona?: string;
  avatar?: string;
  priority?: number;
  voiceConfig?: {
    providerId: string;
    voiceId: string;
  };
}

export interface ExportedData {
  exported_at: string;
  user: {
    id: string;
    email: string;
    nickname: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  };
  classrooms: any[];
  scenes: any[];
  media_files: any[];
  oauth_accounts: any[];
  generation_jobs: any[];
}

class ApiClient {
  private client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
  });

  private token: string | null = null;

  getBaseUrl(): string {
    return API_BASE_URL;
  }

  constructor() {
    // 自动添加 Authorization header
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Token 过期自动刷新
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token 过期，尝试刷新
          const refreshToken = await storage.getItem('refresh_token');
          if (refreshToken) {
            try {
              const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });
              this.setToken(data.access_token);
              await storage.setItem('auth_token', data.access_token);
              // 重试原请求
              error.config.headers.Authorization = `Bearer ${data.access_token}`;
              return this.client.request(error.config);
            } catch {
              // 刷新失败，清除登录状态
              this.setToken(null);
              await storage.deleteItem('auth_token');
              await storage.deleteItem('refresh_token');
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = await storage.getItem('refresh_token');
      if (!refreshToken) {
        return null;
      }

      const response = await axios.post(`${this.getBaseUrl()}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newToken = response.data.access_token;
      this.setToken(newToken);
      await storage.setItem('auth_token', newToken);
      return newToken;
    } catch (error) {
      // 刷新失败，清除登录状态
      this.setToken(null);
      await storage.deleteItem('auth_token');
      await storage.deleteItem('refresh_token');
      return null;
    }
  }

  // ==================== Auth ====================

  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    return data;
  }

  async register(email: string, password: string, nickname?: string) {
    const { data } = await this.client.post('/auth/register', { email, password, nickname });
    return data;
  }

  async getCurrentUser() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  async logout() {
    const { data } = await this.client.post('/auth/logout');
    return data;
  }

  async updateUser(nickname?: string, avatar_url?: string) {
    const { data } = await this.client.put('/auth/me', { nickname, avatar_url });
    return data;
  }

  async changePassword(oldPassword: string, newPassword: string) {
    const { data } = await this.client.post('/auth/password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return data;
  }

  async deleteAccount() {
    const { data } = await this.client.delete('/auth/me');
    // 清除本地 token
    this.setToken(null);
    await storage.deleteItem('auth_token');
    await storage.deleteItem('refresh_token');
    return data;
  }

  async exportData(): Promise<ExportedData> {
    const { data } = await this.client.get('/auth/me/export');
    return data;
  }

  async getStats(): Promise<UserStats> {
    const { data } = await this.client.get('/auth/me/stats');
    return data;
  }

  // ==================== Classrooms ====================

  async getClassrooms() {
    const { data } = await this.client.get('/classrooms');
    return data;
  }

  async getClassroom(id: string) {
    const { data } = await this.client.get(`/classrooms/${id}`);
    return data;
  }

  async createClassroom(name: string, description?: string) {
    const { data } = await this.client.post('/classrooms', { name, description });
    return data;
  }

  // 创建完整课程（包含大纲生成幻灯片内容）
  async createFullClassroom(
    name: string,
    description?: string,
    outlines?: any[],
    agentIds?: string[],
    language?: string,
    agentConfigs?: AgentConfig[]  // 完整的智能体配置
  ) {
    const { data } = await this.client.post('/classrooms/create-full', {
      name,
      description,
      outlines,
      agent_ids: agentIds,
      agent_configs: agentConfigs,
      language: language || 'zh-CN',
    });
    return data;
  }

  async createScene(classroomId: string, outline: any, orderIndex: number, language?: string) {
    const { data } = await this.client.post(`/classrooms/${classroomId}/scenes/create`, {
      outline,
      order_index: orderIndex,
      language: language || 'zh-CN',
    }, {
      timeout: 120000, // 单个场景生成需要时间
    });
    return data;
  }

  async updateClassroom(id: string, name?: string, description?: string) {
    const { data } = await this.client.put(`/classrooms/${id}`, { name, description });
    return data;
  }

  async deleteClassroom(id: string) {
    const { data } = await this.client.delete(`/classrooms/${id}`);
    return data;
  }

  // ==================== Generation ====================

  // SSE 流式生成大纲（真正的流式实现）
  async generateOutlinesStream(
    requirement: string,
    language: string = 'zh-CN',
    agents?: Array<{ id: string; name: string; role: string; persona: string }>,
    webSearch?: boolean,
    onOutline?: (outline: any) => void,
    onComplete?: (count: number) => void,
    onError?: (error: string) => void,
  ): Promise<void> {
    const url = `${this.getBaseUrl()}/generate/outlines-stream`;
    const token = this.token;

    // 验证 token
    if (!token) {
      if (onError) {
        onError('请先登录');
      }
      return Promise.reject(new Error('未登录'));
    }

    // React Native 需要使用 XMLHttpRequest 处理 SSE
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache');

      let outlineCount = 0;
      let lastProcessedLength = 0;
      let currentEvent = '';

      xhr.onreadystatechange = () => {
        if (xhr.readyState >= 3) {
          // 处理响应（readyState 3 = 正在接收，4 = 完成）
          const fullText = xhr.responseText;

          // 检查 HTTP 状态码
          if (xhr.readyState === 4 && xhr.status === 401) {
            // Token 过期，尝试刷新
            this.refreshToken().then(newToken => {
              // 用新 token 重试（只重试一次）
              if (newToken && onError) {
                onError('Token已刷新，请重新尝试');
              }
            }).catch(() => {
              if (onError) {
                onError('登录已过期，请重新登录');
              }
            });
            reject(new Error('Token过期'));
            return;
          }

          // 只处理新增的部分
          const newText = fullText.slice(lastProcessedLength);
          lastProcessedLength = fullText.length;

          // 解析新的 SSE 数据
          const lines = newText.split('\n');
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('event:')) {
              currentEvent = trimmedLine.slice(6).trim();
            } else if (trimmedLine.startsWith('data:')) {
              const dataStr = trimmedLine.slice(5).trim();
              if (!dataStr) continue;
              try {
                const data = JSON.parse(dataStr);

                if (currentEvent === 'outline' && onOutline) {
                  outlineCount++;
                  onOutline(data);
                } else if (currentEvent === 'done') {
                  if (onComplete) {
                    onComplete(data.count || outlineCount);
                  }
                  resolve();
                } else if (currentEvent === 'error') {
                  if (onError) {
                    onError(data.error || '生成失败');
                  }
                  reject(new Error(data.error));
                }
              } catch (e) {
                // JSON 解析失败，跳过（可能是不完整的数据）
              }
            }
          }
        }
      };

      xhr.onerror = () => {
        if (onError) {
          onError('网络请求失败');
        }
        reject(new Error('网络请求失败'));
      };

      xhr.ontimeout = () => {
        if (onError) {
          onError('请求超时');
        }
        reject(new Error('请求超时'));
      };

      xhr.timeout = 120000; // 2分钟超时

      // 发送请求
      xhr.send(JSON.stringify({
        requirement,
        language,
        agent_ids: agents?.map(a => a.id),
        web_search: webSearch,
      }));
    });
  }

  // 非流式生成大纲（作为备用）
  async generateOutlines(
    requirement: string,
    language: string = 'zh-CN',
    agents?: Array<{ id: string; name: string; role: string; persona: string }>,
    webSearch?: boolean,
  ) {
    const { data } = await this.client.post('/generate/outlines', {
      requirement,
      language,
      agent_ids: agents?.map(a => a.id),
      web_search: webSearch,
    });
    return data;
  }

  // ==================== Generation ====================

  /**
   * Generate agent profiles for a course stage
   *
   * @param stageInfo - Stage information with name and description
   * @param language - Language code (zh-CN or en-US)
   * @param sceneOutlines - Optional scene outlines for context
   * @param availableAvatars - List of available avatar paths (required by backend)
   * @param avatarDescriptions - Optional avatar descriptions for smart matching
   * @param availableVoices - Optional available voices for TTS configuration
   */
  async generateAgentProfiles(
    stageInfo: { name: string; description?: string },
    language: string = 'zh-CN',
    sceneOutlines?: { title: string; description?: string }[],
    availableAvatars?: string[],
    avatarDescriptions?: Array<{ path: string; desc: string }>,
    availableVoices?: Array<{ providerId: string; voiceId: string; voiceName: string }>
  ) {
    // Use default avatars if not provided
    const defaultAvatars = [
      '/avatars/teacher.png',
      '/avatars/assist.png',
      '/avatars/curious.png',
      '/avatars/thinker.png',
      '/avatars/note-taker.png',
      '/avatars/teacher-2.png',
      '/avatars/assist-2.png',
      '/avatars/curious-2.png',
      '/avatars/thinker-2.png',
      '/avatars/note-taker-2.png',
    ];

    // LLM 调用需要更长时间，设置 120 秒超时
    const { data } = await this.client.post('/generate/agent-profiles', {
      stageInfo,
      language,
      sceneOutlines,
      availableAvatars: availableAvatars || defaultAvatars,
      avatarDescriptions,
      availableVoices,
    }, {
      timeout: 120000, // 120 秒
    });
    return data;
  }

  // Legacy method for backward compatibility (deprecated)
  async generateAgentProfilesLegacy(stageName: string, stageDescription?: string, sceneOutlines?: any[], language?: string) {
    return this.generateAgentProfiles(
      { name: stageName, description: stageDescription },
      language || 'zh-CN',
      sceneOutlines
    );
  }

  async getDefaultAgents(language?: string) {
    const { data } = await this.client.get('/generate/default-agents', {
      params: { language: language || 'zh-CN' },
    });
    return data;
  }

  async generateScenes(outlines: any[], options?: Record<string, any>) {
    // LLM 调用需要更长时间
    const { data } = await this.client.post('/generate/scenes', {
      outlines,
      ...options,
    }, {
      timeout: 180000, // 180 秒（可能生成多个场景）
    });
    return data;
  }

  async startGenerationJob(requirement: string, options?: Record<string, any>) {
    const { data } = await this.client.post('/generate/classroom', {
      requirement,
      ...options,
    }, {
      timeout: 30000, // 只是启动任务，不需要长超时
    });
    return data;
  }

  async getGenerationJob(jobId: string) {
    const { data } = await this.client.get(`/generate/classroom/${jobId}`);
    return data;
  }

  // ==================== Scene + Actions + TTS ====================

  /**
   * Generate a complete scene with actions and optional TTS audio
   *
   * @param outline - Scene outline (title, type, description, order)
   * @param agents - Agent configurations
   * @param language - Language code
   * @param generateTts - Whether to pre-generate TTS audio
   * @param ttsProvider - TTS provider (openai, minimax)
   * @param ttsVoice - Voice ID for TTS
   */
  async generateSceneWithActions(
    outline: { id: string; title: string; type: string; description?: string; order?: number },
    agents: any[] = [],
    language: string = 'zh-CN',
    generateTts: boolean = true,
    ttsProvider: string = 'openai',
    ttsVoice: string = 'alloy',
  ) {
    // LLM + TTS 生成需要更长时间
    const { data } = await this.client.post('/generate/scene-with-actions', {
      outline,
      agents,
      language,
      generate_tts: generateTts,
      tts_provider: ttsProvider,
      tts_voice: ttsVoice,
    }, {
      timeout: 120000, // 120 秒
    });
    return data.scene;
  }

  /**
   * Generate TTS audio for a text (on-demand)
   *
   * @param text - Text to convert to speech
   * @param audioId - Unique audio ID (optional)
   * @param provider - TTS provider (qwen, openai, minimax, voxcpm)
   * @param voice - Voice ID (Cherry, Ethan, alloy, voxcpm:auto, etc.)
   * @param speed - Speech speed (0.5-2.0)
   * @param model - TTS model (qwen3-tts-flash, tts-1, VoxCPM2, etc.)
   * @param options - Provider-specific options (VoxCPM backend, voicePrompt, etc.)
   */
  async generateTTS(
    text: string,
    audioId?: string,
    provider: string = 'qwen',
    voice: string = 'Cherry',
    speed: number = 1.0,
    model?: string,
    options?: {
      backend?: 'vllm-omni' | 'python-api' | 'nano-vllm';
      voicePrompt?: string;
      referenceAudioBase64?: string;
    },
  ) {
    const { data } = await this.client.post('/tts', {
      text,
      audioId,
      provider,
      voice,
      speed,
      model: model || (provider === 'qwen' ? 'qwen3-tts-flash' : 'tts-1'),
      // VoxCPM2 特有参数
      backend: options?.backend,
      voicePrompt: options?.voicePrompt,
      referenceAudioBase64: options?.referenceAudioBase64,
    });
    return data; // { success, audioId, base64, format }
  }

  /**
   * Get available TTS voices
   */
  async getTTSVoices() {
    const { data } = await this.client.get('/tts/voices');
    return data.voices; // { qwen: [...], openai: [...], minimax: [...] }
  }

  // ==================== Chat (SSE) ====================

  /**
   * SSE 流式 Agent 对话（与Web端一致的实现）
   * 使用 /chat API，支持多 Agent 讨论
   */
  async streamAgentChat(
    messages: Array<{ role: string; content: string }>,
    config: { agentIds?: string[]; agentPersonas?: Record<string, string> },
    storeState: { stage?: { name: string }; scene?: { title: string } },
    onEvent?: (event: { type: string; agent_id?: string; text?: string; content?: string }) => void,
    onComplete?: (response: string) => void,
    onError?: (error: string) => void,
  ): Promise<void> {
    const url = `${this.getBaseUrl()}/chat`;
    const token = this.token;

    if (!token) {
      if (onError) onError('请先登录');
      return Promise.reject(new Error('未登录'));
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache');

      let lastProcessedLength = 0;
      let currentEvent = '';
      let fullResponse = '';

      xhr.onreadystatechange = () => {
        if (xhr.readyState >= 3) {
          // Check HTTP status first
          if (xhr.readyState === 4 && xhr.status !== 200) {
            if (xhr.status === 401) {
              if (onError) onError('登录已过期');
              reject(new Error('Token expired'));
            } else {
              if (onError) onError(`请求失败: ${xhr.status}`);
              reject(new Error(`HTTP ${xhr.status}`));
            }
            return;
          }

          const fullText = xhr.responseText;
          const newText = fullText.slice(lastProcessedLength);
          lastProcessedLength = fullText.length;

          const lines = newText.split('\n');
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('event:')) {
              currentEvent = trimmedLine.slice(6).trim();
            } else if (trimmedLine.startsWith('data:')) {
              const dataStr = trimmedLine.slice(5).trim();
              if (!dataStr) continue;
              try {
                const data = JSON.parse(dataStr);

                if (currentEvent === 'start') {
                  if (onEvent) onEvent({ type: 'start', agent_id: data.agent_id });
                } else if (currentEvent === 'text_delta') {
                  fullResponse = data.text || '';
                  if (onEvent) onEvent({ type: 'text_delta', agent_id: data.agent_id, text: data.text });
                } else if (currentEvent === 'response_complete') {
                  fullResponse = data.content || fullResponse;
                  if (onEvent) onEvent({ type: 'response_complete', agent_id: data.agent_id, content: data.content });
                } else if (currentEvent === 'end') {
                  if (onComplete) onComplete(fullResponse);
                  resolve();
                } else if (currentEvent === 'error') {
                  if (onError) onError(data.error || '对话失败');
                  reject(new Error(data.error));
                }
              } catch (e) {
                // JSON 解析失败，跳过
              }
            }
          }
        }
      };

      xhr.onerror = () => {
        if (onError) onError('网络请求失败');
        reject(new Error('网络请求失败'));
      };

      xhr.ontimeout = () => {
        if (onError) onError('请求超时');
        reject(new Error('请求超时'));
      };

      xhr.timeout = 60000; // 60秒超时

      // 发送请求（格式与 Web端一致）
      xhr.send(JSON.stringify({
        messages,
        config,
        storeState,
        model: 'gpt-4o-mini', // 使用与 Web端一致的模型
      }));
    });
  }

  // Legacy method - 保留向后兼容
  streamChat(messages: any[], config: any, storeState: any) {
    const url = `${API_BASE_URL}/chat`;
    return {
      url,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, config, storeState }),
    };
  }

  // ==================== Token Economy ====================

  async getTokenBalance() {
    const { data } = await this.client.get('/tokens/balance');
    return data;
  }

  async getTokenTransactions(limit?: number, offset?: number) {
    const { data } = await this.client.get('/tokens/transactions', {
      params: { limit, offset },
    });
    return data;
  }

  async exchangeTokens(points: number) {
    const { data } = await this.client.post('/tokens/exchange', { points });
    return data;
  }

  async getTokenPackages() {
    const { data } = await this.client.get('/tokens/packages');
    return data;
  }

  async purchaseTokens(packageId: string) {
    const { data } = await this.client.post('/tokens/purchase', { package_id: packageId });
    return data;
  }

  // ==================== Points Economy ====================

  async getPointsBalance() {
    const { data } = await this.client.get('/points/balance');
    return data;
  }

  async getPointsTransactions(limit?: number, offset?: number) {
    const { data } = await this.client.get('/points/transactions', {
      params: { limit, offset },
    });
    return data;
  }

  async getPointsSources() {
    const { data } = await this.client.get('/points/sources');
    return data;
  }

  async claimNewUserPackage() {
    const { data } = await this.client.post('/points/new_user_package');
    return data;
  }

  // ==================== Questions ====================

  async getQuestions(page?: number, limit?: number, sort?: string) {
    const { data } = await this.client.get('/questions', {
      params: { page, limit, sort },
    });
    return data;
  }

  async getQuestion(id: string) {
    const { data } = await this.client.get(`/questions/${id}`);
    return data;
  }

  async createQuestion(title: string, content: string, bounty?: number, tags?: string) {
    const { data } = await this.client.post('/questions', { title, content, bounty, tags });
    return data;
  }

  // ==================== Answers ====================

  async getAnswers(questionId: string) {
    const { data } = await this.client.get(`/answers/question/${questionId}`);
    return data;
  }

  async createAnswer(questionId: string, content: string) {
    const { data } = await this.client.post('/answers', { question_id: questionId, content });
    return data;
  }

  async voteAnswer(answerId: string, vote: number) {
    const { data } = await this.client.post(`/answers/${answerId}/vote`, { vote });
    return data;
  }

  async acceptAnswer(answerId: string) {
    const { data } = await this.client.post(`/answers/${answerId}/accept`);
    return data;
  }

  // ==================== Invitations ====================

  async getMyInviteCode() {
    const { data } = await this.client.get('/invitations/my-code');
    return data;
  }

  async getInvitationStats() {
    const { data } = await this.client.get('/invitations/stats');
    return data;
  }

  async applyInviteCode(code: string) {
    const { data } = await this.client.post('/invitations/apply', { code });
    return data;
  }

  // ==================== Payment ====================

  async getPaymentPackages() {
    const { data } = await this.client.get('/payment/packages');
    return data;
  }

  async createPaymentOrder(packageId: string, paymentMethod: string) {
    const { data } = await this.client.post('/payment/create-order', {
      package_id: packageId,
      payment_method: paymentMethod,
    });
    return data;
  }

  async getPaymentOrders() {
    const { data } = await this.client.get('/payment/orders');
    return data;
  }

  async mockPayment(orderId: string) {
    const { data } = await this.client.post(`/payment/mock-pay/${orderId}`);
    return data;
  }

  // ==================== Buddy ====================

  async getBuddyTypes() {
    const { data } = await this.client.get('/buddy/types');
    return data;
  }

  async getMyBuddyConfig() {
    const { data } = await this.client.get('/buddy/my-config');
    return data;
  }

  async setBuddyConfig(buddyType: string, buddyName?: string, toneStyle?: string) {
    const { data } = await this.client.post('/buddy/config', {
      buddy_type: buddyType,
      buddy_name: buddyName,
      tone_style: toneStyle,
    });
    return data;
  }

  async getBuddyMessages(page?: number, limit?: number, unreadOnly?: boolean) {
    const { data } = await this.client.get('/buddy/messages', {
      params: { page, limit, unread_only: unreadOnly },
    });
    return data;
  }

  async markBuddyMessageRead(messageId: string) {
    const { data } = await this.client.post(`/buddy/messages/${messageId}/read`);
    return data;
  }

  // ==================== Notes ====================

  async getNotes(page?: number, limit?: number, sort?: string) {
    const { data } = await this.client.get('/notes', {
      params: { page, limit, sort },
    });
    return data;
  }

  async getNote(id: string) {
    const { data } = await this.client.get(`/notes/${id}`);
    return data;
  }

  async publishNote(title: string, content: string, visibility?: string, price?: number, tags?: string) {
    const { data } = await this.client.post('/notes', {
      title,
      content,
      visibility,
      price,
      tags,
    });
    return data;
  }

  async purchaseNote(noteId: string) {
    const { data } = await this.client.post(`/notes/${noteId}/purchase`);
    return data;
  }

  async rateNote(noteId: string, rating: number) {
    const { data } = await this.client.post(`/notes/${noteId}/rating`, { rating });
    return data;
  }

  async getMyNoteEarnings() {
    const { data } = await this.client.get('/notes/my/earnings');
    return data;
  }

  // ==================== Matching ====================

  async getMatchingPreferences() {
    const { data } = await this.client.get('/matching/preferences');
    return data;
  }

  async setMatchingPreferences(goalTags: string[], courseIds: string[], progressLevel: string, schedulePreference: string) {
    const { data } = await this.client.post('/matching/preferences', {
      goal_tags: goalTags,
      course_ids: courseIds,
      progress_level: progressLevel,
      schedule_preference: schedulePreference,
    });
    return data;
  }

  async searchMatches() {
    const { data } = await this.client.post('/matching/search');
    return data;
  }

  async getPendingMatches() {
    const { data } = await this.client.get('/matching/pending');
    return data;
  }

  async acceptMatch(matchId: string) {
    const { data } = await this.client.post(`/matching/${matchId}/accept`);
    return data;
  }

  async rejectMatch(matchId: string) {
    const { data } = await this.client.post(`/matching/${matchId}/reject`);
    return data;
  }

  async getAcceptedMatches() {
    const { data } = await this.client.get('/matching/accepted');
    return data;
  }

  // ==================== Gamification ====================

  async getMyLeague() {
    const { data } = await this.client.get('/gamification/league');
    return data;
  }

  async getLeagueLeaderboard(tier?: string) {
    const { data } = await this.client.get('/gamification/league/leaderboard', {
      params: { tier },
    });
    return data;
  }

  async getDailyTasks() {
    const { data } = await this.client.get('/gamification/tasks');
    return data;
  }

  async updateTaskProgress(taskId: string, progress: number) {
    const { data } = await this.client.post(`/gamification/tasks/${taskId}/progress`, { progress });
    return data;
  }

  async completeCheckinTask() {
    const { data } = await this.client.post('/gamification/tasks/checkin-complete');
    return data;
  }

  async getStreakRewards(streak?: number) {
    const { data } = await this.client.get('/gamification/streak-rewards', {
      params: { streak },
    });
    return data;
  }

  async getCelebrationEffect(eventType: string, points?: number, name?: string) {
    const { data } = await this.client.get(`/gamification/celebration/${eventType}`, {
      params: { points, name },
    });
    return data;
  }

  async checkHiddenAchievements(triggerType: string, context?: Record<string, any>) {
    const { data } = await this.client.post('/gamification/check-hidden-achievements', {
      trigger_type: triggerType,
      context,
    });
    return data;
  }

  async completeTaskWithCelebration(taskId: string, progress: number) {
    const { data } = await this.client.post(`/gamification/tasks/${taskId}/complete-with-celebration`, { progress });
    return data;
  }

  async getGamificationOverview() {
    const { data } = await this.client.get('/gamification/overview');
    return data;
  }

  async getRarityLevels() {
    const { data } = await this.client.get('/gamification/rarity-levels');
    return data;
  }

  // ==================== Checkin ====================

  async dailyCheckin() {
    const { data } = await this.client.post('/checkin/checkin');
    return data;
  }

  async getCheckinStatus() {
    const { data } = await this.client.get('/checkin/me');
    return data;
  }

  async getCheckinLeaderboard() {
    const { data } = await this.client.get('/checkin/leaderboard');
    return data;
  }

  // ==================== Achievements ====================

  async getAchievements() {
    const { data } = await this.client.get('/achievements');
    return data;
  }

  async getMyAchievements() {
    const { data } = await this.client.get('/achievements/me');
    return data;
  }

  async getAchievementProgress() {
    const { data } = await this.client.get('/achievements/me/progress');
    return data;
  }

  async checkAchievements() {
    const { data } = await this.client.post('/achievements/check');
    return data;
  }

  // ==================== Subscriptions ====================

  async getSubscriptionStatus() {
    const { data } = await this.client.get('/subscriptions/status');
    return data;
  }

  async getSubscriptionFeatures() {
    const { data } = await this.client.get('/subscriptions/features');
    return data;
  }

  async startTrial() {
    const { data } = await this.client.post('/subscriptions/trial');
    return data;
  }

  // ==================== Assessments ====================

  async getAssessmentTypes() {
    const { data } = await this.client.get('/assessments/types');
    return data;
  }

  async createAssessment(courseId: string, assessmentType: string) {
    const { data } = await this.client.post('/assessments/create', {
      course_id: courseId,
      assessment_type: assessmentType,
    });
    return data;
  }

  async getAssessment(assessmentId: string) {
    const { data } = await this.client.get(`/assessments/${assessmentId}`);
    return data;
  }

  async submitAssessment(assessmentId: string, answers: any[]) {
    const { data } = await this.client.post('/assessments/submit', {
      assessment_id: assessmentId,
      answers,
    });
    return data;
  }

  async getAssessmentResults(courseId: string) {
    const { data } = await this.client.get(`/assessments/results/${courseId}`);
    return data;
  }

  async getAssessmentStats() {
    const { data } = await this.client.get('/assessments/stats');
    return data;
  }

  // ==================== Course Recommendations ====================

  async markCourseCompleted(courseId: string, body?: any) {
    const { data } = await this.client.post(`/recommendations/completions/${courseId}`, body || {});
    return data;
  }

  async getMyCompletions() {
    const { data } = await this.client.get('/recommendations/completions');
    return data;
  }

  async getCourseRecommendations(courseId: string) {
    const { data } = await this.client.get(`/recommendations/${courseId}/recommendations`);
    return data;
  }

  async getMyLearningPaths() {
    const { data } = await this.client.get('/recommendations/paths');
    return data;
  }

  async createLearningPath(name: string, courseIds: string[], description?: string) {
    const { data } = await this.client.post('/recommendations/paths', {
      name,
      course_ids: courseIds,
      description,
    });
    return data;
  }

  // ==================== Review (Spaced Repetition) ====================

  async getReviewSchedules(status?: string) {
    const { data } = await this.client.get('/review/schedules', {
      params: { status },
    });
    return data;
  }

  async getReviewRecords(courseId?: string) {
    const { data } = await this.client.get('/review/records', {
      params: { course_id: courseId },
    });
    return data;
  }

  async startReview(scheduleId: string) {
    const { data } = await this.client.post(`/review/start/${scheduleId}`);
    return data;
  }

  async completeReview(scheduleId: string, effectivenessRating?: number, notes?: string) {
    const { data } = await this.client.post('/review/complete', {
      schedule_id: scheduleId,
      effectiveness_rating: effectivenessRating,
      notes,
    });
    return data;
  }

  async getReviewStats() {
    const { data } = await this.client.get('/review/stats');
    return data;
  }

  // ==================== Learning Passport ====================

  async getMyPassport() {
    const { data } = await this.client.get('/passport/me');
    return data;
  }

  async getPassportSkills() {
    const { data } = await this.client.get('/passport/skills');
    return data;
  }

  async getSkillPassport(skillName: string) {
    const { data } = await this.client.get(`/passport/skill/${skillName}`);
    return data;
  }

  async createProjectPortfolio(projectName: string, projectType: string, description?: string, contentUrl?: string) {
    const { data } = await this.client.post('/passport/projects', {
      project_name: projectName,
      project_type: projectType,
      description,
      content_url: contentUrl,
    });
    return data;
  }

  async getMyProjects() {
    const { data } = await this.client.get('/passport/projects/me');
    return data;
  }

  async requestSkillAssessment(skillName: string) {
    const { data } = await this.client.post('/passport/assess', {
      skill_name: skillName,
    });
    return data;
  }

  // ==================== Enterprise ====================

  async getMyEnterprise() {
    const { data } = await this.client.get('/enterprise/my');
    return data;
  }

  async createEnterprise(name: string, industry?: string, size?: string, planType?: string) {
    const { data } = await this.client.post('/enterprise/', {
      name,
      industry,
      size,
      plan_type: planType || 'basic',
      contact_email: '', // will be filled from user
    });
    return data;
  }

  async getEnterpriseDetail(enterpriseId: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}`);
    return data;
  }

  async getEnterpriseMembers(enterpriseId: string, role?: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}/members`, {
      params: { role },
    });
    return data;
  }

  async inviteEnterpriseMembers(enterpriseId: string, emails: string[], role?: string) {
    const { data } = await this.client.post(`/enterprise/${enterpriseId}/members/invite`, {
      enterprise_id: enterpriseId,
      emails,
      role: role || 'member',
    });
    return data;
  }

  async getEnterpriseCourses(enterpriseId: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}/courses`);
    return data;
  }

  async getEnterpriseStats(enterpriseId: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}/stats`);
    return data;
  }

  // ==================== Note Citations ====================

  async addNoteCitation(noteId: string, sceneId: string, contentSnippet: string, citationType?: string) {
    const { data } = await this.client.post(`/notes/${noteId}/citations`, {
      note_id: noteId,
      scene_id: sceneId,
      content_snippet: contentSnippet,
      citation_type: citationType || 'direct',
    });
    return data;
  }

  async getNoteCitations(noteId: string) {
    const { data } = await this.client.get(`/notes/${noteId}/citations`);
    return data;
  }

  async getSceneCitations(sceneId: string, page?: number, limit?: number) {
    const { data } = await this.client.get(`/notes/scenes/${sceneId}/citations`, {
      params: { page, limit },
    });
    return data;
  }

  async getCourseCitationStats(courseId: string) {
    const { data } = await this.client.get(`/notes/courses/${courseId}/citation-stats`);
    return data;
  }

  async deleteNoteCitation(noteId: string, citationId: string) {
    const { data } = await this.client.delete(`/notes/${noteId}/citations/${citationId}`);
    return data;
  }

  // ==================== Video Course ====================

  async createCourseFromVideo(videoUrl: string, language?: string, depth?: string) {
    const { data } = await this.client.post('/generate/from-video', {
      video_url: videoUrl,
      language: language || 'zh-CN',
      depth: depth || 'understand',
    });
    return data;
  }

  async getVideoSources() {
    const { data } = await this.client.get('/generate/video-sources');
    return data;
  }

  async getVideoSourceStatus(videoSourceId: string) {
    const { data } = await this.client.get(`/generate/video-source/${videoSourceId}`);
    return data;
  }

  // ==================== AI Personas ====================

  async getAvailablePersonas() {
    const { data } = await this.client.get('/personas/list');
    return data;
  }

  async startPersonaSession(personaId: string, topic?: string, mode?: string) {
    // 使用 /personas/chat 接口创建会话并发送初始消息
    const { data } = await this.client.post('/personas/chat', {
      persona_id: personaId,
      message: topic || '开始学习',
      context: topic,
      mode: mode || 'teaching',
    });
    // 返回响应数据，模拟 session 概念
    return {
      session_id: Date.now().toString(), // 临时 session ID
      persona_id: personaId,
      response: data.response,
      ...data,
    };
  }

  async getPersonaSession(sessionId: string) {
    // 后端没有单次 session 查询，返回会话列表
    const { data } = await this.client.get('/personas/sessions');
    const session = data.sessions?.find((s: any) => s.session_id === sessionId);
    return session || { session_id: sessionId };
  }

  async sendPersonaMessage(sessionId: string, message: string) {
    // 直接调用 /personas/chat，sessionId 仅用于前端状态管理
    const { data } = await this.client.post('/personas/chat', {
      persona_id: sessionId.split('-')[0] || 'confucius', // 从 sessionId 提取 persona_id
      message,
      mode: 'teaching',
    });
    return data;
  }

  async chatWithPersona(personaId: string, message: string, context?: string, mode?: string, persona?: string) {
    // 直接聊天接口 - 支持历史人物和课程Agent
    const { data } = await this.client.post('/personas/chat', {
      persona_id: personaId,
      message,
      context,
      mode: mode || 'teaching',
      persona,  // 课程Agent的个性描述（可选）
    });
    return data;
  }

  async endPersonaSession(sessionId: string, rating?: number, feedback?: string) {
    const { data } = await this.client.post(`/personas/sessions/${sessionId}/feedback`, {
      rating,
      feedback,
    });
    return data;
  }

  async getPersonaSessions(personaId?: string) {
    const { data } = await this.client.get('/personas/sessions', {
      params: { persona_id: personaId },
    });
    return data;
  }

  async recommendPersona(topic: string) {
    const { data } = await this.client.get('/personas/recommend', {
      params: { topic },
    });
    return data;
  }

  // ==================== Share Cards ====================

  async createShareCard(cardType: string, referenceId: string, title: string, subtitle?: string) {
    const { data } = await this.client.post('/share-cards', {
      card_type: cardType,
      reference_id: referenceId,
      title,
      subtitle,
    });
    return data;
  }

  async getMyShareCards() {
    const { data } = await this.client.get('/share-cards/me');
    return data;
  }

  async getShareCard(cardId: string) {
    const { data } = await this.client.get(`/share-cards/${cardId}`);
    return data;
  }

  // ==================== Programming Exercises ====================

  async getProgrammingExercises(courseId: string) {
    const { data } = await this.client.get('/programming/exercises', {
      params: { course_id: courseId },
    });
    return data;
  }

  async getExerciseDetail(exerciseId: string) {
    const { data } = await this.client.get(`/programming/exercises/${exerciseId}`);
    return data;
  }

  async submitCode(exerciseId: string, code: string, language: string) {
    const { data } = await this.client.post('/programming/submit', {
      exercise_id: exerciseId,
      code,
      language,
    });
    return data;
  }

  async getMySubmissions(exerciseId?: string) {
    const { data } = await this.client.get('/programming/submissions', {
      params: { exercise_id: exerciseId },
    });
    return data;
  }

  // ==================== Depth Levels ====================

  async getDepthProgress(courseId: string) {
    const { data } = await this.client.get('/depth/progress', {
      params: { course_id: courseId },
    });
    return data;
  }

  async setCourseDepth(courseId: string, depth: string) {
    const { data } = await this.client.post('/depth/set', {
      course_id: courseId,
      depth,
    });
    return data;
  }

  async getDepthStats() {
    const { data } = await this.client.get('/depth/stats');
    return data;
  }

  // ==================== Note Reminders ====================

  async getNoteReminders(status?: string) {
    const { data } = await this.client.get('/note-reminders', {
      params: { status },
    });
    return data;
  }

  async completeNoteReminder(reminderId: string, noteId: string) {
    const { data } = await this.client.post(`/note-reminders/${reminderId}/complete`, {
      note_id: noteId,
    });
    return data;
  }

  async skipNoteReminder(reminderId: string, reason?: string) {
    const { data } = await this.client.post(`/note-reminders/${reminderId}/skip`, {
      reason,
    });
    return data;
  }

  async getReminderTemplates() {
    const { data } = await this.client.get('/note-reminders/templates');
    return data;
  }

  // ==================== Knowledge Cards ====================

  async getKnowledgeCards(skillCategory?: string) {
    const { data } = await this.client.get('/knowledge/cards', {
      params: { skill_category: skillCategory },
    });
    return data;
  }

  async getKnowledgeCard(cardId: string) {
    const { data } = await this.client.get(`/knowledge/cards/${cardId}`);
    return data;
  }

  async createKnowledgeCard(card: {
    title: string;
    content: string;
    skill_category?: string;
    summary?: string;
    key_points?: string[];
    tags?: string;
    source_type?: string;
    source_id?: string;
    scene_id?: string;
  }) {
    const { data } = await this.client.post('/knowledge/cards', card);
    return data;
  }

  async updateKnowledgeCard(cardId: string, updates: {
    title?: string;
    content?: string;
    skill_category?: string;
    summary?: string;
    key_points?: string[];
    tags?: string;
    mastery_level?: number;
  }) {
    const { data } = await this.client.put(`/knowledge/cards/${cardId}`, updates);
    return data;
  }

  async deleteKnowledgeCard(cardId: string) {
    const { data } = await this.client.delete(`/knowledge/cards/${cardId}`);
    return data;
  }

  async searchKnowledgeCards(query: string, skillCategory?: string) {
    const { data } = await this.client.get('/knowledge/search', {
      params: { q: query, skill_category: skillCategory },
    });
    return data;
  }

  async getKnowledgeStats() {
    const { data } = await this.client.get('/knowledge/stats');
    return data;
  }

  async relateKnowledgeCards(fromCardId: string, toCardId: string, relationType?: string) {
    const { data } = await this.client.post(`/knowledge/cards/${fromCardId}/relate`, {
      to_card_id: toCardId,
      relation_type: relationType || 'related',
    });
    return data;
  }

  async getKnowledgeRelations(cardId: string) {
    const { data } = await this.client.get(`/knowledge/cards/${cardId}/relations`);
    return data;
  }

  async reviewKnowledgeCard(cardId: string, masteryChange: number) {
    const { data } = await this.client.post(`/knowledge/cards/${cardId}/review`, null, {
      params: { mastery_change: masteryChange },
    });
    return data;
  }

  async extractKnowledgeFromScene(sceneId: string) {
    const { data } = await this.client.post('/knowledge/extract', {
      scene_id: sceneId,
    }, {
      timeout: 60000, // AI 提取需要时间
    });
    return data;
  }
}

export const apiClient = new ApiClient();