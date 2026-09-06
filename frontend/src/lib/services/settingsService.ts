import type { Coach } from '../types';
import { apiClient } from '../api';

export const settingsService = {
  async getProfile(coachId: string): Promise<Coach> {
    return apiClient.get<Coach>(`/coaches/${coachId}/profile`);
  },

  async updateProfile(coachId: string, data: Partial<Coach>): Promise<Coach> {
    const { id: _id, ...updates } = data;
    return apiClient.patch<Coach>(`/coaches/${coachId}/profile`, updates);
  },
};
