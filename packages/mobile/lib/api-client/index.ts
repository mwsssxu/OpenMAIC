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
}

export const apiClient = new ApiClient();