const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// 调试：打印 API 地址
console.log('API_BASE_URL:', API_BASE_URL);

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// 注册
export async function register(email: string, password: string, nickname: string): Promise<ApiResponse<{ accessToken: string; user: { id: string; email: string; nickname: string } }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password, nickname }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { error: errorData.detail || 'Registration failed' };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    console.error('Register error:', err);
    return { error: 'Network error: ' + (err instanceof Error ? err.message : 'Unknown') };
  }
}

// 登录
export async function login(email: string, password: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string; user: { id: string; email: string; nickname: string } }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { error: errorData.detail || 'Login failed' };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    console.error('Login error:', err);
    return { error: 'Network error: ' + (err instanceof Error ? err.message : 'Unknown') };
  }
}

// 获取价格套餐
export interface Package {
  id: string;
  price: number;
  tokens: number;
  bonus: number;
  total_tokens: number;
}

export async function getPackages(): Promise<ApiResponse<Package[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/tokens/packages`);

    if (!response.ok) {
      return { error: 'Failed to fetch packages' };
    }

    const data = await response.json();
    return { data };
  } catch {
    return { error: 'Network error' };
  }
}

// 存储 token
export function saveToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token);
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}