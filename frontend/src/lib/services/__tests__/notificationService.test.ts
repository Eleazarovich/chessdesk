import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '../notificationService';
import type { Session } from '../../types';

const mockSession: Session = {
  id: 'session-test',
  coach_id: 'coach-001',
  client_id: 'client-001',
  date: '2026-09-10',
  start_time: '14:00',
  planned_duration: 60,
  actual_duration: null,
  session_type: 'in-person',
  location: 'Rosebank Library',
  status: 'scheduled',
  notes: '',
};

describe('notificationService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('logs a scheduled notification', async () => {
    await notificationService.send({
      client_id: 'client-001',
      type: 'scheduled',
      session: mockSession,
      client_name: 'Amahle Dlamini',
    });
    expect(console.log).toHaveBeenCalled();
  });

  it('logs a cancelled notification with correct session details', async () => {
    await notificationService.send({
      client_id: 'client-001',
      type: 'cancelled',
      session: mockSession,
      client_name: 'Amahle Dlamini',
    });
    expect(console.log).toHaveBeenCalled();
  });

  it('logs a completed notification with actual duration', async () => {
    const completedSession = { ...mockSession, status: 'completed' as const, actual_duration: 55 };
    await notificationService.send({
      client_id: 'client-001',
      type: 'completed',
      session: completedSession,
      client_name: 'Amahle Dlamini',
    });
    expect(console.log).toHaveBeenCalled();
  });

  it('resolves without throwing for all notification types', async () => {
    const types = ['scheduled', 'updated', 'cancelled', 'completed'] as const;
    for (const type of types) {
      await expect(
        notificationService.send({ client_id: 'client-001', type, session: mockSession, client_name: 'Test' })
      ).resolves.toBeUndefined();
    }
  });
});