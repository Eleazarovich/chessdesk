import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api';
import { AUTH_STORAGE_KEY, authService } from '../authService';

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('logs in through the backend and stores only the user profile', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      id: 'coach-001', email: 'coach@example.com', name: 'Coach', access_token: 'secret', token_type: 'bearer',
    });

    await authService.login({ email: 'coach@example.com', password: 'password' });

    expect(authService.getStoredUser()).toEqual({ id: 'coach-001', email: 'coach@example.com', name: 'Coach' });
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).not.toContain('secret');
  });

  it('logs out through the backend and clears the local user', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ id: 'coach-001' }));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(undefined);

    await authService.logout();

    expect(post).toHaveBeenCalledWith('/auth/logout');
    expect(authService.getStoredUser()).toBeNull();
  });
});
