import type { DashboardData, TimeFilter } from '../types';
import { apiClient } from '../api';

export const dashboardService = {
  async getDashboardData(coachId: string, filter: TimeFilter): Promise<DashboardData> {
    return apiClient.get<DashboardData>('/dashboard', {
      coach_id: coachId,
      filter,
    });
  },
};
