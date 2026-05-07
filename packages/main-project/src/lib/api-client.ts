import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || process.env.PYTHON_API_URL || 'http://localhost:8000';

class ApiClient {
  private client: ReturnType<typeof axios.create>;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.token) {
          // Token expired, try refresh
          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const { data } = await this.client.post('/auth/refresh', {
                refresh_token: refreshToken,
              });
              this.setToken(data.access_token);
              localStorage.setItem('refresh_token', data.refresh_token);
              // Retry original request
              error.config.headers.Authorization = `Bearer ${data.access_token}`;
              return this.client.request(error.config);
            }
          } catch {
            // Refresh failed, clear tokens
            this.clearToken();
          }
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('access_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
  }

  getToken(): string | null {
    return this.token || localStorage.getItem('access_token');
  }

  // Auth endpoints
  async register(email: string, password: string, nickname?: string) {
    const { data } = await this.client.post('/auth/register', {
      email,
      password,
      nickname,
    });
    return data;
  }

  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', {
      email,
      password,
    });
    return data;
  }

  async refreshToken(refreshToken: string) {
    const { data } = await this.client.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return data;
  }

  async getCurrentUser() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  async updateUser(updates: { nickname?: string; avatar_url?: string }) {
    const { data } = await this.client.put('/auth/me', updates);
    return data;
  }

  // Classroom endpoints
  async getClassrooms() {
    const { data } = await this.client.get('/classrooms');
    return data;
  }

  async getClassroom(id: string) {
    const { data } = await this.client.get(`/classrooms/${id}`);
    return data;
  }

  async createClassroom(body: { name: string; description?: string; language_directive?: string; agent_ids?: string[] }) {
    const { data } = await this.client.post('/classrooms', body);
    return data;
  }

  // 创建完整课程（包含大纲生成场景内容并保存）
  async createFullClassroom(body: {
    name: string;
    description?: string;
    outlines: any[];
    agent_ids?: string[];
    agent_configs?: any[];
    language?: string;
  }) {
    const { data } = await this.client.post('/classrooms/create-full', body, {
      timeout: 180000, // 3分钟（场景生成需要时间）
    });
    return data;
  }

  async deleteClassroom(id: string) {
    const { data } = await this.client.delete(`/classrooms/${id}`);
    return data;
  }

  // Generate endpoints
  async generateOutlines(body: { requirement: string; pdf_content?: string; language?: string; agent_ids?: string[] }) {
    const { data } = await this.client.post('/generate/outlines', body);
    return data;
  }

  async generateScenes(body: { outlines: any[]; language?: string }) {
    const { data } = await this.client.post('/generate/scenes', body);
    return data;
  }

  async generateAgentProfiles(body: {
    stage_name: string;
    stage_description?: string;
    scene_outlines?: any[];
    language?: string;
  }) {
    const { data } = await this.client.post('/generate/agent-profiles', body);
    return data;
  }

  async getDefaultAgents(language?: string) {
    const { data } = await this.client.get('/generate/default-agents', {
      params: { language: language || 'zh-CN' },
    });
    return data;
  }

  // Chat endpoints
  async chat(body: { messages: any[]; config?: any; storeState?: any }) {
    const { data } = await this.client.post('/chat', body);
    return data;
  }

  // SSE stream for chat - uses fetch for POST streaming
  async streamChat(
    body: { messages: any[]; config?: any; storeState?: any },
    onChunk: (chunk: string) => void,
    onError?: (error: Error) => void
  ) {
    const response = await fetch(`${API_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token ? `Bearer ${this.token}` : '',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = new Error(`Stream error: ${response.status}`);
      onError?.(error);
      throw error;
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE format: "data: {...}\n\n"
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data !== '[DONE]') {
              onChunk(data);
            }
          }
        }
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }

  // SSE stream for outline generation
  async streamOutlines(
    body: { requirement: string; pdf_content?: string; language?: string },
    onChunk: (chunk: string) => void,
    onError?: (error: Error) => void
  ) {
    const response = await fetch(`${API_URL}/generate/outlines/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token ? `Bearer ${this.token}` : '',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = new Error(`Stream error: ${response.status}`);
      onError?.(error);
      throw error;
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data !== '[DONE]') {
              onChunk(data);
            }
          }
        }
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }

  // Token/Points endpoints (will be implemented in Python backend)
  async getTokenBalance() {
    const { data } = await this.client.get('/tokens/balance');
    return data;
  }

  async getPointBalance() {
    const { data } = await this.client.get('/points/balance');
    return data;
  }

  // Achievements
  async getAchievements() {
    const { data } = await this.client.get('/achievements');
    return data;
  }

  async getUserAchievements() {
    const { data } = await this.client.get('/achievements/me');
    return data;
  }

  // Questions endpoints
  async getQuestions(params?: { page?: number; limit?: number; status?: string; sort?: string }) {
    const { data } = await this.client.get('/questions', { params });
    return data;
  }

  async getQuestion(id: string) {
    const { data } = await this.client.get(`/questions/${id}`);
    return data;
  }

  async createQuestion(body: { title: string; content: string; bounty?: number; tags?: string }) {
    const { data } = await this.client.post('/questions', body);
    return data;
  }

  // Answers endpoints
  async getAnswers(questionId: string, params?: { page?: number; sort?: string }) {
    const { data } = await this.client.get(`/answers/question/${questionId}`, { params });
    return data;
  }

  async createAnswer(body: { question_id: string; content: string }) {
    const { data } = await this.client.post('/answers', body);
    return data;
  }

  async voteAnswer(answerId: string, vote: 1 | -1) {
    const { data } = await this.client.post(`/answers/${answerId}/vote`, { vote });
    return data;
  }

  async acceptAnswer(answerId: string) {
    const { data } = await this.client.post(`/answers/${answerId}/accept`);
    return data;
  }

  // Invitations endpoints
  async getMyInviteCode() {
    const { data } = await this.client.get('/invitations/my-code');
    return data;
  }

  async getInviteStats() {
    const { data } = await this.client.get('/invitations/stats');
    return data;
  }

  async applyInviteCode(code: string) {
    const { data } = await this.client.post('/invitations/apply', { invite_code: code });
    return data;
  }

  // Payment endpoints
  async getPaymentPackages() {
    const { data } = await this.client.get('/payment/packages');
    return data;
  }

  async createPaymentOrder(body: { package: string; payment_method: string }) {
    const { data } = await this.client.post('/payment/create-order', body);
    return data;
  }

  async getOrders(params?: { page?: number; status?: string }) {
    const { data } = await this.client.get('/payment/orders', { params });
    return data;
  }

  async getOrder(orderId: string) {
    const { data } = await this.client.get(`/payment/orders/${orderId}`);
    return data;
  }

  async mockPay(orderId: string) {
    const { data } = await this.client.post(`/payment/mock-pay/${orderId}`);
    return data;
  }

  // Token/Points detailed endpoints
  async getTokenTransactions(params?: { page?: number; type?: string }) {
    const { data } = await this.client.get('/tokens/transactions', { params });
    return data;
  }

  async getPointsTransactions(params?: { page?: number; source?: string }) {
    const { data } = await this.client.get('/points/transactions', { params });
    return data;
  }

  async exchangeTokens(tier: string) {
    const { data } = await this.client.post('/tokens/exchange', { tier });
    return data;
  }

  async getExchangeRates() {
    const { data } = await this.client.get('/tokens/exchange-rates');
    return data;
  }
}

export const apiClient = new ApiClient();