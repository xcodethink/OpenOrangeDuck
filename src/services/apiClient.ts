import { storageService } from './storage';

/**
 * Centralized HTTP client for the Smart Bookmarks API backend.
 * - Auto-attaches Authorization header from stored JWT
 * - Intercepts 401 responses and attempts silent token refresh
 * - Retries the request once after successful refresh
 */

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let tokenWarningShown = false;

const TOKEN_EXPIRY_WARNING_MS = 5 * 60 * 1000; // Warn 5 minutes before expiry

async function getBaseUrl(): Promise<string> {
  const settings = await storageService.getSettings();
  return settings.proxyEndpoint.replace(/\/+$/, '');
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const settings = await storageService.getSettings();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.userToken) {
    headers['Authorization'] = `Bearer ${settings.userToken}`;
  }
  return headers;
}

async function refreshToken(): Promise<boolean> {
  // Prevent concurrent refresh attempts
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const settings = await storageService.getSettings();
      if (!settings.refreshToken) return false;

      const baseUrl = settings.proxyEndpoint.replace(/\/+$/, '');
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: settings.refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json() as {
        success: boolean;
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        user: { id: string; email: string; name: string; plan?: string };
      };

      if (!data.success) return false;

      await storageService.saveSettings({
        userToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiry: Date.now() + data.expiresIn * 1000,
        plan: (data.user.plan as 'free' | 'pro' | 'power') || 'free',
        userId: data.user.id,
        userEmail: data.user.email,
        userName: data.user.name,
      });

      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function checkTokenExpiry(): Promise<void> {
  const settings = await storageService.getSettings();
  if (!settings.userToken || !settings.tokenExpiry) return;

  const timeLeft = settings.tokenExpiry - Date.now();

  // Token already expired — try silent refresh
  if (timeLeft <= 0) {
    const refreshed = await refreshToken();
    if (refreshed) {
      tokenWarningShown = false;
    }
    return;
  }

  // Token expiring soon — try silent refresh, warn if it fails
  if (timeLeft < TOKEN_EXPIRY_WARNING_MS) {
    const refreshed = await refreshToken();
    if (refreshed) {
      tokenWarningShown = false;
    } else if (!tokenWarningShown) {
      tokenWarningShown = true;
      // Dispatch a custom event for UI components to display the warning
      if (typeof globalThis.dispatchEvent === 'function') {
        globalThis.dispatchEvent(new CustomEvent('token-expiry-warning'));
      }
    }
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true
): Promise<T> {
  // Proactive token check before each authenticated request
  await checkTokenExpiry();

  const baseUrl = await getBaseUrl();
  const headers = await getAuthHeaders();
  const url = `${baseUrl}${path}`;

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Handle 401 with auto-refresh
  if (response.status === 401 && retry) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request<T>(method, path, body, false);
    }
    // Clear auth state if refresh failed
    await storageService.saveSettings({
      userToken: '',
      refreshToken: '',
      userId: '',
      userEmail: '',
      userName: '',
      tokenExpiry: 0,
    });
    throw new Error('AUTH_EXPIRED');
  }

  if (response.status === 402) {
    throw new Error('USAGE_LIMIT_REACHED');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body);
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PUT', path, body);
  },

  delete<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('DELETE', path, body);
  },
};

export default apiClient;
