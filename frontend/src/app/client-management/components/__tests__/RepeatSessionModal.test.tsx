import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SessionModal from '@/app/components/SessionModal';
import { authService } from '@/lib/services/authService';
import { sessionService } from '@/lib/services/sessionService';
import type { ClientWithDetails, Session } from '@/lib/types';

const clients: ClientWithDetails[] = [
  {
    id: 'client-001', coach_id: 'coach-001', client_type: 'individual', display_name: 'Amahle Dlamini',
    email: 'parent@example.com', whatsapp: '', preferred_communication: 'whatsapp',
    notifications_enabled: true, notes: '', active: true, outstanding_amount: 0,
  },
  {
    id: 'client-002', coach_id: 'coach-001', client_type: 'individual', display_name: 'Liam van der Berg',
    email: 'liam@example.com', whatsapp: '', preferred_communication: 'email',
    notifications_enabled: true, notes: '', active: true, outstanding_amount: 0,
  },
];

const template: Session = {
  id: 'session-100',
  coach_id: 'coach-001',
  client_id: 'client-001',
  date: '2026-09-01',
  start_time: '14:30',
  planned_duration: 75,
  actual_duration: 70,
  session_type: 'online',
  location: 'Zoom',
  status: 'completed',
  notes: 'Review openings',
};

describe('repeat session scheduling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('copies session details, resets status, and lets the coach change date and duration', async () => {
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    const savedSession: Session = {
      ...template,
      id: 'session-101',
      date: '2099-01-20',
      planned_duration: 90,
      actual_duration: null,
      status: 'scheduled',
    };
    const createSession = vi.spyOn(sessionService, 'createSession').mockResolvedValue(savedSession);
    const onSuccess = vi.fn();

    render(
      <SessionModal
        open
        onClose={vi.fn()}
        onSuccess={onSuccess}
        clients={clients}
        initialClientId="client-001"
        templateSession={template}
      />,
    );

    expect(document.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe('');
    expect(document.querySelector<HTMLInputElement>('input[type="time"]')?.value).toBe('14:30');
    expect(document.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('75');
    expect(screen.getByRole('checkbox', { name: 'Amahle Dlamini' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Liam van der Berg' })).not.toBeChecked();
    expect(document.querySelectorAll('select')[0].value).toBe('online');
    expect(document.querySelectorAll('select')[1].value).toBe('scheduled');
    expect(screen.getByPlaceholderText('e.g. Rosebank Library')).toHaveValue('Zoom');
    expect(document.querySelector('textarea')).toHaveValue('Review openings');

    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2099-01-20' } });
    fireEvent.change(document.querySelector('input[type="number"]')!, { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      coach_id: 'coach-001',
      client_id: 'client-001',
      date: '2099-01-20',
      start_time: '14:30',
      planned_duration: 90,
      session_type: 'online',
      location: 'Zoom',
      status: 'scheduled',
      notes: 'Review openings',
      actual_duration: null,
    })));
    expect(onSuccess).toHaveBeenCalledWith(savedSession);
  });
});
