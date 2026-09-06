import type { AuthUser } from '../types';
import { ApiError, apiClient } from '../api';

interface SignUpData {
  name: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

export const AUTH_STORAGE_KEY = 'chessops_auth';

interface AuthResponse extends AuthUser {
  access_token: string;
  token_type: string;
}

function storeUser(user: AuthUser): AuthUser {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }
  return user;
}

let restoredUser: AuthUser | null | undefined;
let restorePromise: Promise<AuthUser | null> | null = null;

export const authService = {
  async login(data: LoginData): Promise<AuthUser> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    apiClient.setAccessToken(response.access_token);
    const user = storeUser({ id: response.id, email: response.email, name: response.name });
    restoredUser = user;
    return user;
  },

  async signUp(data: SignUpData): Promise<AuthUser> {
    const response = await apiClient.post<AuthResponse>('/auth/signup', data);
    apiClient.setAccessToken(response.access_token);
    const user = storeUser({ id: response.id, email: response.email, name: response.name });
    restoredUser = user;
    return user;
  },

  async logout(): Promise<void> {
    // Start revocation with the current token, then clear local state before
    // awaiting the network so callers can navigate immediately.
    const revocation = apiClient.post('/auth/logout');
    restoredUser = null;
    apiClient.clearAccessToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
    await revocation;
  },

  async resetPassword(email: string): Promise<void> {
    await apiClient.post('/auth/password/reset', { email });
  },

  async restoreSession(): Promise<AuthUser | null> {
    const user = this.getStoredUser();
    if (!user) return null;

    if (restoredUser?.id === user.id) return restoredUser;
    if (restorePromise) return restorePromise;

    restorePromise = this.verifyStoredSession(user);
    try {
      return await restorePromise;
    } finally {
      restorePromise = null;
    }
  },

  async verifyStoredSession(user: AuthUser): Promise<AuthUser | null> {
    try {
      await apiClient.get(`/coaches/${encodeURIComponent(user.id)}/profile`);
      restoredUser = user;
      return user;
    } catch (error) {
      // A token from a previous backend process can be stale while the cookie
      // is still valid. Retry once without the bearer fallback before signing out.
      if (error instanceof ApiError && error.status === 401) {
        apiClient.clearAccessToken();
        try {
          await apiClient.get(`/coaches/${encodeURIComponent(user.id)}/profile`);
          restoredUser = user;
          return user;
        } catch {
          // The backend session is no longer valid.
        }
      }

      restoredUser = null;
      apiClient.clearAccessToken();
      if (typeof window !== 'undefined') localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  },

  getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  getCurrentCoachId(): string | null {
    return this.getStoredUser()?.id ?? null;
  },
};
