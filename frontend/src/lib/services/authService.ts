import type { AuthUser } from '../types';
import { apiClient } from '../api';

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

export const authService = {
  async login(data: LoginData): Promise<AuthUser> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    apiClient.setAccessToken(response.access_token);
    return storeUser({ id: response.id, email: response.email, name: response.name });
  },

  async signUp(data: SignUpData): Promise<AuthUser> {
    const response = await apiClient.post<AuthResponse>('/auth/signup', data);
    apiClient.setAccessToken(response.access_token);
    return storeUser({ id: response.id, email: response.email, name: response.name });
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      apiClient.clearAccessToken();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  },

  async resetPassword(email: string): Promise<void> {
    await apiClient.post('/auth/password/reset', { email });
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
