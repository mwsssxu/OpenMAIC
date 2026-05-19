import { AuthProvider } from 'react-admin';
import { jwtDecode } from 'jwt-decode';

const API_URL = 'http://localhost:8000';

interface JwtPayload {
  admin_id: string;
  roles: string[];
  exp: number;
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const response = await fetch(`${API_URL}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('登录失败：邮箱或密码错误');
    }

    const data = await response.json();
    localStorage.setItem('admin_token', data.access_token);
    localStorage.setItem('admin_id', data.admin_id);
    localStorage.setItem('admin_roles', JSON.stringify(data.roles));

    return Promise.resolve();
  },

  logout: async () => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      await fetch(`${API_URL}/admin/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_id');
    localStorage.removeItem('admin_roles');
    return Promise.resolve();
  },

  checkAuth: () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      return Promise.reject();
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      if (decoded.exp * 1000 < Date.now()) {
        localStorage.removeItem('admin_token');
        return Promise.reject();
      }
      return Promise.resolve();
    } catch {
      localStorage.removeItem('admin_token');
      return Promise.reject();
    }
  },

  checkError: (error) => {
    if (error.status === 401 || error.status === 403) {
      localStorage.removeItem('admin_token');
      return Promise.reject();
    }
    return Promise.resolve();
  },

  getPermissions: () => {
    const roles = localStorage.getItem('admin_roles');
    if (!roles) {
      return Promise.resolve([]);
    }
    return Promise.resolve(JSON.parse(roles));
  },

  getIdentity: () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      return Promise.reject();
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      return Promise.resolve({
        id: decoded.admin_id,
        fullName: '管理员',
        avatar: undefined,
      });
    } catch {
      return Promise.reject();
    }
  },
};

export default authProvider;