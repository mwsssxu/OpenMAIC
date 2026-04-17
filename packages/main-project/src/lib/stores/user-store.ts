import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
}

interface UserState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  tokenBalance: number;
  pointBalance: number;
  setUser: (user: User | null) => void;
  setTokenBalance: (balance: number) => void;
  setPointBalance: (balance: number) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  tokenBalance: 0,
  pointBalance: 0,
  setUser: (user) => set({
    user,
    isAuthenticated: !!user,
    isLoading: false,
  }),
  setTokenBalance: (balance) => set({ tokenBalance: balance }),
  setPointBalance: (balance) => set({ pointBalance: balance }),
  clearUser: () => set({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    tokenBalance: 0,
    pointBalance: 0,
  }),
}));