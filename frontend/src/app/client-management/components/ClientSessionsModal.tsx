'use client';

import React, { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import { CalendarDays, Clock, MapPin, Monitor, Plus, RefreshCw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import { sessionService } from '@/lib/services/sessionService';
import { getLocalDateString, getLocalTimeString } from '@/lib/dateUtils';
import type {
  ClientWithDetails,
  Session,
  SessionHistoryDirection,
} from '@/lib/types';

const PAGE_SIZE = 5;

interface SessionBucket {
  sessions: Session[];
  hasMore: boolean;
  loading: boolean;
  error: string;
}

interface ClientSessionsModalProps {
  client: ClientWithDetails;
  clients: ClientWithDetails[];
  onClose: () => void;
  onSchedule: (template?: Session) => void;
}

function emptyBucket(): SessionBucket {
  return { sessions: [], hasMore: true, loading: true, error: '' };
}

function formatSessionDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SessionCard({
  session,
  clientNames,
  onSchedule,
}: {
  session: Session;
  clientNames: Record<string, string>;
  onSchedule: (session: Session) => void;
}) {
  const participantIds = session.participant_ids?.length ? session.participant_ids : [session.client_id];
  const participants = participantIds.map(id => clientNames[id] ?? id);

  return (
    <article
      className="rounded-xl p-3.5"
      style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              <CalendarDays size={13} style={{ color: 'var(--primary)' }} />
              {formatSessionDate(session.date)}
            </span>
            <StatusBadge variant={session.status} />
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap text-xs" style={{ color: 'var(--foreground-muted)' }}>
            <span className="flex items-center gap-1"><Clock size={12} />{session.start_time} · {session.planned_duration} min</span>
            {session.session_type === 'online' ? (
              <span className="flex items-center gap-1"><Monitor size={12} />Online</span>
            ) : session.location ? (
              <span className="flex items-center gap-1"><MapPin size={12} />{session.location}</span>
            ) : <span>In-person</span>}
          </div>
          {participants.length > 1 && (
            <p className="mt-2 text-xs truncate" style={{ color: 'var(--foreground-subtle)' }}>
              Group session · {participants.join(', ')}
            </p>
          )}
          {session.notes && (
            <p className="mt-2 text-xs line-clamp-2" style={{ color: 'var(--foreground-subtle)' }}>
              {session.notes}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSchedule(session)}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium btn-ghost border"
          style={{ borderColor: 'var(--border)' }}
          aria-label={`Schedule another session using ${formatSessionDate(session.date)} as a template`}
        >
          <RefreshCw size={12} />
          Schedule again
        </button>
      </div>
    </article>
  );
}

export default function ClientSessionsModal({ client, clients, onClose, onSchedule }: ClientSessionsModalProps) {
  const [asOfDate] = useState(() => getLocalDateString());
  const [asOfTime] = useState(() => getLocalTimeString());
  const [buckets, setBuckets] = useState<Record<SessionHistoryDirection, SessionBucket>>({
    previous: emptyBucket(),
    upcoming: emptyBucket(),
  });
  const offsets = useRef<Record<SessionHistoryDirection, number>>({ previous: 0, upcoming: 0 });
  const loading = useRef<Record<SessionHistoryDirection, boolean>>({ previous: false, upcoming: false });
  const hasMore = useRef<Record<SessionHistoryDirection, boolean>>({ previous: true, upcoming: true });
  const clientNames = clients.reduce<Record<string, string>>((names, item) => {
    names[item.id] = item.display_name;
    return names;
  }, {});
  const loadPage = useCallback(async (direction: SessionHistoryDirection, reset = false) => {
    if (loading.current[direction] || (!reset && !hasMore.current[direction])) return;
    loading.current[direction] = true;
    const offset = reset ? 0 : offsets.current[direction];
    if (reset) {
      offsets.current[direction] = 0;
      hasMore.current[direction] = true;
    }
    setBuckets(current => ({
      ...current,
      [direction]: { ...current[direction], loading: true, error: '' },
    }));

    try {
      const page = await sessionService.getClientSessions(
        client.id,
        direction,
        asOfDate,
        asOfTime,
        offset,
        PAGE_SIZE,
      );
      offsets.current[direction] = offset + page.sessions.length;
      hasMore.current[direction] = page.has_more;
      setBuckets(current => ({
        ...current,
        [direction]: {
          sessions: reset ? page.sessions : [...current[direction].sessions, ...page.sessions],
          hasMore: page.has_more,
          loading: false,
          error: '',
        },
      }));
    } catch {
      setBuckets(current => ({
        ...current,
        [direction]: { ...current[direction], loading: false, error: 'Could not load sessions. Try again.' },
      }));
    } finally {
      loading.current[direction] = false;
    }
  }, [client.id, asOfDate, asOfTime]);

  useEffect(() => {
    void loadPage('previous', true);
    void loadPage('upcoming', true);
  }, [loadPage]);

  const loadWhenScrolled = (direction: SessionHistoryDirection) => (event: UIEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 48) {
      void loadPage(direction);
    }
  };

  const renderBucket = (direction: SessionHistoryDirection, heading: string, description: string) => {
    const bucket = buckets[direction];
    return (
      <section className="min-w-0" aria-label={heading}>
        <div className="mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{heading}</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-subtle)' }}>{description}</p>
        </div>
        <div
          className="max-h-[52vh] overflow-y-auto scrollbar-thin space-y-2 pr-1"
          onScroll={loadWhenScrolled(direction)}
          aria-live="polite"
        >
          {bucket.sessions.map(session => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      clientNames={clientNames}
                      onSchedule={onSchedule}
            />
          ))}
          {bucket.loading && bucket.sessions.length === 0 && (
            <p className="px-3 py-5 text-center text-sm" style={{ color: 'var(--foreground-subtle)' }}>Loading sessions…</p>
          )}
          {bucket.error && (
            <div className="px-3 py-4 text-center">
              <p className="text-sm mb-2" style={{ color: 'var(--destructive)' }}>{bucket.error}</p>
              <button type="button" onClick={() => void loadPage(direction, bucket.sessions.length === 0)} className="text-xs font-medium text-primary hover:underline">
                Try again
              </button>
            </div>
          )}
          {!bucket.loading && !bucket.error && bucket.sessions.length === 0 && (
            <p className="px-3 py-5 text-center text-sm rounded-xl" style={{ background: 'var(--background-secondary)', color: 'var(--foreground-subtle)' }}>
              No {direction === 'previous' ? 'past' : 'upcoming'} sessions.
            </p>
          )}
          {bucket.hasMore && bucket.sessions.length > 0 && (
            <button
              type="button"
              onClick={() => void loadPage(direction)}
              disabled={bucket.loading}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg btn-ghost disabled:opacity-60"
            >
              {bucket.loading ? 'Loading…' : 'Load 5 more'}
            </button>
          )}
        </div>
      </section>
    );
  };

  const clientType = client.client_type === 'school' ? 'School' : 'Student';
  const defaultTemplate = buckets.previous.sessions[0] ?? buckets.upcoming.sessions[0];

  return (
    <Modal
      open
      onClose={onClose}
      title={client.display_name}
      subtitle={`${clientType} · ${client.email}`}
      size="xl"
    >
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Session history and upcoming sessions for {client.display_name}.
          </p>
          <button
            type="button"
            onClick={() => onSchedule(defaultTemplate)}
            className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium btn-primary"
          >
            <Plus size={14} />
            {defaultTemplate ? 'Schedule again' : 'Schedule session'}
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderBucket('previous', 'Previous sessions', 'Most recent first · showing 5 at a time')}
          {renderBucket('upcoming', 'Upcoming sessions', 'Soonest first · showing 5 at a time')}
        </div>
      </div>
    </Modal>
  );
}
