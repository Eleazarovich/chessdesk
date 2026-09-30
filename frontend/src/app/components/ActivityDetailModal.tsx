'use client';
import React, { useEffect, useState } from 'react';
import type { ClientWithDetails, Invoice, Session, TimeFilter } from '@/lib/types';
import { authService } from '@/lib/services/authService';
import { clientService } from '@/lib/services/clientService';
import { invoiceService } from '@/lib/services/invoiceService';
import { sessionService } from '@/lib/services/sessionService';
import { getLocalDateString } from '@/lib/dateUtils';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import StatusBadge from '@/components/ui/StatusBadge';
import type { ActivityDetailType } from './ActivityStats';
import { CalendarDays, FileText, GraduationCap, Users } from 'lucide-react';

interface ActivityDetailRow {
  id: string;
  title: string;
  subtitle: string;
  extra?: string;
  value?: string;
  badge?: {
    label: string;
    variant: 'active' | 'unpaid' | 'completed' | 'scheduled';
  };
}

interface ActivityDetailModalProps {
  activity: ActivityDetailType | null;
  filter: TimeFilter;
  onClose: () => void;
}

const TITLES: Record<ActivityDetailType, string> = {
  active_students: 'Active Students',
  active_schools: 'Active Schools',
  completed_sessions: 'Completed Sessions',
  upcoming_sessions: 'Upcoming Sessions',
  unpaid_invoices: 'Unpaid Invoices',
};

const FILTER_LABELS: Record<TimeFilter, string> = {
  this_month: 'this month',
  previous_month: 'last month',
  all_time: 'all time',
};

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isInPeriod(value: string, filter: TimeFilter, today: string): boolean {
  if (filter === 'all_time') return true;
  const currentMonth = today.slice(0, 7);
  if (filter === 'this_month') return value.slice(0, 7) === currentMonth;

  const [year, month] = currentMonth.split('-').map(Number);
  const previousMonthDate = new Date(year, month - 2, 1);
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`;
  return value.slice(0, 7) === previousMonth;
}

function rowsForClients(clients: ClientWithDetails[], activity: ActivityDetailType): ActivityDetailRow[] {
  return clients
    .filter(client => client.active && (
      activity === 'active_students' ? client.client_type === 'individual' : client.client_type === 'school'
    ))
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map(client => {
      if (activity === 'active_students') {
        const details = client.individual_details;
        const subtitle = [details?.school_name, client.email].filter(Boolean).join(' · ');
        return {
          id: client.id,
          title: details?.student_name || client.display_name,
          subtitle: subtitle || 'No school or email details',
          extra: details?.parent_name ? `Parent or guardian: ${details.parent_name}` : undefined,
          badge: { label: 'Active', variant: 'active' as const },
        };
      }

      const details = client.school_details;
      const subtitle = [
        details?.contact_person ? `Contact: ${details.contact_person}` : null,
        details?.learner_range ? `${details.learner_range} learners` : null,
      ].filter(Boolean).join(' · ');
      return {
        id: client.id,
        title: details?.school_name || client.display_name,
        subtitle: subtitle || client.email || 'No contact details',
        badge: { label: 'Active', variant: 'active' as const },
      };
    });
}

function rowsForSessions(
  sessions: Session[],
  clients: ClientWithDetails[],
  activity: ActivityDetailType,
  filter: TimeFilter,
): ActivityDetailRow[] {
  const today = getLocalDateString();
  const clientNames = new Map(clients.map(client => [client.id, client.display_name]));
  return sessions
    .filter(session => activity === 'completed_sessions'
      ? session.status === 'completed' && isInPeriod(session.date, filter, today)
      : session.status === 'scheduled' && session.date >= today)
    .sort((a, b) => activity === 'upcoming_sessions'
      ? `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`)
      : `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`))
    .map(session => {
      const participantIds = session.participant_ids?.length ? session.participant_ids : [session.client_id];
      const names = participantIds.map(id => clientNames.get(id)).filter(Boolean);
      const location = session.location ? ` · ${session.location}` : '';
      return {
        id: session.id,
        title: names.join(', ') || clientNames.get(session.client_id) || 'Session',
        subtitle: `${formatDate(session.date)} at ${session.start_time}${location}`,
        extra: session.session_type === 'online' ? 'Online session' : 'In-person session',
        badge: activity === 'completed_sessions'
          ? { label: 'Completed', variant: 'completed' as const }
          : { label: 'Scheduled', variant: 'scheduled' as const },
      };
    });
}

function rowsForInvoices(invoices: Invoice[], clients: ClientWithDetails[]): ActivityDetailRow[] {
  const clientNames = new Map(clients.map(client => [client.id, client.display_name]));
  const today = getLocalDateString();
  return invoices
    .filter(invoice => invoice.status === 'unpaid')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map(invoice => {
      const overdue = invoice.due_date < today;
      return {
        id: invoice.id,
        title: clientNames.get(invoice.client_id) || 'Unknown client',
        subtitle: invoice.description || 'Invoice',
        extra: `Due ${formatDate(invoice.due_date)}`,
        value: formatZAR(invoice.amount),
        badge: { label: overdue ? 'Overdue' : 'Unpaid', variant: 'unpaid' as const },
      };
    });
}

export default function ActivityDetailModal({ activity, filter, onClose }: ActivityDetailModalProps) {
  const [rows, setRows] = useState<ActivityDetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activity) return;
    let cancelled = false;
    const coachId = authService.getCurrentCoachId();
    setRows([]);
    setError(null);
    setLoading(true);

    if (!coachId) {
      setError('Your session has expired. Please sign in again.');
      setLoading(false);
      return;
    }

    const load = async () => {
      if (activity === 'active_students' || activity === 'active_schools') {
        const clients = await clientService.getClients(coachId);
        return rowsForClients(clients, activity);
      }

      if (activity === 'completed_sessions' || activity === 'upcoming_sessions') {
        const [sessions, clients] = await Promise.all([
          sessionService.getSessions(coachId),
          clientService.getClients(coachId),
        ]);
        return rowsForSessions(sessions, clients, activity, filter);
      }

      const [invoices, clients] = await Promise.all([
        invoiceService.getInvoices(coachId),
        clientService.getClients(coachId),
      ]);
      return rowsForInvoices(invoices, clients);
    };

    load()
      .then(result => {
        if (!cancelled) setRows(result);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load these records. Please close this window and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [activity, filter]);

  if (!activity) return null;

  const subtitle = activity === 'completed_sessions'
    ? `Showing sessions for ${FILTER_LABELS[filter]}`
    : activity === 'unpaid_invoices'
      ? 'All invoices awaiting payment'
      : loading
        ? 'Loading records…'
        : `${rows.length} ${rows.length === 1 ? 'record' : 'records'}`;

  const emptyIcon = activity === 'active_students'
    ? GraduationCap
    : activity === 'unpaid_invoices'
      ? FileText
      : activity === 'completed_sessions' || activity === 'upcoming_sessions'
        ? CalendarDays
        : Users;

  return (
    <Modal open onClose={onClose} title={TITLES[activity]} subtitle={subtitle} size="lg">
      {loading ? (
        <div className="space-y-3" aria-label="Loading activity records">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`activity-detail-skeleton-${index}`} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--background-secondary)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="px-4 py-3 rounded-lg text-sm" role="alert" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
          {error}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={emptyIcon} title={`No ${TITLES[activity].toLowerCase()} to show`} description="There are no matching records right now." />
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{row.title}</p>
                <p className="text-xs mt-1 truncate" style={{ color: 'var(--foreground-muted)' }}>{row.subtitle}</p>
                {row.extra && <p className="text-xs mt-1 truncate" style={{ color: 'var(--foreground-subtle)' }}>{row.extra}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {row.value && <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{row.value}</span>}
                {row.badge && <StatusBadge variant={row.badge.variant} label={row.badge.label} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
