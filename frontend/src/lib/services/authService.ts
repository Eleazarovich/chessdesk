import type { AuthUser } from '../types';

// BACKEND INTEGRATION POINT: Replace with real auth provider (Supabase, Firebase, NextAuth, etc.)

interface SignUpData {
  name: string;
  email: string;
  password: string;
}

interface LoginData {
  email: string;
  password: string;
}

const MOCK_USER: AuthUser = {
  id: 'coach-001',
  email: 'thabo@chessops.co.za',
  name: 'Thabo Nkosi',
};

const MOCK_PASSWORD = 'chess2026!';
const AUTH_KEY = 'chessops_auth';

export const authService = {
  async login(data: LoginData): Promise<AuthUser> {
    await new Promise(r => setTimeout(r, 600));
    if (data.email === MOCK_USER.email && data.password === MOCK_PASSWORD) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_KEY, JSON.stringify(MOCK_USER));
      }
      return MOCK_USER;
    }
    throw new Error('Invalid credentials — use the demo accounts below to sign in');
  },

  async signUp(data: SignUpData): Promise<AuthUser> {
    await new Promise(r => setTimeout(r, 800));
    const user: AuthUser = { id: 'coach-new', email: data.email, name: data.name };
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    }
    return user;
  },

  async logout(): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_KEY);
    }
  },

  async resetPassword(email: string): Promise<void> {
    await new Promise(r => setTimeout(r, 600));
    console.log(`[Mock] Password reset email sent to ${email}`);
  },

  getStoredUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};