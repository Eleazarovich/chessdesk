import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api';
import { sessionService } from '../sessionService';

const session = {
  id: 'session-001',
  coach_id: 'coach-001',
  client_id: 'client-001',
  date: '2026-09-10',
  start_time: '14:00',
  planned_duration: 60,
  actual_duration: null,
  session_type: 'in-person' as const,
  location: 'Library',
  status: 'scheduled' as const,
  notes: '',
};

describe('sessionService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads sessions from the backend', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([session]);

    await expect(sessionService.getSessions('coach-001')).resolves.toEqual([session]);
    expect(get).toHaveBeenCalledWith('/sessions', { coach_id: 'coach-001' });
  });

  it('loads a page of client session history with its time window and offset', async () => {
    const page = { sessions: [session], has_more: true };
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(page);

    await expect(sessionService.getClientSessions(
      'client-001', 'previous', '2026-09-30', '14:15', 5,
    )).resolves.toEqual(page);

    expect(get).toHaveBeenCalledWith('/clients/client-001/sessions', {
      direction: 'previous',
      as_of_date: '2026-09-30',
      as_of_time: '14:15',
      offset: '5',
      limit: '5',
    });
  });

  it('creates sessions through the backend, which owns notifications', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(session);
    const { id: _id, ...newSession } = session;

    await sessionService.createSession(newSession);

    expect(post).toHaveBeenCalledWith('/sessions', newSession);
  });

  it('completes a session with actual duration and notes', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ ...session, status: 'completed' });

    await sessionService.completeSession('session-001', 55, 'Endgames');

    expect(patch).toHaveBeenCalledWith('/sessions/session-001', {
      status: 'completed', actual_duration: 55, notes: 'Endgames',
    });
  });
});
