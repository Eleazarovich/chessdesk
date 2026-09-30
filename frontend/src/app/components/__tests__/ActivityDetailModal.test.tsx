import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ActivityDetailModal from '../ActivityDetailModal';
import ActivityStats from '../ActivityStats';
import { authService } from '@/lib/services/authService';
import { clientService } from '@/lib/services/clientService';
import { invoiceService } from '@/lib/services/invoiceService';
import { sessionService } from '@/lib/services/sessionService';
import type { ClientWithDetails, DashboardActivity, Invoice, Session } from '@/lib/types';

const today = new Date();
const todayString = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');

function dateString(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function makeClient(overrides: Partial<ClientWithDetails> = {}): ClientWithDetails {
  return {
    id: 'student-001',
    coach_id: 'coach-001',
    client_type: 'individual',
    display_name: 'Nandi Mokoena',
    email: 'parent@example.com',
    whatsapp: '',
    preferred_communication: 'email',
    notifications_enabled: true,
    notes: '',
    active: true,
    outstanding_amount: 0,
    individual_details: {
      client_id: 'student-001',
      student_name: 'Nandi Mokoena',
      school_name: 'North High',
      parent_name: 'Lerato Mokoena',
    },
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-001',
    coach_id: 'coach-001',
    client_id: 'student-001',
    participant_ids: ['student-001'],
    date: todayString,
    start_time: '15:00',
    planned_duration: 60,
    actual_duration: null,
    session_type: 'in-person',
    location: 'Community Hall',
    status: 'scheduled',
    notes: '',
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'invoice-001',
    coach_id: 'coach-001',
    client_id: 'student-001',
    invoice_date: todayString,
    due_date: todayString,
    amount: 1250,
    description: 'September chess lessons',
    status: 'unpaid',
    paid_date: null,
    payment_method: null,
    payment_reference: '',
    notes: '',
    ...overrides,
  };
}

describe('ActivityStats drill-down controls', () => {
  it('sends the selected business activity to the detail view', () => {
    const onSelect = vi.fn();
    const activity: DashboardActivity = {
      active_individual_students: 3,
      active_schools: 2,
      sessions_completed: 4,
      upcoming_sessions: 5,
      unpaid_invoices: 6,
    };

    render(<ActivityStats activity={activity} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'View 3 active students' }));
    fireEvent.click(screen.getByRole('button', { name: 'View 6 unpaid invoices' }));

    expect(onSelect).toHaveBeenNthCalledWith(1, 'active_students');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'unpaid_invoices');
  });
});

describe('ActivityDetailModal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lists active students and excludes inactive clients', async () => {
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    const getClients = vi.spyOn(clientService, 'getClients').mockResolvedValue([
      makeClient(),
      makeClient({
        id: 'student-002',
        display_name: 'Inactive Learner',
        active: false,
        individual_details: {
          client_id: 'student-002',
          student_name: 'Inactive Learner',
          school_name: '',
          parent_name: '',
        },
      }),
      makeClient({ id: 'school-001', client_type: 'school', display_name: 'Chess Academy', individual_details: undefined }),
    ]);

    render(<ActivityDetailModal activity="active_students" filter="this_month" onClose={vi.fn()} />);

    expect(await screen.findByText('Nandi Mokoena')).toBeInTheDocument();
    expect(screen.getByText('North High · parent@example.com')).toBeInTheDocument();
    expect(screen.getByText('Parent or guardian: Lerato Mokoena')).toBeInTheDocument();
    expect(screen.queryByText('Inactive Learner')).not.toBeInTheDocument();
    expect(screen.queryByText('Chess Academy')).not.toBeInTheDocument();
    expect(getClients).toHaveBeenCalledWith('coach-001');
  });

  it('shows active schools with their contact details', async () => {
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    vi.spyOn(clientService, 'getClients').mockResolvedValue([
      makeClient({
        id: 'school-001',
        client_type: 'school',
        display_name: 'North High billing',
        active: true,
        individual_details: undefined,
        school_details: {
          client_id: 'school-001',
          school_name: 'North High',
          contact_person: 'Thabo Nkosi',
          learner_range: '20-30',
        },
      }),
    ]);

    render(<ActivityDetailModal activity="active_schools" filter="this_month" onClose={vi.fn()} />);

    expect(await screen.findByText('North High')).toBeInTheDocument();
    expect(screen.getByText('Contact: Thabo Nkosi · 20-30 learners')).toBeInTheDocument();
  });

  it('shows unpaid invoice amounts and marks overdue invoices', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    vi.spyOn(clientService, 'getClients').mockResolvedValue([makeClient()]);
    vi.spyOn(invoiceService, 'getInvoices').mockResolvedValue([
      makeInvoice({ due_date: dateString(yesterday) }),
      makeInvoice({ id: 'invoice-002', description: 'Future invoice', due_date: '2999-01-01', amount: 500 }),
      makeInvoice({ id: 'invoice-003', description: 'Already settled', status: 'paid' }),
    ]);

    render(<ActivityDetailModal activity="unpaid_invoices" filter="this_month" onClose={vi.fn()} />);

    expect(await screen.findByText('September chess lessons')).toBeInTheDocument();
    expect(screen.getByText(/R 1\s250,00/)).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Future invoice')).toBeInTheDocument();
    expect(screen.getByText(/R 500,00/)).toBeInTheDocument();
    expect(screen.queryByText('Already settled')).not.toBeInTheDocument();
  });

  it('applies the selected period to completed sessions', async () => {
    const priorMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    vi.spyOn(clientService, 'getClients').mockResolvedValue([makeClient()]);
    vi.spyOn(sessionService, 'getSessions').mockResolvedValue([
      makeSession({ id: 'session-current', date: `${todayString.slice(0, 7)}-01`, status: 'completed' }),
      makeSession({ id: 'session-old', date: dateString(priorMonth), status: 'completed' }),
      makeSession({ id: 'session-scheduled', status: 'scheduled' }),
    ]);

    render(<ActivityDetailModal activity="completed_sessions" filter="this_month" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Nandi Mokoena')).toBeInTheDocument());
    expect(screen.getByText('Showing sessions for this month')).toBeInTheDocument();
    expect(screen.getAllByText('Completed')).toHaveLength(1);
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();
    expect(sessionService.getSessions).toHaveBeenCalledWith('coach-001');
  });

  it('lists scheduled sessions from today onward and excludes past sessions', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    vi.spyOn(clientService, 'getClients').mockResolvedValue([makeClient()]);
    vi.spyOn(sessionService, 'getSessions').mockResolvedValue([
      makeSession({ id: 'session-today', status: 'scheduled' }),
      makeSession({ id: 'session-tomorrow', date: dateString(tomorrow), start_time: '16:00', status: 'scheduled' }),
      makeSession({ id: 'session-past', date: dateString(yesterday), status: 'scheduled' }),
    ]);

    render(<ActivityDetailModal activity="upcoming_sessions" filter="this_month" onClose={vi.fn()} />);

    expect(await screen.findAllByText('Nandi Mokoena')).toHaveLength(2);
    expect(screen.getAllByText('Scheduled')).toHaveLength(2);
    expect(screen.getByText(/at 15:00 · Community Hall/)).toBeInTheDocument();
    expect(screen.getByText(/at 16:00 · Community Hall/)).toBeInTheDocument();
  });
});
