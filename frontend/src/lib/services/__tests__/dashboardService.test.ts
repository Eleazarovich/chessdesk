import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api';
import { dashboardService } from '../dashboardService';

describe('dashboardService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('requests dashboard aggregates for the selected coach and period', async () => {
    const dashboard = { financials: { net_income: 100 } };
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(dashboard);

    await expect(dashboardService.getDashboardData('coach-001', 'this_month')).resolves.toBe(dashboard);
    expect(get).toHaveBeenCalledWith('/dashboard', { coach_id: 'coach-001', filter: 'this_month' });
  });
});
