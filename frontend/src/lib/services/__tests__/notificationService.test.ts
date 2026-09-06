import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api';
import { notificationService } from '../notificationService';

describe('notificationService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends notifications through the backend', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(undefined);
    const payload = {
      client_id: 'client-001',
      type: 'scheduled' as const,
      session: {
        id: 'session-001', coach_id: 'coach-001', client_id: 'client-001', date: '2026-09-10',
        start_time: '14:00', planned_duration: 60, actual_duration: null,
        session_type: 'in-person' as const, location: 'Library', status: 'scheduled' as const, notes: '',
      },
      client_name: 'Amahle Dlamini',
    };

    await notificationService.send(payload);

    expect(post).toHaveBeenCalledWith('/notifications', payload);
  });
});
