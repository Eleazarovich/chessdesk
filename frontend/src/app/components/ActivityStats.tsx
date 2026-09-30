import React from 'react';
import type { DashboardActivity } from '@/lib/types';
import { GraduationCap, Building2, CheckCircle2, CalendarClock, FileWarning, ChevronRight } from 'lucide-react';

export type ActivityDetailType = 'active_students' | 'active_schools' | 'completed_sessions' | 'upcoming_sessions' | 'unpaid_invoices';

interface ActivityStatsProps {
  activity: DashboardActivity;
  onSelect: (type: ActivityDetailType) => void;
}

export default function ActivityStats({ activity, onSelect }: ActivityStatsProps) {
  const stats = [
    {
      id: 'stat-students',
      detailType: 'active_students' as const,
      label: 'Active Students',
      value: activity.active_individual_students,
      icon: <GraduationCap size={16} />,
      color: 'var(--primary)',
      bg: 'var(--primary-muted)',
    },
    {
      id: 'stat-schools',
      detailType: 'active_schools' as const,
      label: 'Active Schools',
      value: activity.active_schools,
      icon: <Building2 size={16} />,
      color: 'var(--info)',
      bg: 'var(--info-muted)',
    },
    {
      id: 'stat-completed',
      detailType: 'completed_sessions' as const,
      label: 'Sessions Completed',
      value: activity.sessions_completed,
      icon: <CheckCircle2 size={16} />,
      color: 'var(--accent)',
      bg: 'var(--accent-muted)',
    },
    {
      id: 'stat-upcoming',
      detailType: 'upcoming_sessions' as const,
      label: 'Upcoming Sessions',
      value: activity.upcoming_sessions,
      icon: <CalendarClock size={16} />,
      color: 'var(--primary)',
      bg: 'var(--primary-muted)',
    },
    {
      id: 'stat-unpaid',
      detailType: 'unpaid_invoices' as const,
      label: 'Unpaid Invoices',
      value: activity.unpaid_invoices,
      icon: <FileWarning size={16} />,
      color: activity.unpaid_invoices > 0 ? 'var(--warning)' : 'var(--accent)',
      bg: activity.unpaid_invoices > 0 ? 'var(--warning-muted)' : 'var(--accent-muted)',
    },
  ];

  return (
    <div className="rounded-xl p-5 h-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Business Activity</h3>
      <div className="space-y-3">
        {stats.map(stat => (
          <button
            type="button"
            key={stat.id}
            id={stat.id}
            onClick={() => onSelect(stat.detailType)}
            aria-label={`View ${stat.value} ${stat.label.toLowerCase()}`}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-surface-elevated hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: stat.bg }}>
                <span style={{ color: stat.color }}>{stat.icon}</span>
              </div>
              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{stat.label}</span>
            </div>
            <span className="flex items-center gap-1.5">
              <span className="text-lg font-bold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </span>
              <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--foreground-subtle)' }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
