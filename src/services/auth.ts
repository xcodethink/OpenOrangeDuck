/**
 * Authentication Service
 *
 * Handles user authentication including:
 * - Email/password registration and login
 * - OAuth login (Google)
 * - Email verification
 * - Password reset
 * - Token refresh
 */

import { apiClient } from './apiClient';
import { storageService } from './storage';

export type AuthProvider = 'google' | 'microsoft';

export interface AuthResult {
  token: string;
  refreshToken: string;
  expiresIn: number;
  plan: 'free' | 'pro' | 'power' | 'max';
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    avatar?: string;
  };
}

export interface RegisterParams {
  email: string;
  password: string;
  name: string;
  referral?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface VerifyEmailParams {
  email: string;
  code: string;
}

interface ApiAuthResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    plan?: 'free' | 'pro' | 'power' | 'max';
  };
}

function toAuthResult(data: ApiAuthResponse): AuthResult {
  return {
    token: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    plan: data.user.plan || 'free',
    user: {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      emailVerified: data.user.emailVerified,
    },
  };
}

async function saveAuthState(result: AuthResult): Promise<void> {
  await storageService.saveSettings({
    userToken: result.token,
    refreshToken: result.refreshToken,
    tokenExpiry: Date.now() + result.expiresIn * 1000,
    plan: result.plan,
    userId: result.user.id,
    userEmail: result.user.email,
    userName: result.user.name,
  });
}

class AuthService {
  async register(params: RegisterParams): Promise<void> {
    if (!params.email.includes('@')) {
      throw new Error('Invalid email address');
    }
    if (params.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const settings = await storageService.getSettings();
    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Registration failed' })) as { error?: string };
      throw new Error(error.error || 'Registration failed');
    }
  }

  async login(params: LoginParams): Promise<AuthResult> {
    if (!params.email.includes('@')) {
      throw new Error('Invalid email address');
    }

    const settings = await storageService.getSettings();
    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Login failed' })) as { error?: string };
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json() as ApiAuthResponse;
    const result = toAuthResult(data);
    await saveAuthState(result);
    return result;
  }

  async verifyEmail(params: VerifyEmailParams): Promise<AuthResult> {
    if (params.code.length !== 6) {
      throw new Error('Invalid verification code');
    }

    const settings = await storageService.getSettings();
    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Verification failed' })) as { error?: string };
      throw new Error(error.error || 'Verification failed');
    }

    const data = await response.json() as ApiAuthResponse;
    const result = toAuthResult(data);
    await saveAuthState(result);
    return result;
  }

  async resendVerification(email: string): Promise<void> {
    const settings = await storageService.getSettings();
    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/auth/resend-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to resend code' })) as { error?: string };
      throw new Error(error.error || 'Failed to resend verification code');
    }
  }

  async forgotPassword(email: string): Promise<void> {
    if (!email.includes('@')) {
      throw new Error('Invalid email address');
    }

    const settings = await storageService.getSettings();
    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to send reset code' })) as { error?: string };
      throw new Error(error.error || 'Failed to send password reset code');
    }
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const settings = await storageService.getSettings();
    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Reset failed' })) as { error?: string };
      throw new Error(error.error || 'Password reset failed');
    }
  }

  async oauthLogin(provider: AuthProvider): Promise<AuthResult> {
    if (provider === 'microsoft') {
      throw new Error('Microsoft login is not yet supported');
    }

    // Request optional "identity" permission at runtime
    const granted = await chrome.permissions.request({ permissions: ['identity'] });
    if (!granted) {
      throw new Error('Identity permission is required for Google login');
    }

    const idToken = await this.getGoogleIdToken();

    const settings = await storageService.getSettings();
    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/auth/oauth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'OAuth login failed' })) as { error?: string };
      throw new Error(error.error || 'Google login failed');
    }

    const data = await response.json() as ApiAuthResponse;
    const result = toAuthResult(data);
    await saveAuthState(result);
    return result;
  }

  private async getGoogleIdToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      // chrome.identity.launchWebAuthFlow requires a configured OAuth client
      // The redirect URL is: https://<extension-id>.chromiumapp.org/
      const clientId = '201908505103-hj7ip6cusf92fhufp37aeri8cr2hcg5a.apps.googleusercontent.com';
      const redirectUrl = chrome.identity.getRedirectURL();
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=id_token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=openid%20email%20profile&nonce=${crypto.randomUUID()}`;

      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            reject(new Error(chrome.runtime.lastError?.message || 'OAuth cancelled'));
            return;
          }

          const url = new URL(responseUrl);
          const fragment = new URLSearchParams(url.hash.slice(1));
          const idToken = fragment.get('id_token');

          if (!idToken) {
            reject(new Error('No ID token received'));
            return;
          }

          resolve(idToken);
        }
      );
    });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  }

  async deleteAccount(): Promise<void> {
    await apiClient.delete('/auth/account', { confirmation: 'DELETE' });
    await storageService.saveSettings({
      userToken: '',
      refreshToken: '',
      tokenExpiry: 0,
      plan: 'free',
      aiUsageThisMonth: 0,
      userId: '',
      userEmail: '',
      userName: '',
    });
  }

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore errors during logout - clear local state regardless
    }

    await storageService.saveSettings({
      userToken: '',
      refreshToken: '',
      tokenExpiry: 0,
      plan: 'free',
      aiUsageThisMonth: 0,
      userId: '',
      userEmail: '',
      userName: '',
    });
  }

  async refreshSubscription(): Promise<{ plan: string; aiUsageThisMonth: number }> {
    try {
      const data = await apiClient.get<{ plan: string; usage?: { ai_bookmarks_used?: number } }>('/subscription');
      const plan = (data.plan || 'free') as 'free' | 'pro' | 'power' | 'max';
      const aiUsage = data.usage?.ai_bookmarks_used ?? 0;
      await storageService.saveSettings({ plan, aiUsageThisMonth: aiUsage });
      return { plan, aiUsageThisMonth: aiUsage };
    } catch {
      return { plan: 'free', aiUsageThisMonth: 0 };
    }
  }

  async refreshTokens(): Promise<boolean> {
    const settings = await storageService.getSettings();
    if (!settings.refreshToken) return false;

    const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: settings.refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json() as ApiAuthResponse;
    if (!data.success) return false;

    await saveAuthState(toAuthResult(data));
    return true;
  }

  async isLoggedIn(): Promise<boolean> {
    const settings = await storageService.getSettings();
    return Boolean(settings.userToken && settings.userId);
  }

  async getUser(): Promise<AuthResult['user'] | null> {
    const settings = await storageService.getSettings();
    if (!settings.userId) return null;
    return {
      id: settings.userId,
      email: settings.userEmail,
      name: settings.userName,
      emailVerified: true,
    };
  }
}

export const authService = new AuthService();
