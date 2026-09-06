import type { DashboardData, TimeFilter } from '../types';
import { MOCK_INVOICES, MOCK_EXPENSES, MOCK_SESSIONS, MOCK_CLIENTS } from './mockData';

// BACKEND INTEGRATION POINT: Replace with real aggregation queries

function getDateRange(filter: TimeFilter): { start: Date; end: Date } {
  const now = new Date('2026-09-06');
  if (filter === 'this_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }
  if (filter === 'previous_month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 0),
    };
  }
  return { start: new Date('2000-01-01'), end: new Date('2099-12-31') };
}

export const dashboardService = {
  async getDashboardData(coachId: string, filter: TimeFilter): Promise<DashboardData> {
    await new Promise(r => setTimeout(r, 400));
    const { start, end } = getDateRange(filter);

    const invoicesInPeriod = MOCK_INVOICES.filter(inv => {
      const d = new Date(inv.invoice_date);
      return d >= start && d <= end;
    });

    const paidInPeriod = MOCK_INVOICES.filter(inv => {
      if (!inv.paid_date) return false;
      const d = new Date(inv.paid_date);
      return d >= start && d <= end;
    });

    const expensesInPeriod = MOCK_EXPENSES.filter(exp => {
      const d = new Date(exp.date);
      return d >= start && d <= end;
    });

    const sessionsInPeriod = MOCK_SESSIONS.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });

    const allUnpaid = MOCK_INVOICES.filter(inv => inv.status === 'unpaid');
    const revenueEarned = invoicesInPeriod.reduce((s, inv) => s + inv.amount, 0);
    const paymentsReceived = paidInPeriod.reduce((s, inv) => s + inv.amount, 0);
    const outstanding = allUnpaid.reduce((s, inv) => s + inv.amount, 0);
    const expenses = expensesInPeriod.reduce((s, exp) => s + exp.amount, 0);
    const netIncome = paymentsReceived - expenses;

    const activeIndividuals = MOCK_CLIENTS.filter(c => c.client_type === 'individual' && c.active && c.coach_id === coachId).length;
    const activeSchools = MOCK_CLIENTS.filter(c => c.client_type === 'school' && c.active && c.coach_id === coachId).length;
    const sessionsCompleted = sessionsInPeriod.filter(s => s.status === 'completed').length;

    const now = new Date('2026-09-06');
    const upcomingSessions = MOCK_SESSIONS.filter(s => s.status === 'scheduled' && new Date(s.date) >= now);

    const upcomingFormatted = upcomingSessions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6)
      .map(s => {
        const client = MOCK_CLIENTS.find(c => c.id === s.client_id);
        return {
          session_id: s.id,
          client_name: client?.display_name ?? 'Unknown',
          date: s.date,
          start_time: s.start_time,
          session_type: s.session_type,
          location: s.location,
        };
      });

    // Chart data — last 6 months
    const chartMonths = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    const revenueChart = [
      { month: 'Apr', revenue: 4200, expenses: 1100, payments: 4200 },
      { month: 'May', revenue: 5800, expenses: 1350, payments: 5200 },
      { month: 'Jun', revenue: 4100, expenses: 980, payments: 3900 },
      { month: 'Jul', revenue: 6300, expenses: 1840, payments: 6300 },
      { month: 'Aug', revenue: 6650, expenses: 1544, payments: 5050 },
      { month: 'Sep', revenue: revenueEarned > 0 ? revenueEarned : 619, expenses, payments: paymentsReceived > 0 ? paymentsReceived : 199 },
    ];

    const sessionsChart = [
      { month: 'Apr', completed: 8, scheduled: 0, cancelled: 1 },
      { month: 'May', completed: 11, scheduled: 0, cancelled: 2 },
      { month: 'Jun', completed: 9, scheduled: 0, cancelled: 0 },
      { month: 'Jul', completed: 13, scheduled: 0, cancelled: 1 },
      { month: 'Aug', completed: 14, scheduled: 0, cancelled: 1 },
      { month: 'Sep', completed: sessionsCompleted, scheduled: upcomingSessions.length, cancelled: 0 },
    ];

    void chartMonths;

    return {
      financials: { revenue_earned: revenueEarned, payments_received: paymentsReceived, outstanding, expenses, net_income: netIncome },
      activity: { active_individual_students: activeIndividuals, active_schools: activeSchools, sessions_completed: sessionsCompleted, upcoming_sessions: upcomingSessions.length, unpaid_invoices: allUnpaid.length },
      upcoming_sessions: upcomingFormatted,
      revenue_chart: revenueChart,
      sessions_chart: sessionsChart,
    };
  },
};