import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/lib/api-client';

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
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userData = await SecureStore.getItemAsync(USER_KEY);

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
    const response = await apiClient.login(email, password);

    await SecureStore.setItemAsync(TOKEN_KEY, response.access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refresh_token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));

    setUser(response.user);
    apiClient.setToken(response.access_token);
  }

  async function register(email: string, password: string, nickname?: string) {
    const response = await apiClient.register(email, password, nickname);

    await SecureStore.setItemAsync(TOKEN_KEY, response.access_token);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refresh_token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user));

    setUser(response.user);
    apiClient.setToken(response.access_token);
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);

    setUser(null);
    apiClient.setToken(null);
  }

  async function refreshUser() {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
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