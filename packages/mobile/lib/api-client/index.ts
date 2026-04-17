import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface UserStats {
  total_classrooms: number;
  total_scenes: number;
  total_media_files: number;
  total_chat_sessions: number;
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
          const refreshToken = await SecureStore.getItemAsync('refresh_token');
          if (refreshToken) {
            try {
              const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });
              this.setToken(data.access_token);
              await SecureStore.setItemAsync('auth_token', data.access_token);
              // 重试原请求
              error.config.headers.Authorization = `Bearer ${data.access_token}`;
              return this.client.request(error.config);
            } catch {
              // 刷新失败，清除登录状态
              this.setToken(null);
              await SecureStore.deleteItemAsync('auth_token');
              await SecureStore.deleteItemAsync('refresh_token');
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
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
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

  async deleteClassroom(id: string) {
    const { data } = await this.client.delete(`/classrooms/${id}`);
    return data;
  }

  // ==================== Generation ====================

  async generateOutlines(requirement: string, options?: Record<string, any>) {
    const { data } = await this.client.post('/generate/outlines', {
      requirement,
      ...options,
    });
    return data;
  }

  async generateScenes(outlines: any[], options?: Record<string, any>) {
    const { data } = await this.client.post('/generate/scenes', {
      outlines,
      ...options,
    });
    return data;
  }

  async startGenerationJob(requirement: string, options?: Record<string, any>) {
    const { data } = await this.client.post('/generate/classroom', {
      requirement,
      ...options,
    });
    return data;
  }

  async getGenerationJob(jobId: string) {
    const { data } = await this.client.get(`/generate/classroom/${jobId}`);
    return data;
  }

  // ==================== Chat (SSE) ====================

  streamChat(messages: any[], config: any, storeState: any) {
    const url = `${API_BASE_URL}/chat`;
    // SSE 需要使用 EventSource 或 fetch
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
}

export const apiClient = new ApiClient();