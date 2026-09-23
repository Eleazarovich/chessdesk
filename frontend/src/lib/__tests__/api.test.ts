import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, DATA_CHANGED_EVENT, apiClient } from '../api';

describe('apiClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    apiClient.clearAccessToken();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    apiClient.clearAccessToken();
    vi.unstubAllGlobals();
  });

  it('uses cookie credentials and serializes JSON requests', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ id: 'client-001' }),
    });

    await apiClient.post('/clients', { display_name: 'Amahle' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/clients',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ display_name: 'Amahle' }),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      }),
    );
  });

  it('emits an activity event after a successful data mutation', async () => {
    const dataChanged = vi.fn();
    window.addEventListener(DATA_CHANGED_EVENT, dataChanged);
    fetchMock.mockResolvedValue({
      status: 201,
      ok: true,
      text: async () => JSON.stringify({ id: 'client-001', display_name: 'Amahle' }),
    });

    await apiClient.post('/clients', { display_name: 'Amahle' });

    expect(dataChanged).toHaveBeenCalledTimes(1);
    expect(dataChanged.mock.calls[0][0]).toMatchObject({
      type: DATA_CHANGED_EVENT,
      detail: expect.objectContaining({
        method: 'POST',
        path: '/clients',
        record: { id: 'client-001', display_name: 'Amahle' },
      }),
    });
    window.removeEventListener(DATA_CHANGED_EVENT, dataChanged);
  });

  it('encodes query parameters and exposes backend errors', async () => {
    fetchMock.mockResolvedValue({
      status: 403,
      ok: false,
      text: async () => JSON.stringify({ message: 'Forbidden', code: 'FORBIDDEN' }),
    });

    const request = apiClient.get('/clients', { coach_id: 'coach 001' });

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Forbidden' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/clients?coach_id=coach+001',
      expect.anything(),
    );
  });

  it('adds the session-scoped bearer fallback when available', async () => {
    apiClient.setAccessToken('token-123');
    fetchMock.mockResolvedValue({ status: 204, ok: true, text: async () => '' });

    await apiClient.post('/auth/logout');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/logout',
      expect.objectContaining({ headers: { Accept: 'application/json', Authorization: 'Bearer token-123' } }),
    );
  });

  it('clears stale auth and notifies the app when a protected request returns 401', async () => {
    const sessionExpired = vi.fn();
    window.addEventListener('chessdesk:session-expired', sessionExpired);
    localStorage.setItem('chessops_auth', JSON.stringify({ id: 'coach-001' }));
    apiClient.setAccessToken('expired-token');
    fetchMock.mockResolvedValue({
      status: 401,
      ok: false,
      text: async () => JSON.stringify({ message: 'Authentication is required', code: 'UNAUTHORIZED' }),
    });

    await expect(apiClient.get('/clients')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });

    expect(sessionStorage.getItem('chessdesk_access_token')).toBeNull();
    expect(localStorage.getItem('chessops_auth')).toBeNull();
    expect(sessionExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener('chessdesk:session-expired', sessionExpired);
  });
});
