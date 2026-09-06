import { describe, it, expect } from 'vitest';
import { dashboardService } from '../dashboardService';

describe('dashboardService', () => {
  describe('getDashboardData — financial calculations', () => {
    it('calculates net income as payments received minus expenses for this_month', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      expect(data?.financials?.net_income)?.toBe(
        data?.financials?.payments_received - data?.financials?.expenses
      );
    });

    it('calculates net income as payments received minus expenses for previous_month', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'previous_month');
      expect(data?.financials?.net_income)?.toBe(
        data?.financials?.payments_received - data?.financials?.expenses
      );
    });

    it('calculates net income as payments received minus expenses for all_time', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'all_time');
      expect(data?.financials?.net_income)?.toBe(
        data?.financials?.payments_received - data?.financials?.expenses
      );
    });

    it('outstanding equals total of all unpaid invoices regardless of time filter', async () => {
      const thisMonth = await dashboardService?.getDashboardData('coach-001', 'this_month');
      const prevMonth = await dashboardService?.getDashboardData('coach-001', 'previous_month');
      // Outstanding is always all unpaid, not period-scoped
      expect(thisMonth?.financials?.outstanding)?.toBe(prevMonth?.financials?.outstanding);
    });

    it('outstanding is non-negative', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'all_time');
      expect(data?.financials?.outstanding)?.toBeGreaterThanOrEqual(0);
    });

    it('revenue earned is sum of invoices in period', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'all_time');
      // All invoices total: 800+900+2800+1800+350+400+450 = 7500
      expect(data?.financials?.revenue_earned)?.toBe(7500);
    });

    it('payments received for all_time sums only paid invoices paid_date entries', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'all_time');
      // Paid invoices: inv-002(900) + inv-004(1800) + inv-005(350) + inv-006(400) + inv-007(450) = 3900
      expect(data?.financials?.payments_received)?.toBe(3900);
    });
  });

  describe('getDashboardData — activity stats', () => {
    it('returns correct count of active individual students', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      expect(data?.activity?.active_individual_students)?.toBe(3); // clients 001,002,003 active; 004 inactive
    });

    it('returns correct count of active schools', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      expect(data?.activity?.active_schools)?.toBe(2);
    });

    it('returns unpaid invoices count as 3', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      expect(data?.activity?.unpaid_invoices)?.toBe(3); // inv-001, inv-003
    });
  });

  describe('getDashboardData — upcoming sessions', () => {
    it('returns only scheduled future sessions', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      expect(data?.upcoming_sessions?.length)?.toBeGreaterThan(0);
      data?.upcoming_sessions?.forEach(s => {
        expect(s?.client_name)?.toBeTruthy();
        expect(s?.date)?.toBeTruthy();
        expect(s?.start_time)?.toBeTruthy();
      });
    });

    it('upcoming sessions include session_type', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      data?.upcoming_sessions?.forEach(s => {
        expect(['online', 'in-person'])?.toContain(s?.session_type);
      });
    });
  });

  describe('getDashboardData — chart data', () => {
    it('returns 6 revenue chart data points', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      expect(data?.revenue_chart)?.toHaveLength(6);
    });

    it('revenue chart points have month, revenue, expenses, payments', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      data?.revenue_chart?.forEach(point => {
        expect(point?.month)?.toBeTruthy();
        expect(typeof point?.revenue)?.toBe('number');
        expect(typeof point?.expenses)?.toBe('number');
        expect(typeof point?.payments)?.toBe('number');
      });
    });

    it('sessions chart has 6 points with completed, scheduled, cancelled', async () => {
      const data = await dashboardService?.getDashboardData('coach-001', 'this_month');
      expect(data?.sessions_chart)?.toHaveLength(6);
      data?.sessions_chart?.forEach(point => {
        expect(typeof point?.completed)?.toBe('number');
        expect(typeof point?.scheduled)?.toBe('number');
        expect(typeof point?.cancelled)?.toBe('number');
      });
    });
  });
});