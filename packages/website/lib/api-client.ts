// 使用 Next.js API Routes 作为代理，避免 CORS 问题
// 客户端调用本地 /api/* 路由，服务端再转发到后端

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// 注册
export async function register(email: string, password: string, nickname: string): Promise<ApiResponse<{ accessToken: string; user: { id: string; email: string; nickname: string } }>> {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const response = await fetch('/api/tokens/packages');

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

// 用户信息接口
export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
}

// 获取用户信息
export async function getMe(): Promise<ApiResponse<User>> {
  try {
    const response = await fetch('/api/auth/me');

    if (!response.ok) {
      return { error: 'Failed to get user info' };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    console.error('GetMe error:', err);
    return { error: 'Network error' };
  }
}

// 更新用户信息
export async function updateMe(nickname?: string, avatar_url?: string): Promise<ApiResponse<User>> {
  try {
    const body: { nickname?: string; avatar_url?: string } = {};
    if (nickname) body.nickname = nickname;
    if (avatar_url) body.avatar_url = avatar_url;

    const response = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { error: errorData.detail || 'Update failed' };
    }

    const data = await response.json();
    return { data };
  } catch (err) {
    console.error('UpdateMe error:', err);
    return { error: 'Network error' };
  }
}

// 修改密码
export async function changePassword(old_password: string, new_password: string): Promise<ApiResponse<void>> {
  try {
    const response = await fetch('/api/auth/password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ old_password, new_password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { error: errorData.detail || 'Password change failed' };
    }

    return { data: undefined };
  } catch (err) {
    console.error('ChangePassword error:', err);
    return { error: 'Network error' };
  }
}

// 上传头像
export async function uploadAvatar(file: File): Promise<ApiResponse<{ url: string }>> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return { error: 'Upload failed' };
    }

    const data = await response.json();
    return { data: { url: data.url } };
  } catch (err) {
    console.error('UploadAvatar error:', err);
    return { error: 'Network error' };
  }
}