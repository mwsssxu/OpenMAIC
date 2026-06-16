import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { i18n } from '../i18n';
import { showReward, type RewardSource } from '@/lib/utils/reward-toast';

/**
 * 统一的奖励反馈触发器。
 * 后端在 grant_points() 后会在 response 里返回 earned_points + new_balance；
 * 这个 helper 让每个奖励接口结尾一行就能触发全局 RewardToast，
 * 业务页面无需感知反馈逻辑。
 */
function tapReward<T>(data: T, source: RewardSource): T {
  if (data && typeof data === 'object') {
    const d = data as Record<string, any>;
    const points = Number(d.earned_points ?? d.reward ?? 0);
    if (points > 0) {
      const newBalance =
        d.new_balance != null ? Number(d.new_balance) : undefined;
      showReward({ points, newBalance, source });
    }
  }
  return data;
}

// API 地址配置：
// - 生产环境：必须设置 EXPO_PUBLIC_API_URL 环境变量
// - 开发环境 Web：使用 localhost
// - 开发环境 Mobile：使用局域网 IP（真机需要访问电脑的后端服务）
const getApiBaseUrl = () => {
  // 优先使用环境变量
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 生产环境警告
  if (!__DEV__) {
    console.warn('WARNING: EXPO_PUBLIC_API_URL not set in production. Using fallback URL.');
  }

  // Web 端使用 localhost
  if (Platform.OS === 'web') {
    return 'http://127.0.0.1:8000';
  }
  // Mobile 端需要局域网 IP（真机无法访问 127.0.0.1）
  // 可以在 .env 文件中设置 EXPO_PUBLIC_API_URL
  return 'http://192.168.1.114:8000';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Get user-friendly error message based on error type
 * Provides localized, user-friendly messages for common error scenarios
 *
 * @param error - The error object from axios or other sources
 * @returns A user-friendly error message string
 */
export function getErrorMessage(error: any): string {
  // Network error (no response received)
  if (!error.response) {
    // Check for timeout
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return i18n.t('errors.timeoutError');
    }
    // Check for network connection issues
    if (error.message === 'Network Error' || error.message?.includes('Network')) {
      return i18n.t('errors.networkError');
    }
    // Generic network failure
    return i18n.t('errors.networkError');
  }

  const status = error.response.status;
  const detail = error.response?.data?.detail;

  // Authentication errors
  if (status === 401) {
    return i18n.t('errors.unauthorized');
  }

  // Authorization errors
  if (status === 403) {
    return i18n.t('errors.forbidden');
  }

  // Not found errors
  if (status === 404) {
    return detail || i18n.t('errors.notFound');
  }

  // Validation errors (400, 422)
  if (status === 400 || status === 422) {
    return detail || i18n.t('errors.validationError');
  }

  // Server errors (5xx)
  if (status >= 500) {
    return i18n.t('errors.serverError');
  }

  // Other client errors (4xx)
  if (status >= 400) {
    return detail || i18n.t('errors.requestFailed');
  }

  // Fallback to detail or generic message
  return detail || i18n.t('errors.unknownError');
}

/**
 * Check if an error is a network connectivity error
 */
export function isNetworkError(error: any): boolean {
  return !error.response && (
    error.code === 'ECONNABORTED' ||
    error.message === 'Network Error' ||
    error.message?.includes('Network') ||
    error.message?.includes('timeout')
  );
}

/**
 * Check if an error is an authentication error (token expired, etc.)
 */
export function isAuthError(error: any): boolean {
  return error.response?.status === 401;
}

/**
 * Check if an error is a server error (5xx)
 */
export function isServerError(error: any): boolean {
  return error.response?.status >= 500;
}

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

export interface CourseTag {
  name: string;
  color?: string;
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
  private refreshPromise: Promise<string | null> | null = null; // concurrency guard

  constructor() {
    // 页面刷新后从 localStorage 恢复 token（防止刷新时请求不带 Authorization 导致 403）
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('auth_token');
      if (stored) {
        this.token = stored;
      }
    }

    // 自动添加 Authorization + Accept-Language header
    this.client.interceptors.request.use((config) => {
      // 只用内存中的 token，不再从 localStorage 兜底读取
      // logout 时 setToken(null) 会同步清除 localStorage，避免旧 token 泄露
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      // 自动添加 Accept-Language（与用户当前语言设置同步）
      try {
        config.headers['Accept-Language'] = i18n.getLocale() || 'zh-CN';
      } catch {
        config.headers['Accept-Language'] = 'zh-CN';
      }
      return config;
    });

    // Token 过期自动刷新（并发安全）
    // 注意：HTTPBearer 无 token 时返回 403，也需重试
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 || (error.response?.status === 403 && error.response?.data?.detail === 'Not authenticated')) {
          // 401: token 过期；403 "Not authenticated": HTTPBearer 无 token
          // 其他 403（如权限拒绝）不重试，避免死循环
          // 如果内存中已无 token（已 logout），不再尝试刷新，避免旧 refresh_token 恢复会话
          if (!this.token) {
            return Promise.reject(error);
          }
          const newToken = await this.ensureValidToken();
          if (newToken) {
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return this.client.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  } // end constructor

  getBaseUrl(): string {
    return API_BASE_URL;
  }

  /** Generic POST — uses the authenticated axios instance */
  async post<T = any>(url: string, data?: any): Promise<{ data: T }> {
    return this.client.post(url, data);
  }

  /** Refresh token with concurrency guard — only one refresh in a time */
  private async ensureValidToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this._doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<string | null> {
    try {
      const rt = await storage.getItem('refresh_token');
      if (!rt) return null;
      const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: rt });
      const newToken = res.data?.access_token;
      if (newToken) {
        this.setToken(newToken);
        await storage.setItem('auth_token', newToken);
        if (res.data?.refresh_token) {
          await storage.setItem('refresh_token', res.data.refresh_token);
        }
        return newToken;
      }
      return null;
    } catch {
      this.setToken(null);
      await storage.deleteItem('auth_token');
      await storage.deleteItem('refresh_token');
      return null;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
      // 同步清除 localStorage 中的旧 token，防止 request interceptor 兜底读取
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
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

  async updateUser(data: { nickname?: string | null; avatar_url?: string; bio?: string | null; birthday?: string | null; gender?: string | null }) {
    const { data: resp } = await this.client.put('/auth/me', data);
    return resp;
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

  async exportClassroomPdf(id: string): Promise<Blob> {
    const { data } = await this.client.get(`/classrooms/${id}/export-pdf`, {
      responseType: 'blob',
    });
    return data as Blob;
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
      timeout: 360000, // 场景生成可能需要 200-300 秒（流式LLM调用）
    });
    return data;
  }

  // 为缺少 questions 的 quiz 场景补充生成题目
  async regenerateQuizQuestions(classroomId: string, sceneId: string): Promise<{ success: boolean; questions?: any[]; message?: string }> {
    const { data } = await this.client.post(`/classrooms/${classroomId}/scenes/${sceneId}/regenerate-quiz`, {}, {
      timeout: 120000,
    });
    return data;
  }

  async createAllScenes(classroomId: string, outlines: any[], language?: string, agents?: any[]) {
    const config = {
      outlines,
      language: language || 'zh-CN',
      agents,
    };
    const maxRetries = 1;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data } = await this.client.post(`/classrooms/${classroomId}/scenes/create-all`, config, {
          timeout: 600000,
        });
        return data;
      } catch (err: any) {
        if (attempt < maxRetries) {
          console.warn(`[createAllScenes] 第 ${attempt + 1} 次尝试失败，重试中...`, err.message);
          await new Promise(r => setTimeout(r, 3000));
        } else {
          throw err;
        }
      }
    }
  }

  async updateClassroom(id: string, name?: string, description?: string) {
    const { data } = await this.client.put(`/classrooms/${id}`, { name, description });
    return data;
  }

  async deleteClassroom(id: string) {
    const { data } = await this.client.delete(`/classrooms/${id}`);
    return data;
  }

  // 切换课程公开/私有
  async toggleClassroomVisibility(classroomId: string, isPublic: boolean) {
    const { data } = await this.client.patch(`/classrooms/${classroomId}/visibility`, { is_public: isPublic });
    return data;
  }

  // 收藏/取消收藏课程
  async toggleClassroomLike(classroomId: string) {
    const { data } = await this.client.post(`/classrooms/${classroomId}/like`);
    return data;
  }

  // 给公开课程打分
  async rateSharedClassroom(shareCode: string, rating: number) {
    const { data } = await this.client.post(`/sharing/share/${shareCode}/rate`, { rating });
    return data;
  }

  // 发现公开课程
  async discoverSharedClassrooms(limit: number = 10) {
    const { data } = await this.client.get('/sharing/discover', { params: { limit } });
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
    pdfContent?: string,
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
      let resolved = false;

      xhr.onreadystatechange = () => {
        if (xhr.readyState >= 3) {
          // 处理响应（readyState 3 = 正在接收，4 = 完成）
          const fullText = xhr.responseText;

          // 检查 HTTP 状态码
          if (xhr.readyState === 4 && xhr.status === 401) {
            // Token 过期，尝试刷新并重试
            this.ensureValidToken().then(newToken => {
              if (newToken) {
                // 用新 token 重试一次
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Authorization', `Bearer ${newToken}`);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Accept', 'text/event-stream');
                xhr.setRequestHeader('Cache-Control', 'no-cache');
                lastProcessedLength = 0;
                outlineCount = 0;
                currentEvent = '';
                xhr.send(JSON.stringify({
                  requirement,
                  language,
                  agent_ids: agents?.map(a => a.id),
                  web_search: webSearch,
                  agents: agents,
                  pdf_content: pdfContent,
                }));
              } else {
                if (onError) onError('登录已过期，请重新登录');
                reject(new Error('Token过期'));
              }
            }).catch(() => {
              if (onError) onError('登录已过期，请重新登录');
              reject(new Error('Token过期'));
            });
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
                  resolved = true;
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

      xhr.onload = () => {
        if (resolved) return; // 已经通过 onreadystatechange 处理完毕
        // XHR 完成时，确保处理完所有剩余数据
        // 某些情况下 onreadystatechange 不会在 readyState=4 时再次触发
        const fullText = xhr.responseText;
        const newText = fullText.slice(lastProcessedLength);
        if (newText.trim()) {
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
                if (currentEvent === 'done' && onComplete) {
                  onComplete(data.count || outlineCount);
                  resolve();
                } else if (currentEvent === 'error' && onError) {
                  onError(data.error || '生成失败');
                  reject(new Error(data.error));
                }
              } catch (e) {
                // JSON 解析失败，跳过
              }
            }
          }
        }
        // 如果从未收到 done 事件但有 outlines，手动完成
        if (outlineCount > 0 && !resolved) {
          resolved = true;
          if (onComplete) {
            onComplete(outlineCount);
          }
          resolve();
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
        agents: agents,  // 传递完整agent信息用于构建teacherContext
        pdf_content: pdfContent,
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
   *
   * SSE 事件格式（与Web端一致）:
   * - data: {"type":"agent_start","data":{"messageId":"...","agentId":"..."}}
   * - data: {"type":"text_delta","data":{"messageId":"...","content":"..."}}
   * - data: {"type":"agent_end","data":{"messageId":"...","agentId":"..."}}
   * - data: {"type":"done","data":{...}}
   */
  async streamAgentChat(
    messages: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }>,
    config: {
      agentIds?: string[];
      agentPersonas?: Record<string, string>;
      sessionType?: 'chat' | 'discussion';
      discussionTopic?: string;
      discussionPrompt?: string;
    },
    storeState: { stage?: { name: string }; scene?: { title: string; content?: any } },
    onEvent?: (event: {
      type: string;
      messageId?: string;
      agentId?: string;
      content?: string;
      text?: string;
      // Action event fields
      actionId?: string;
      actionName?: string;
      params?: Record<string, any>;
    }) => void,
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
      const sendRequest = (authToken: string) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'text/event-stream');
        xhr.setRequestHeader('Cache-Control', 'no-cache');

        let lastProcessedLength = 0;
        let fullResponse = '';
        let currentMessageId: string | undefined = undefined;
        let currentAgentId: string | undefined = undefined;

        xhr.onreadystatechange = () => {
          if (xhr.readyState >= 3) {
            if (xhr.readyState === 4 && xhr.status === 401) {
              // Token expired — refresh and retry once
              this.ensureValidToken().then(newToken => {
                if (newToken) {
                  sendRequest(newToken);
                } else {
                  if (onError) onError('登录已过期，请重新登录');
                  reject(new Error('Token expired'));
                }
              }).catch(() => {
                if (onError) onError('登录已过期，请重新登录');
                reject(new Error('Token expired'));
              });
              return;
            }

            if (xhr.readyState === 4 && xhr.status !== 200) {
              if (onError) onError(`请求失败: ${xhr.status}`);
              reject(new Error(`HTTP ${xhr.status}`));
              return;
            }

            const fullText = xhr.responseText;
            const newText = fullText.slice(lastProcessedLength);
            lastProcessedLength = fullText.length;

          // 解析 SSE 数据（Web端格式：`data: {JSON}\n\n`）
          const lines = newText.split('\n');
          for (const line of lines) {
            const trimmedLine = line.trim();
            // Web端格式：`data: {JSON}`（不带 event: 字段）
            if (trimmedLine.startsWith('data: ')) {
              const dataStr = trimmedLine.slice(6).trim();
              if (!dataStr) continue;
              try {
                const event = JSON.parse(dataStr);
                const eventType = event.type;
                const eventData = event.data || {};

                if (eventType === 'agent_start') {
                  currentMessageId = eventData.messageId;
                  currentAgentId = eventData.agentId;
                  if (onEvent) onEvent({ type: 'agent_start', messageId: eventData.messageId, agentId: eventData.agentId });
                } else if (eventType === 'text_delta') {
                  // 增量文本（真正的流式）
                  const chunk = eventData.content || '';
                  fullResponse += chunk;
                  const messageId = eventData.messageId || currentMessageId;
                  if (onEvent) onEvent({ type: 'text_delta', messageId, content: chunk, agentId: currentAgentId });
                } else if (eventType === 'action') {
                  // 白板/spotlight/laser等动作
                  if (onEvent) onEvent({
                    type: 'action',
                    messageId: eventData.messageId || currentMessageId,
                    actionId: eventData.actionId,
                    actionName: eventData.actionName,
                    params: eventData.params,
                    agentId: eventData.agentId || currentAgentId,
                  });
                } else if (eventType === 'agent_end') {
                  if (onEvent) onEvent({ type: 'agent_end', messageId: eventData.messageId, agentId: eventData.agentId });
                } else if (eventType === 'done') {
                  if (onComplete) onComplete(fullResponse);
                  resolve();
                } else if (eventType === 'error') {
                  if (onError) onError(eventData.message || '对话失败');
                  reject(new Error(eventData.message));
                }
              } catch (e) {
                // JSON 解析失败，跳过（可能是 heartbeat 注释）
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

      xhr.timeout = 300000; // 300秒超时（多Agent讨论需要更长时间）

      xhr.send(JSON.stringify({
        messages,
        config,
        storeState,
      }));
      };

      // Send initial request with current token
      sendRequest(token);
    });
  }

  /**
   * 单 Agent 流式响应（分批处理讨论）
   * 每次请求约 10-20 秒，不会超时
   * 前端依次调用此 API 处理每个 agent
   */
  streamSingleAgent(
    agentId: string,
    agentRole: string,
    prompt: string,
    previousResponses: Array<{ agent: string; agentId: string; content: string }> = [],
    context: { scene_title?: string; description?: string; key_points?: string[] } = {},
    onEvent?: (event: { type: string; messageId?: string; agentId?: string; content?: string; actionName?: string; params?: any }) => void,
    onComplete?: () => void,
    onError?: (error: string) => void,
  ): Promise<void> {
    const token = this.token;
    if (!token) {
      if (onError) onError('请先登录');
      return Promise.reject(new Error('未登录'));
    }

    return new Promise((resolve, reject) => {
      const sendRequest = (authToken: string) => {
        const xhr = new XMLHttpRequest();
        const url = `${API_BASE_URL}/chat/agent-stream`;
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'text/event-stream');

        let processedLinesCount = 0;

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            if (xhr.readyState === 4 && xhr.status === 401) {
              this.ensureValidToken().then(newToken => {
                if (newToken) {
                  sendRequest(newToken);
                } else {
                  if (onError) onError('登录已过期，请重新登录');
                  reject(new Error('Token expired'));
                }
              }).catch(() => {
                if (onError) onError('登录已过期，请重新登录');
                reject(new Error('Token expired'));
              });
              return;
            }

            const text = xhr.responseText;
            const lines = text.split('\n');

            const newLines = lines.slice(processedLinesCount);
            processedLinesCount = lines.length;

            for (const line of newLines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6);
                  const data = JSON.parse(jsonStr);
                  const eventType = data.type;
                  const eventData = data.data || {};

                  if (eventType === 'agent_start') {
                    if (onEvent) onEvent({ type: 'agent_start', messageId: eventData.messageId, agentId: eventData.agentId });
                  } else if (eventType === 'text_delta') {
                    if (onEvent) onEvent({ type: 'text_delta', messageId: eventData.messageId, agentId: eventData.agentId, content: eventData.content });
                  } else if (eventType === 'action') {
                    if (onEvent) onEvent({ type: 'action', messageId: eventData.messageId, actionName: eventData.actionName, params: eventData.params, agentId: eventData.agentId });
                  } else if (eventType === 'agent_end') {
                    if (onEvent) onEvent({ type: 'agent_end', messageId: eventData.messageId, agentId: eventData.agentId, content: eventData.content });
                  }
                } catch (e) {
                  // JSON 解析失败，跳过
                }
              }
            }

            if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                if (onComplete) onComplete();
                resolve();
              } else if (xhr.status !== 401) {
                const errorMsg = xhr.status === 0 ? '网络错误' : `HTTP ${xhr.status}`;
                if (onError) onError(errorMsg);
                reject(new Error(errorMsg));
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

        xhr.timeout = 120000; // 120秒超时（LLM响应可能需要较长时间）

        xhr.send(JSON.stringify({
          agentId,
          agentRole,
          prompt,
          previousResponses,
          context,
        }));
      };

      sendRequest(token);
    });
  }

  /**
   * 多 Agent 轮流讨论
   * 调用 /chat/discussion API，依次获取多个 Agent 的回复
   *
   * @param topic - 讨论主题
   * @param agents - Agent ID 列表 ['teacher', 'student', 'assistant']
   * @param maxTurns - 最大轮次（每个 Agent 发言次数）
   * @param context - 场景上下文（标题、内容、要点等）
   * @param onResponse - 每个 Agent 回复时的回调
   */
  async runMultiAgentDiscussion(
    topic: string,
    agents: string[] = ['teacher', 'student', 'assistant'],
    maxTurns: number = 2,
    context?: {
      scene_title?: string;
      scene_type?: string;
      scene_content?: any;
      key_points?: string[];
      description?: string;
    },
    onResponse?: (response: { agent_id: string; agent_role: string; content: string; actions: any[] }) => void,
  ): Promise<Array<{ agent_id: string; agent_role: string; content: string; actions: any[] }>> {
    const { data } = await this.client.post('/chat/discussion', {
      topic,
      agents,
      maxTurns,
      context, // 传递场景上下文
    }, {
      timeout: 120000, // 多 Agent讨论需要更长超时
    });

    // 依次触发回调
    if (onResponse && data.responses) {
      for (const response of data.responses) {
        onResponse(response);
      }
    }

    return data.responses || [];
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

  async getAccountOverview() {
    const { data } = await this.client.get('/tokens/overview');
    return data;
  }

  async getTokenTransactions(limit?: number, offset?: number) {
    const { data } = await this.client.get('/tokens/transactions', {
      params: { limit, offset },
    });
    return data;
  }

  async exchangeTokens(tier: 'small' | 'standard' | 'large') {
    const { data } = await this.client.post('/tokens/exchange', { tier });
    return data;
  }

  async getTokenPackages() {
    const { data } = await this.client.get('/tokens/packages');
    return data;
  }

  async purchaseTokens(packageId: string, paymentMethod: string = 'wechat') {
    const { data } = await this.client.post('/tokens/purchase', { package: packageId, payment_method: paymentMethod });
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
    const { data } = await this.client.get('/questions/', {
      params: { page, limit, sort },
    });
    return data;
  }

  async getQuestion(id: string) {
    const { data } = await this.client.get(`/questions/${id}`);
    return data;
  }

  async createQuestion(title: string, content: string, bounty?: number, tags?: string) {
    const { data } = await this.client.post('/questions/', { title, content, bounty, tags });
    return data;
  }

  // ==================== Answers ====================

  async getAnswers(questionId: string, sort?: string) {
    const params = sort ? `?sort=${sort}` : '';
    const { data } = await this.client.get(`/answers/question/${questionId}${params}`);
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
    const { data } = await this.client.post('/invitations/apply', { invite_code: code });
    return data;
  }

  // ==================== Payment ====================

  async getPaymentPackages() {
    const { data } = await this.client.get('/payment/packages');
    return data;
  }

  async createPaymentOrder(packageId: string, paymentMethod: string, type: 'token' | 'subscription' = 'token') {
    const { data } = await this.client.post('/payment/create-order', {
      type,
      package: packageId,
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

  async buddyDeepChat(message: string, buddyType?: string, withAudio?: boolean) {
    const { data } = await this.client.post('/buddy/deep-chat', {
      message,
      buddy_type: buddyType,
      with_audio: withAudio || false,
    }, {
      timeout: 60000,
    });
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

  async reportLearningTime(minutes: number, stageId?: string) {
    const { data } = await this.client.post('/gamification/report-learning-time', {
      minutes,
      stage_id: stageId,
    });
    return data;
  }

  async trackChat() {
    const { data } = await this.client.post('/chat/track-chat');
    return data;
  }

  async getLearningProfile() {
    const { data } = await this.client.get('/gamification/learning-profile');
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
    return tapReward(data, 'assessment');
  }

  // ============ Mistake Review (错题复习) ============

  async getTodayMistakes(limit: number = 10) {
    const { data } = await this.client.get('/mistakes/today', { params: { limit } });
    return data as {
      items: Array<{
        id: string;
        course_id: string | null;
        question_id: string;
        question: {
          id: string;
          type?: string;
          content?: string;
          options?: string[];
          correct_answer?: string;
          explanation?: string;
          difficulty?: string;
          points?: number;
        };
        attempt_count: number;
        wrong_count: number;
        correct_streak: number;
        next_review_at: string | null;
        last_reviewed_at: string | null;
      }>;
      stats: { total: number; mastered_count: number; due_count: number };
    };
  }

  async getMistakeStats() {
    const { data } = await this.client.get('/mistakes/stats');
    return data as { total: number; mastered_count: number; due_count: number };
  }

  async answerMistake(mistakeId: string, answer: string) {
    const { data } = await this.client.post(`/mistakes/${mistakeId}/answer`, { answer });
    // tapReward 会读 earned_points + new_balance 自动弹 RewardToast
    return tapReward(data, 'mistake_review') as {
      is_correct: boolean;
      correct_answer: string;
      explanation: string | null;
      mastered: boolean;
      correct_streak: number;
      wrong_count: number;
      next_review_at: string | null;
      earned_points: number;
      new_balance: number | null;
    };
  }

  async getMistakeList(opts?: { course_id?: string; only_unmastered?: boolean; limit?: number; offset?: number }) {
    const { data } = await this.client.get('/mistakes/list', { params: opts });
    return data as {
      items: Array<{
        id: string;
        course_id: string | null;
        question_id: string;
        question: any;
        attempt_count: number;
        wrong_count: number;
        correct_streak: number;
        mastered: boolean;
        next_review_at: string | null;
        last_reviewed_at: string | null;
        first_wrong_at: string | null;
      }>;
    };
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

  async createEnterprise(name: string, industry?: string, size?: string, planType?: string, contactEmail?: string) {
    const { data } = await this.client.post('/enterprise/', {
      name,
      industry,
      size,
      plan_type: planType || 'basic',
      ...(contactEmail ? { contact_email: contactEmail } : {}),
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

  async updateEnterpriseMemberRole(enterpriseId: string, memberId: string, role: string) {
    const { data } = await this.client.post(`/enterprise/${enterpriseId}/members/${memberId}/role`, { role });
    return data;
  }

  async removeEnterpriseMember(enterpriseId: string, memberId: string) {
    const { data } = await this.client.delete(`/enterprise/${enterpriseId}/members/${memberId}`);
    return data;
  }

  async assignEnterpriseCourses(enterpriseId: string, courseIds: string[], memberIds?: string[]) {
    const { data } = await this.client.post(`/enterprise/${enterpriseId}/courses/assign`, {
      course_ids: courseIds,
      member_ids: memberIds,
    });
    return data;
  }

  async getEnterpriseLearningReport(enterpriseId: string) {
    const { data } = await this.client.get(`/enterprise/${enterpriseId}/reports/learning`);
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
    return tapReward(data, 'persona_feedback');
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
    return tapReward(data, 'share_card');
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
    return tapReward(data, 'programming');
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
    return tapReward(data, 'note_reminder');
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

  // ==================== Personal Notes ====================

  async getPersonalNotes(page?: number, limit?: number, filter?: string, starredOnly?: boolean, includeShared?: boolean) {
    const { data } = await this.client.get('/personal-notes', {
      params: { page, limit, filter, starred_only: starredOnly, include_shared: includeShared },
    });
    return data;
  }

  async getPersonalNote(noteId: string) {
    const { data } = await this.client.get(`/personal-notes/${noteId}`);
    return data;
  }

  async createPersonalNote(note: {
    title: string;
    content: string;
    course_id?: string;
    category?: string;
    tags?: string[];
    starred?: boolean;
    color?: string;
  }) {
    const { data } = await this.client.post('/personal-notes', note);
    return data;
  }

  async toggleNoteStar(noteId: string) {
    const { data } = await this.client.post(`/personal-notes/${noteId}/star`);
    return data;
  }

  async updatePersonalNote(noteId: string, updates: {
    title?: string;
    content?: string;
    category?: string;
    tags?: string[];
    starred?: boolean;
    color?: string;
  }) {
    const { data } = await this.client.put(`/personal-notes/${noteId}`, updates);
    return data;
  }

  // AI 优化笔记内容（返回优化结果，不直接修改）
  async aiOptimizeNote(noteId: string, requirement?: string) {
    const { data } = await this.client.post(`/personal-notes/${noteId}/ai-optimize`, {
      requirement: requirement || '',
    });
    return data;
  }

  async deletePersonalNote(noteId: string) {
    const { data } = await this.client.delete(`/personal-notes/${noteId}`);
    return data;
  }

  async getNotesStats() {
    const { data } = await this.client.get('/personal-notes/stats');
    return data;
  }

  // ==================== Shared Notes (共享笔记) ====================

  // 获取共享笔记列表（市场）
  async getSharedNotes(params?: {
    page?: number;
    limit?: number;
    visibility?: string;
    sort?: string;
    search?: string;
  }) {
    const { data } = await this.client.get('/notes/', { params });
    return data;
  }

  // 获取共享笔记详情
  async getSharedNoteDetail(noteId: string) {
    const { data } = await this.client.get(`/notes/${noteId}`);
    return data;
  }

  // 购买共享笔记
  async purchaseSharedNote(noteId: string) {
    const { data } = await this.client.post(`/notes/${noteId}/purchase`);
    return data;
  }

  // 评分共享笔记
  async rateSharedNote(noteId: string, rating: number) {
    const { data } = await this.client.post(`/notes/${noteId}/rating`, { rating });
    return data;
  }

  // 获取我发布的共享笔记
  async getMySharedNotes() {
    const { data } = await this.client.get('/notes/my-shares');
    return data;
  }

  // 发布共享笔记
  async createSharedNote(note: {
    title: string;
    content: string;
    course_id?: string;
    visibility?: 'public' | 'paid';
    price?: number;
    tags?: string;
  }) {
    const { data } = await this.client.post('/notes/', note);
    return data;
  }

  // 获取共享笔记收益统计
  async getMyEarnings() {
    const { data } = await this.client.get('/notes/my/earnings');
    return data;
  }

  // 将个人笔记转为共享笔记
  async convertToSharedNote(personalNoteId: string, options: {
    visibility: 'public' | 'paid';
    price?: number;
  }) {
    // 先获取个人笔记内容
    const personalNote = await this.getPersonalNote(personalNoteId);
    // 创建共享笔记
    return this.createSharedNote({
      title: personalNote.title,
      content: personalNote.content,
      course_id: personalNote.course_id,
      visibility: options.visibility,
      price: options.price || 0,
    });
  }

  // ==================== Profile ====================

  async getProfileOverview() {
    const { data } = await this.client.get('/profile/overview');
    return data;
  }

  async getWeeklyStudy() {
    const { data } = await this.client.get('/profile/weekly-study');
    return data;
  }

  async getProfileAchievements() {
    const { data } = await this.client.get('/profile/achievements');
    return data;
  }

  async getLearningStats() {
    const { data } = await this.client.get('/profile/learning-stats');
    return data;
  }

  async getSettingsOptions() {
    const { data } = await this.client.get('/profile/settings-options');
    return data;
  }

  // ==================== 学习记录 ====================

  // 开始学习课程
  async startLearning(courseId: string) {
    const { data } = await this.client.post('/learning/start', { course_id: courseId });
    return data;
  }

  // 更新学习时长
  async updateLearningTime(courseId: string, minutes: number, scenesCompleted?: number) {
    const { data } = await this.client.post('/learning/update-time', {
      course_id: courseId,
      minutes,
      scenes_completed: scenesCompleted,
    });
    return data;
  }

  // 完成课程学习
  async completeLearning(courseId: string, params: {
    total_minutes: number;
    scenes_completed: number;
    total_scenes: number;
    quiz_score?: number;
    quiz_answers?: Array<{
      question_id: string;
      correct: boolean;
      user_answer: string | string[];
      question: {
        id: string;
        type: string;
        content: string;
        options?: Array<{ label: string; value: string }>;
        correct_answer: string | string[];
        explanation?: string;
        difficulty?: string;
        points?: number;
      };
    }>;
  }) {
    const { data } = await this.client.post('/learning/complete', {
      course_id: courseId,
      ...params,
    });
    return data;
  }

  // ==================== MAIC-UI 交互内容 ====================

  // 检查 MAIC-UI 服务状态
  async checkMaicUiHealth() {
    const { data } = await this.client.get('/maic-ui/health');
    return data;
  }

  // 根据概念生成交互式内容（无需上传文件）
  async generateConceptContent(params: {
    concept: string;
    title?: string;
    grade_level?: number;
    generation_mode?: 'fast' | 'heavy';
  }) {
    const { data } = await this.client.post('/maic-ui/concept', params);
    return data;
  }

  // 获取文档处理状态
  async getMaicUiDocumentStatus(documentId: number) {
    const { data } = await this.client.get(`/maic-ui/documents/${documentId}/status`);
    return data;
  }

  // 获取生成的交互式网站内容
  async getMaicUiWebsite(documentId: number) {
    const { data } = await this.client.get(`/maic-ui/documents/${documentId}/website`);
    return data;
  }

  // 上传 PDF 到 MAIC-UI
  async uploadPdfToMaicUi(file: File | Blob, title: string, gradeLevel?: number, generationMode?: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    if (gradeLevel) formData.append('grade_level', gradeLevel.toString());
    formData.append('generation_mode', generationMode || 'fast');

    const { data } = await this.client.post('/maic-ui/pdf/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  // 上传 PPT 到 MAIC-UI
  async uploadPptToMaicUi(file: File | Blob, title: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    const { data } = await this.client.post('/maic-ui/ppt/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  // 解析 PDF 文件为文本内容（用于课程创建时的大纲生成）
  // React Native 原生端：FormData + { uri } 写法 + fetch
  // Web 端：fetch blob URL → Blob → FormData.append(Blob)
  async parsePdf(
    fileUri: string,
    fileName: string,
    providerId?: string,
  ): Promise<{ success: boolean; text?: string; images?: string[]; metadata?: any; data?: { text?: string; images?: string[]; metadata?: any } }> {
    const baseURL = this.client.defaults.baseURL || '';
    const url = `${baseURL}/generate/parse-pdf`;

    // 确保 token 有效（触发 refresh 如果过期）
    let token = this.token;
    if (!token) {
      token = await this.ensureValidToken();
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const isWeb = typeof window !== 'undefined' && typeof window.fetch === 'function'
      && fileUri.startsWith('blob:');

    if (isWeb) {
      // Web: blob URL → fetch as Blob → append to FormData
      const blobResp = await fetch(fileUri);
      const blob = await blobResp.blob();
      const formData = new FormData();
      formData.append('pdf', blob, fileName || 'document.pdf');
      if (providerId) {
        formData.append('providerId', providerId);
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      // 401 时刷新 token 重试一次
      if (response.status === 401 && token) {
        const newToken = await this.ensureValidToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryResp = await fetch(url, { method: 'POST', headers, body: formData });
          if (!retryResp.ok) {
            const errorData = await retryResp.json().catch(() => ({ detail: 'PDF解析失败' }));
            throw new Error(errorData.detail || `HTTP ${retryResp.status}`);
          }
          return retryResp.json();
        }
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'PDF解析失败' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      return response.json();
    } else {
      // React Native 原生：FormData + { uri } 对象
      const formData = new FormData();
      formData.append('pdf', {
        uri: fileUri,
        name: fileName || 'document.pdf',
        type: 'application/pdf',
      } as any);
      if (providerId) {
        formData.append('providerId', providerId);
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      // 401 时刷新 token 重试一次
      if (response.status === 401 && token) {
        const newToken = await this.ensureValidToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryResp = await fetch(url, { method: 'POST', headers, body: formData });
          if (!retryResp.ok) {
            const errorData = await retryResp.json().catch(() => ({ detail: 'PDF解析失败' }));
            throw new Error(errorData.detail || `HTTP ${retryResp.status}`);
          }
          return retryResp.json();
        }
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'PDF解析失败' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      return response.json();
    }
  }

  // ==================== 课程缓存匹配 ====================

  // 语义匹配已有课程缓存
  async matchCourseCache(
    requirement: string,
    language: string = 'zh-CN',
  ): Promise<{ matched: boolean; data?: any }> {
    const { data } = await this.client.post('/generate/match-cache', {
      requirement,
      language,
    });
    return data;
  }

  // 将已生成课程写入缓存
  async cacheCourse(
    stageId: string,
    requirement: string,
    outlines: any[],
    scenes: any[],
    language: string = 'zh-CN',
  ): Promise<{ success: boolean; cache_id?: string }> {
    const { data } = await this.client.post('/generate/cache-course', {
      stage_id: stageId,
      requirement,
      outlines,
      scenes,
      language,
    });
    return data;
  }

  // 从缓存加载源课程的完整 scenes
  async loadCacheScenes(
    stageId: string,
  ): Promise<{ scenes: any[] }> {
    const { data } = await this.client.post('/generate/load-cache-scenes', {
      stage_id: stageId,
    });
    return data;
  }

  // 从缓存课程直接复制为新课程（一步完成：复制 stage + scenes，user_id 为当前用户）
  async cloneCourseFromCache(
    sourceStageId: string,
    name?: string,
  ): Promise<{ id: string; name: string; cloned_count: number; scenes: { id: string; type: string; title: string }[] }> {
    const { data } = await this.client.post('/classrooms/clone-from-cache', {
      source_stage_id: sourceStageId,
      name,
    });
    return data;
  }

  // 获取 MAIC-UI 模板列表
  async getMaicUiTemplates() {
    const { data } = await this.client.get('/maic-ui/templates');
    return data;
  }

  // 根据概念搜索模板
  async searchMaicUiTemplates(concept: string, limit?: number) {
    const { data } = await this.client.post('/maic-ui/search-templates', {
      concept,
      limit: limit || 5,
    });
    return data;
  }

  // 使用模板生成内容
  async generateWithTemplate(concept: string, templateId: string) {
    const { data } = await this.client.post('/maic-ui/generate-with-template', {
      concept,
      template_id: templateId,
    });
    return data;
  }
}

export const apiClient = new ApiClient();