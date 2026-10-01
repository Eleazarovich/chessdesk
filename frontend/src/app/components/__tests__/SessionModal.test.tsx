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
  {
    id: 'client-005', coach_id: 'coach-001', client_type: 'school', display_name: 'Greenfields Primary',
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

describe('SessionModal scheduling categories', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates one shared session record for all selected students', async () => {
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    const createSession = vi.spyOn(sessionService, 'createSession').mockResolvedValue(createdSession);
    const onSuccess = vi.fn();

    render(<SessionModal open onClose={vi.fn()} onSuccess={onSuccess} clients={clients} />);

    expect(screen.getByRole('button', { name: 'Students' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Students' }));
    expect(screen.getByRole('button', { name: 'Students' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amahle Dlamini' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Liam van der Berg' }));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2099-01-10' } });
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      coach_id: 'coach-001',
      client_id: 'client-001',
      participant_ids: ['client-001', 'client-002'],
      date: '2099-01-10',
      start_time: '15:00',
      actual_duration: null,
    }));
    expect(onSuccess).toHaveBeenCalledWith(createdSession);
  });

  it.each([
    ['scheduled', 'completed'],
    ['scheduled', 'cancelled'],
    ['completed', 'scheduled'],
    ['completed', 'cancelled'],
    ['cancelled', 'scheduled'],
    ['cancelled', 'completed'],
  ] as const)(
    'allows a past %s session to change to %s',
    async (currentStatus, status) => {
      const pastSession: Session = {
        ...createdSession,
        id: 'session-past',
        client_id: 'client-001',
        participant_ids: ['client-001'],
        date: '2020-01-10',
        start_time: '10:00',
        status: currentStatus,
      };
      const updatedSession = { ...pastSession, status };
      const updateSession = vi.spyOn(sessionService, 'updateSession').mockResolvedValue(updatedSession);
      const onSuccess = vi.fn();

      render(
        <SessionModal
          open
          onClose={vi.fn()}
          onSuccess={onSuccess}
          clients={clients}
          editSession={pastSession}
        />,
      );

      fireEvent.change(document.querySelectorAll('select')[1], { target: { value: status } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(updateSession).toHaveBeenCalledWith('session-past', expect.objectContaining({
        date: '2020-01-10',
        start_time: '10:00',
        status,
      })));
      expect(onSuccess).toHaveBeenCalledWith(updatedSession);
    },
  );

  it('keeps new sessions restricted to current or future dates', async () => {
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    const createSession = vi.spyOn(sessionService, 'createSession').mockResolvedValue(createdSession);
    const onSuccess = vi.fn();

    render(<SessionModal open onClose={vi.fn()} onSuccess={onSuccess} clients={clients} />);

    fireEvent.click(screen.getByRole('button', { name: 'Students' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Amahle Dlamini' }));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2020-01-10' } });
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Date cannot be in the past.');
    expect(createSession).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('creates a regular single-student session when one student is selected', async () => {
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    const singleSession = { ...createdSession, client_id: 'client-002', participant_ids: ['client-002'] };
    const createSession = vi.spyOn(sessionService, 'createSession').mockResolvedValue(singleSession);

    render(<SessionModal open onClose={vi.fn()} onSuccess={vi.fn()} clients={clients} />);

    fireEvent.click(screen.getByRole('button', { name: 'Students' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Liam van der Berg' }));
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2099-01-10' } });
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      coach_id: 'coach-001',
      client_id: 'client-002',
      participant_ids: ['client-002'],
    })));
  });

  it('switches to the School category and creates a single school session', async () => {
    vi.spyOn(authService, 'getCurrentCoachId').mockReturnValue('coach-001');
    const schoolSession = { ...createdSession, client_id: 'client-005', participant_ids: ['client-005'] };
    const createSession = vi.spyOn(sessionService, 'createSession').mockResolvedValue(schoolSession);
    const onSuccess = vi.fn();

    render(<SessionModal open onClose={vi.fn()} onSuccess={onSuccess} clients={clients} />);

    fireEvent.click(screen.getByRole('button', { name: 'School' }));
    expect(screen.getByRole('button', { name: 'School' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Select school *'), { target: { value: 'client-005' } });
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2099-01-10' } });
    fireEvent.change(document.querySelector('input[type="time"]')!, { target: { value: '15:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Session' }));

    await waitFor(() => expect(createSession).toHaveBeenCalledWith(expect.objectContaining({
      coach_id: 'coach-001',
      client_id: 'client-005',
      participant_ids: ['client-005'],
    })));
    expect(onSuccess).toHaveBeenCalledWith(schoolSession);
  });

  it('prefills all group students and session details when scheduling again', () => {
    const template: Session = {
      ...createdSession,
      date: '2026-09-01',
      start_time: '14:30',
      planned_duration: 75,
      actual_duration: 70,
      session_type: 'online',
      location: 'Online',
      status: 'completed',
      notes: 'Review openings',
    };

    render(
      <SessionModal
        open
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        clients={clients}
        initialClientId="client-001"
        templateSession={template}
      />,
    );

    expect(document.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe('');
    expect(document.querySelector<HTMLInputElement>('input[type="time"]')?.value).toBe('14:30');
    expect(document.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('75');
    expect(screen.getByRole('checkbox', { name: 'Amahle Dlamini' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Liam van der Berg' })).toBeChecked();
    expect(document.querySelectorAll('select')[0].value).toBe('online');
    expect(document.querySelectorAll('select')[1].value).toBe('scheduled');
    expect(screen.getByPlaceholderText('e.g. Rosebank Library')).toHaveValue('Online');
    expect(document.querySelector('textarea')).toHaveValue('Review openings');
  });
});
