import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SessionModal from '../SessionModal';
import { authService } from '@/lib/services/authService';
import { sessionService } from '@/lib/services/sessionService';
import type { ClientWithDetails, Session } from '@/lib/types';

const clients: ClientWithDetails[] = [
  {
    id: 'client-001', coach_id: 'coach-001', client_type: 'individual', display_name: 'Amahle Dlamini',
    email: '', whatsapp: '', preferred_communication: 'whatsapp', notifications_enabled: true,
    notes: '', active: true, outstanding_amount: 0,
  },
  {
    id: 'client-002', coach_id: 'coach-001', client_type: 'individual', display_name: 'Liam van der Berg',
    email: '', whatsapp: '', preferred_communication: 'email', notifications_enabled: true,
    notes: '', active: true, outstanding_amount: 0,
  },
];

const createdSession: Session = {
  id: 'session-100', coach_id: 'coach-001', client_id: 'client-001',
  participant_ids: ['client-001', 'client-002'], date: '2099-01-10', start_time: '15:00',
  planned_duration: 60, actual_duration: null, session_type: 'in-person', location: '',
  status: 'scheduled', notes: '',
};

describe('SessionModal group scheduling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates one session with all selected students', async () => {
    const getCurrentCoachId = vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    const createSession = vi.spyOn(sessionService, 'createSession').mockResolvedValue(createdSession);
    const onSuccess = vi.fn();

    render(<SessionModal open onClose={vi.fn()} onSuccess={onSuccess} clients={clients} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Amahle Dlamini' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Liam van der Berg' }));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2099-01-10' } });
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      coach_id: 'coach-001',
      client_id: 'client-001',
      participant_ids: ['client-001', 'client-002'],
    })));
    expect(onSuccess).toHaveBeenCalledWith(createdSession);
  });
});
