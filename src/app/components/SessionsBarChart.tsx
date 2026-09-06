'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { SessionsChartPoint } from '@/lib/types';

interface SessionsBarChartProps {
  data: SessionsChartPoint[];
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 shadow-glass text-sm" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
      <p className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{label}</p>
      {payload.map(entry => (
        <div key={`bar-tip-${entry.name}`} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            <span className="w-2 h-2 rounded-sm" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function SessionsBarChart({ data }: SessionsBarChartProps) {
  return (
    <div className="rounded-xl p-5 h-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="mb-5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Sessions by Month</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Completed vs Upcoming</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }} barSize={10} barGap={2}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: 'var(--foreground-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--foreground-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--foreground-muted)' }} iconType="square" iconSize={7} />
          <Bar dataKey="completed" name="Completed" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="scheduled" name="Upcoming" fill="var(--primary)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="cancelled" name="Cancelled" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}