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

  async createClassroom(body: { name: string; description?: string; language_directive?: string }) {
    const { data } = await this.client.post('/classrooms', body);
    return data;
  }

  async deleteClassroom(id: string) {
    const { data } = await this.client.delete(`/classrooms/${id}`);
    return data;
  }

  // Generate endpoints
  async generateOutlines(body: { requirement: string; pdf_content?: string; language?: string }) {
    const { data } = await this.client.post('/generate/outlines', body);
    return data;
  }

  async generateScenes(body: { outlines: any[]; language?: string }) {
    const { data } = await this.client.post('/generate/scenes', body);
    return data;
  }

  // Chat endpoints
  async chat(body: { messages: any[]; config?: any; storeState?: any }) {
    const { data } = await this.client.post('/chat', body);
    return data;
  }

  // SSE stream for chat
  getChatStream(body: { messages: any[]; config?: any; storeState?: any }) {
    const url = `${API_URL}/chat`;
    return new EventSource(url, {
      // Note: EventSource doesn't support POST, so this is for GET-based streaming
      // For POST streaming, use fetch with SSE parsing
    });
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
}

export const apiClient = new ApiClient();