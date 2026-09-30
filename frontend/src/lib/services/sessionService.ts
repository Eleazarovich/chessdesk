import type { ClientSessionPage, Session, SessionHistoryDirection, SessionStatus } from '../types';
import { ApiError, apiClient } from '../api';

export const sessionService = {
  async getSessions(coachId: string): Promise<Session[]> {
    return apiClient.get<Session[]>('/sessions', { coach_id: coachId });
  },

  async getClientSessions(
    clientId: string,
    direction: SessionHistoryDirection,
    asOfDate: string,
    asOfTime: string,
    offset = 0,
    limit = 5,
  ): Promise<ClientSessionPage> {
    return apiClient.get<ClientSessionPage>(`/clients/${clientId}/sessions`, {
      direction,
      as_of_date: asOfDate,
      as_of_time: asOfTime,
      offset: String(offset),
      limit: String(limit),
    });
  },

  async getSession(id: string): Promise<Session | null> {
    try {
      return await apiClient.get<Session>(`/sessions/${id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async createSession(data: Omit<Session, 'id'>): Promise<Session> {
    return apiClient.post<Session>('/sessions', data);
  },

  async updateSession(id: string, data: Partial<Session>): Promise<Session> {
    const { id: _id, coach_id: _coachId, ...updates } = data;
    return apiClient.patch<Session>(`/sessions/${id}`, updates);
  },

  async cancelSession(id: string): Promise<Session> {
    return sessionService.updateSession(id, { status: 'cancelled' as SessionStatus });
  },

  async completeSession(id: string, actualDuration: number, notes: string): Promise<Session> {
    return sessionService.updateSession(id, {
      status: 'completed',
      actual_duration: actualDuration,
      notes,
    });
  },

  async deleteSession(id: string): Promise<void> {
    await apiClient.delete(`/sessions/${id}`);
  },
};
