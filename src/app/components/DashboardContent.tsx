'use client';
import React, { useState, useEffect } from 'react';
import type { DashboardData, TimeFilter } from '@/lib/types';
import { dashboardService } from '@/lib/services/dashboardService';
import KpiBentoGrid from './KpiBentoGrid';
import RevenueChart from './RevenueChart';
import SessionsBarChart from './SessionsBarChart';
import UpcomingSessionsList from './UpcomingSessionsList';
import ActivityStats from './ActivityStats';
import { KpiCardSkeleton, ChartSkeleton, SkeletonBlock } from '@/components/ui/LoadingSkeleton';
import { RefreshCw, AlertTriangle } from 'lucide-react';

const TIME_FILTERS: { label: string; value: TimeFilter }[] = [
  { label: 'This Month', value: 'this_month' },
  { label: 'Previous Month', value: 'previous_month' },
  { label: 'All Time', value: 'all_time' },
];

export default function DashboardContent() {
  const [filter, setFilter] = useState<TimeFilter>('this_month');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    dashboardService.getDashboardData('coach-001', filter)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load dashboard data. Please try again.'); setLoading(false); });
  }, [filter]);

  return (
    <div className="space-y-4 fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
            Nkosi Chess Academy — financial & activity overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--foreground-subtle)' }}>
            <RefreshCw size={11} />
            Updated 06 Sep 2026, 01:04
          </span>
          {/* Time filter tabs */}
          <div className="flex rounded-lg p-0.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {TIME_FILTERS.map(f => (
              <button
                key={`filter-${f.value}`}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  filter === f.value
                    ? 'bg-primary text-white shadow-primary'
                    : 'text-foreground-muted hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={`kpi-skel-${i}`} />)}
        </div>
      ) : data ? (
        <KpiBentoGrid financials={data.financials} />
      ) : null}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          {loading ? <ChartSkeleton height={260} /> : data ? <RevenueChart data={data.revenue_chart} /> : null}
        </div>
        <div>
          {loading ? <ChartSkeleton height={260} /> : data ? <SessionsBarChart data={data.sessions_chart} /> : null}
        </div>
      </div>

      {/* Activity + Upcoming */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1">
          {loading ? (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonBlock key={`act-skel-${i}`} className="h-10 w-full" />)}
            </div>
          ) : data ? (
            <ActivityStats activity={data.activity} />
          ) : null}
        </div>
        <div className="xl:col-span-2">
          {loading ? (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={`up-skel-${i}`} className="h-14 w-full" />)}
            </div>
          ) : data ? (
            <UpcomingSessionsList sessions={data.upcoming_sessions} />
          ) : null}
        </div>
      </div>
    </div>
  );
}