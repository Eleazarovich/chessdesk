import type { Session, SessionStatus } from '../types';
import { MOCK_SESSIONS } from './mockData';
import { notificationService } from './notificationService';
import { MOCK_CLIENTS } from './mockData';

// BACKEND INTEGRATION POINT: Replace with real API calls to your backend

let sessions = [...MOCK_SESSIONS];

export const sessionService = {
  async getSessions(coachId: string): Promise<Session[]> {
    await new Promise(r => setTimeout(r, 300));
    return sessions.filter(s => s.coach_id === coachId);
  },

  async getSession(id: string): Promise<Session | null> {
    await new Promise(r => setTimeout(r, 200));
    return sessions.find(s => s.id === id) ?? null;
  },

  async createSession(data: Omit<Session, 'id'>): Promise<Session> {
    await new Promise(r => setTimeout(r, 400));
    const session: Session = { ...data, id: `session-${Date.now()}` };
    sessions.push(session);
    const client = MOCK_CLIENTS.find(c => c.id === data.client_id);
    if (client?.notifications_enabled) {
      await notificationService.send({
        client_id: client.id,
        type: 'scheduled',
        session,
        client_name: client.display_name,
      });
    }
    return session;
  },

  async updateSession(id: string, data: Partial<Session>): Promise<Session> {
    await new Promise(r => setTimeout(r, 300));
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Session not found');
    sessions[idx] = { ...sessions[idx], ...data };
    const client = MOCK_CLIENTS.find(c => c.id === sessions[idx].client_id);
    if (client?.notifications_enabled) {
      await notificationService.send({
        client_id: client.id,
        type: 'updated',
        session: sessions[idx],
        client_name: client.display_name,
      });
    }
    return sessions[idx];
  },

  async cancelSession(id: string): Promise<Session> {
    await new Promise(r => setTimeout(r, 300));
    return sessionService.updateSession(id, { status: 'cancelled' as SessionStatus });
  },

  async completeSession(id: string, actualDuration: number, notes: string): Promise<Session> {
    await new Promise(r => setTimeout(r, 400));
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) throw new Error('Session not found');
    sessions[idx] = { ...sessions[idx], status: 'completed', actual_duration: actualDuration, notes };
    const client = MOCK_CLIENTS.find(c => c.id === sessions[idx].client_id);
    if (client?.notifications_enabled) {
      await notificationService.send({
        client_id: client.id,
        type: 'completed',
        session: sessions[idx],
        client_name: client.display_name,
      });
    }
    return sessions[idx];
  },

  async deleteSession(id: string): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
    sessions = sessions.filter(s => s.id !== id);
  },
};