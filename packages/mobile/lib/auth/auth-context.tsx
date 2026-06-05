import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiClient } from '@/lib/api-client';

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

interface User {
  id: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = await storage.getItem(TOKEN_KEY);
      const userData = await storage.getItem(USER_KEY);

      if (token && userData) {
        setUser(JSON.parse(userData));
        apiClient.setToken(token);
      }
    } catch (error) {
      console.error('Load auth error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      const response = await apiClient.login(email, password);

      await storage.setItem(TOKEN_KEY, response.access_token);
      await storage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
      await storage.setItem(USER_KEY, JSON.stringify(response.user));

      setUser(response.user);
      apiClient.setToken(response.access_token);
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || '登录失败';
      throw new Error(message);
    }
  }

  async function register(email: string, password: string, nickname?: string) {
    try {
      const response = await apiClient.register(email, password, nickname);

      await storage.setItem(TOKEN_KEY, response.access_token);
      await storage.setItem(REFRESH_TOKEN_KEY, response.refresh_token);
      await storage.setItem(USER_KEY, JSON.stringify(response.user));

      setUser(response.user);
      apiClient.setToken(response.access_token);
    } catch (error: any) {
      const message = error.response?.data?.detail || error.message || '注册失败';
      throw new Error(message);
    }
  }

  async function logout() {
    // 立即清除内存中的 token，阻断后续 API 请求携带旧凭证
    apiClient.setToken(null);
    setUser(null);

    try {
      // 调用后端退出登录接口（可选，主要是清除本地状态）
      await apiClient.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    }

    // 清除本地存储的认证数据
    await storage.deleteItem(TOKEN_KEY);
    await storage.deleteItem(REFRESH_TOKEN_KEY);
    await storage.deleteItem(USER_KEY);
  }

  async function refreshUser() {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      await storage.setItem(USER_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}