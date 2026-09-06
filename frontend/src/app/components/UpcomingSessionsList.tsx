import React from 'react';
import type { UpcomingSession } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { CalendarDays, MapPin, Video, Clock } from 'lucide-react';

interface UpcomingSessionsListProps {
  sessions: UpcomingSession[];
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month - 1]} ${year}`;
}

export default function UpcomingSessionsList({ sessions }: UpcomingSessionsListProps) {
  return (
    <div className="rounded-xl p-5 h-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Upcoming Sessions</h3>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
          {sessions.length} scheduled
        </span>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No upcoming sessions"
          description="Schedule a session with a client to see it here."
        />
      ) : (
        <div className="space-y-2">
          {sessions.map(session => (
            <div
              key={`upcoming-${session.session_id}`}
              className="flex items-start gap-3 px-3 py-3 rounded-lg row-hover transition-colors duration-150"
              style={{ border: '1px solid var(--border-subtle)' }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'var(--primary-muted)' }}>
                {session.session_type === 'online'
                  ? <Video size={14} style={{ color: 'var(--primary)' }} />
                  : <MapPin size={14} style={{ color: 'var(--primary)' }} />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{session.client_name}</span>
                  <StatusBadge variant={session.session_type} />
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    <CalendarDays size={11} />
                    {formatDate(session.date)}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    <Clock size={11} />
                    {session.start_time}
                  </span>
                  {session.location && (
                    <span className="flex items-center gap-1 text-xs truncate max-w-[160px]" style={{ color: 'var(--foreground-subtle)' }}>
                      <MapPin size={11} />
                      {session.location}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}