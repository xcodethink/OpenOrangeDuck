import { create } from 'zustand';
import { authService } from '../services/auth';
import type { RegisterParams, LoginParams, VerifyEmailParams, AuthProvider } from '../services/auth';
import { storageService } from '../services/storage';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  avatar?: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: AuthUser | null;
  plan: 'free' | 'pro' | 'power';
  aiUsageThisMonth: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  checkAuth: () => Promise<void>;
  register: (params: RegisterParams) => Promise<void>;
  login: (params: LoginParams) => Promise<void>;
  verifyEmail: (params: VerifyEmailParams) => Promise<void>;
  oauthLogin: (provider: AuthProvider) => Promise<void>;
  logout: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  plan: 'free',
  aiUsageThisMonth: 0,
  isLoading: false,
  error: null,

  checkAuth: async () => {
    try {
      const settings = await storageService.getSettings();
      if (settings.userId && settings.userToken) {
        set({
          isLoggedIn: true,
          user: {
            id: settings.userId,
            email: settings.userEmail,
            name: settings.userName,
            emailVerified: true,
          },
          plan: settings.plan || 'free',
          aiUsageThisMonth: settings.aiUsageThisMonth || 0,
        });

        // Silently refresh subscription info in background
        try {
          const sub = await authService.refreshSubscription();
          set({
            plan: sub.plan as 'free' | 'pro' | 'power',
            aiUsageThisMonth: sub.aiUsageThisMonth,
          });
        } catch {
          // Ignore — user is still logged in with cached data
        }
      } else {
        set({ isLoggedIn: false, user: null, plan: 'free', aiUsageThisMonth: 0 });
      }
    } catch {
      set({ isLoggedIn: false, user: null, plan: 'free', aiUsageThisMonth: 0 });
    }
  },

  register: async (params) => {
    set({ isLoading: true, error: null });
    try {
      await authService.register(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.login(params);
      set({
        isLoggedIn: true,
        user: result.user,
        plan: result.plan,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyEmail: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.verifyEmail(params);
      set({
        isLoggedIn: true,
        user: result.user,
        plan: result.plan,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  oauthLogin: async (provider) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.oauthLogin(provider);
      set({
        isLoggedIn: true,
        user: result.user,
        plan: result.plan,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth login failed';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await authService.logout();
      set({ isLoggedIn: false, user: null, plan: 'free', aiUsageThisMonth: 0 });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logout failed';
      set({ error: message });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshSubscription: async () => {
    try {
      const sub = await authService.refreshSubscription();
      set({
        plan: sub.plan as 'free' | 'pro' | 'power',
        aiUsageThisMonth: sub.aiUsageThisMonth,
      });
    } catch {
      // Ignore refresh failures
    }
  },

  clearError: () => set({ error: null }),
}));
