import type { Coach } from '../types';
import { MOCK_COACH } from './mockData';

// BACKEND INTEGRATION POINT: Replace with real API calls to your backend

let coach = { ...MOCK_COACH };

export const settingsService = {
  async getProfile(coachId: string): Promise<Coach> {
    await new Promise(r => setTimeout(r, 200));
    void coachId;
    return { ...coach };
  },

  async updateProfile(coachId: string, data: Partial<Coach>): Promise<Coach> {
    await new Promise(r => setTimeout(r, 400));
    void coachId;
    coach = { ...coach, ...data };
    return { ...coach };
  },
};