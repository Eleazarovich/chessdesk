import { describe, it, expect, vi } from 'vitest';

// Mock notificationService before importing sessionService
vi?.mock('../notificationService', () => ({
  notificationService: {
    send: vi?.fn()?.mockResolvedValue(undefined),
  },
}));

import { sessionService } from '../sessionService';
import { notificationService } from '../notificationService';

describe('sessionService', () => {
  describe('getSessions', () => {
    it('returns sessions for the given coach', async () => {
      const sessions = await sessionService?.getSessions('coach-001');
      expect(sessions?.length)?.toBeGreaterThan(0);
      sessions?.forEach(s => expect(s?.coach_id)?.toBe('coach-001'));
    });
  });

  describe('createSession', () => {
    it('creates a session with scheduled status', async () => {
      const session = await sessionService?.createSession({
        coach_id: 'coach-001',
        client_id: 'client-001',
        date: '2026-09-15',
        start_time: '10:00',
        planned_duration: 60,
        actual_duration: null,
        session_type: 'online',
        location: '',
        status: 'scheduled',
        notes: '',
      });
      expect(session?.id)?.toBeTruthy();
      expect(session?.status)?.toBe('scheduled');
    });

    it('triggers notification when client has notifications_enabled = true', async () => {
      vi?.clearAllMocks();
      await sessionService?.createSession({
        coach_id: 'coach-001',
        client_id: 'client-001', // notifications_enabled: true
        date: '2026-09-16',
        start_time: '14:00',
        planned_duration: 60,
        actual_duration: null,
        session_type: 'in-person',
        location: 'Library',
        status: 'scheduled',
        notes: '',
      });
      expect(notificationService?.send)?.toHaveBeenCalledWith(
        expect?.objectContaining({ type: 'scheduled', client_id: 'client-001' })
      );
    });

    it('does NOT trigger notification when client has notifications_enabled = false', async () => {
      vi?.clearAllMocks();
      await sessionService?.createSession({
        coach_id: 'coach-001',
        client_id: 'client-003', // notifications_enabled: false
        date: '2026-09-17',
        start_time: '10:00',
        planned_duration: 45,
        actual_duration: null,
        session_type: 'in-person',
        location: 'Home',
        status: 'scheduled',
        notes: '',
      });
      expect(notificationService?.send)?.not?.toHaveBeenCalled();
    });
  });

  describe('cancelSession', () => {
    it('transitions session status to cancelled', async () => {
      const cancelled = await sessionService?.cancelSession('session-001');
      expect(cancelled?.status)?.toBe('cancelled');
    });

    it('sends cancellation notification for client with notifications enabled', async () => {
      vi?.clearAllMocks();
      // Re-create session-001 as scheduled so we can cancel it again
      const newSession = await sessionService?.createSession({
        coach_id: 'coach-001',
        client_id: 'client-001',
        date: '2026-09-20',
        start_time: '14:00',
        planned_duration: 60,
        actual_duration: null,
        session_type: 'in-person',
        location: 'Library',
        status: 'scheduled',
        notes: '',
      });
      vi?.clearAllMocks();
      await sessionService?.cancelSession(newSession?.id);
      expect(notificationService?.send)?.toHaveBeenCalledWith(
        expect?.objectContaining({ type: 'cancelled' })
      );
    });
  });

  describe('completeSession', () => {
    it('transitions status to completed and records actual duration', async () => {
      const newSession = await sessionService?.createSession({
        coach_id: 'coach-001',
        client_id: 'client-002',
        date: '2026-09-18',
        start_time: '16:00',
        planned_duration: 60,
        actual_duration: null,
        session_type: 'online',
        location: '',
        status: 'scheduled',
        notes: '',
      });
      const completed = await sessionService?.completeSession(newSession?.id, 55, 'Great session.');
      expect(completed?.status)?.toBe('completed');
      expect(completed?.actual_duration)?.toBe(55);
      expect(completed?.notes)?.toBe('Great session.');
    });

    it('sends completed notification', async () => {
      vi?.clearAllMocks();
      const s = await sessionService?.createSession({
        coach_id: 'coach-001',
        client_id: 'client-001',
        date: '2026-09-19',
        start_time: '14:00',
        planned_duration: 60,
        actual_duration: null,
        session_type: 'in-person',
        location: 'Library',
        status: 'scheduled',
        notes: '',
      });
      vi?.clearAllMocks();
      await sessionService?.completeSession(s?.id, 60, '');
      expect(notificationService?.send)?.toHaveBeenCalledWith(
        expect?.objectContaining({ type: 'completed' })
      );
    });
  });

  describe('updateSession', () => {
    it('updates session fields and returns updated session', async () => {
      const s = await sessionService?.createSession({
        coach_id: 'coach-001',
        client_id: 'client-002',
        date: '2026-09-22',
        start_time: '16:00',
        planned_duration: 60,
        actual_duration: null,
        session_type: 'online',
        location: '',
        status: 'scheduled',
        notes: '',
      });
      const updated = await sessionService?.updateSession(s?.id, { start_time: '17:00', notes: 'Rescheduled' });
      expect(updated?.start_time)?.toBe('17:00');
      expect(updated?.notes)?.toBe('Rescheduled');
    });
  });
});