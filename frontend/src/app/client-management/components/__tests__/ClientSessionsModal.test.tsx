import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClientSessionsModal from '../ClientSessionsModal';
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

function makeSession(id: string, date: string, notes: string, participantIds = ['client-001']): Session {
  return {
    id,
    coach_id: 'coach-001',
    client_id: participantIds[0],
    participant_ids: participantIds,
    date,
    start_time: '14:00',
    planned_duration: 60,
    actual_duration: null,
    session_type: 'in-person',
    location: 'Library',
    status: 'completed',
    notes,
  };
}

describe('ClientSessionsModal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads five at a time, shows both directions, and schedules again from a session template', async () => {
    const previousSessions = Array.from({ length: 5 }, (_, index) =>
      makeSession(
        `past-${index}`,
        `2026-08-${String(20 - index).padStart(2, '0')}`,
        `Past session ${index}`,
        index === 0 ? ['client-001', 'client-002'] : ['client-001'],
      ),
    );
    const upcomingSession: Session = {
      ...makeSession('future-1', '2026-10-01', 'Upcoming lesson'),
      status: 'scheduled',
    };
    const laterPastSession = makeSession('past-5', '2026-08-10', 'Past session 5');
    const getClientSessions = vi.spyOn(sessionService, 'getClientSessions').mockImplementation(
      async (_clientId, direction, _asOfDate, _asOfTime, offset = 0) => {
        if (direction === 'upcoming') return { sessions: [upcomingSession], has_more: false };
        if (offset === 0) return { sessions: previousSessions, has_more: true };
        if (offset === 5) return { sessions: [laterPastSession], has_more: true };
        return { sessions: [], has_more: false };
      },
    );
    const onSchedule = vi.fn();

    render(
      <ClientSessionsModal
        client={clients[0]}
        clients={clients}
        onClose={vi.fn()}
        onSchedule={onSchedule}
      />,
    );

    expect(await screen.findByText('Past session 0')).toBeInTheDocument();
    expect(screen.getByText('Past session 4')).toBeInTheDocument();
    expect(screen.getByText('Upcoming lesson')).toBeInTheDocument();
    expect(screen.getByText('Group session · Amahle Dlamini, Liam van der Berg')).toBeInTheDocument();
    expect(getClientSessions).toHaveBeenCalledWith(
      'client-001', 'previous', expect.any(String), expect.any(String), 0, 5,
    );
    expect(getClientSessions).toHaveBeenCalledWith(
      'client-001', 'upcoming', expect.any(String), expect.any(String), 0, 5,
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Schedule another session using/ })[0]);
    expect(onSchedule).toHaveBeenCalledWith(previousSessions[0]);

    const previousSection = screen.getByRole('region', { name: 'Previous sessions' });
    const previousList = previousSection.querySelectorAll('div')[1] as HTMLDivElement;
    Object.defineProperties(previousList, {
      scrollTop: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 280 },
    });
    fireEvent.scroll(previousList);
    expect(await screen.findByText('Past session 5')).toBeInTheDocument();
    await waitFor(() => expect(getClientSessions).toHaveBeenCalledWith(
      'client-001', 'previous', expect.any(String), expect.any(String), 5, 5,
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Load 5 more' }));
    await waitFor(() => expect(getClientSessions).toHaveBeenCalledWith(
      'client-001', 'previous', expect.any(String), expect.any(String), 6, 5,
    ));
  });
});
