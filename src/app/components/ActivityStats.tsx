import React from 'react';
import type { DashboardActivity } from '@/lib/types';
import { GraduationCap, Building2, CheckCircle2, CalendarClock, FileWarning } from 'lucide-react';

interface ActivityStatsProps {
  activity: DashboardActivity;
}

export default function ActivityStats({ activity }: ActivityStatsProps) {
  const stats = [
    {
      id: 'stat-students',
      label: 'Active Students',
      value: activity.active_individual_students,
      icon: <GraduationCap size={16} />,
      color: 'var(--primary)',
      bg: 'var(--primary-muted)',
    },
    {
      id: 'stat-schools',
      label: 'Active Schools',
      value: activity.active_schools,
      icon: <Building2 size={16} />,
      color: 'var(--info)',
      bg: 'var(--info-muted)',
    },
    {
      id: 'stat-completed',
      label: 'Sessions Completed',
      value: activity.sessions_completed,
      icon: <CheckCircle2 size={16} />,
      color: 'var(--accent)',
      bg: 'var(--accent-muted)',
    },
    {
      id: 'stat-upcoming',
      label: 'Upcoming Sessions',
      value: activity.upcoming_sessions,
      icon: <CalendarClock size={16} />,
      color: 'var(--primary)',
      bg: 'var(--primary-muted)',
    },
    {
      id: 'stat-unpaid',
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
          <div
            key={stat.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-lg"
            style={{ background: 'var(--background-secondary)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: stat.bg }}>
                <span style={{ color: stat.color }}>{stat.icon}</span>
              </div>
              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{stat.label}</span>
            </div>
            <span className="text-lg font-bold tabular-nums" style={{ color: stat.color }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}