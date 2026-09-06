'use client';
import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { RevenueChartPoint } from '@/lib/types';

interface RevenueChartProps {
  data: RevenueChartPoint[];
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
      <p className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{label} 2026</p>
      {payload.map(entry => (
        <div key={`tooltip-${entry.name}`} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--foreground-muted)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
            R{entry.value.toLocaleString('en-ZA')}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Revenue vs Expenses</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Last 6 months — Rand (ZAR)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="paymentsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--warning)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--warning)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: 'var(--foreground-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--foreground-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R${(v / 1000).toFixed(0)}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'var(--foreground-muted)' }}
            iconType="circle"
            iconSize={7}
          />
          <Area type="monotone" dataKey="revenue" name="Revenue Earned" stroke="var(--primary)" strokeWidth={2} fill="url(#revenueGrad)" />
          <Area type="monotone" dataKey="payments" name="Payments Received" stroke="var(--accent)" strokeWidth={2} fill="url(#paymentsGrad)" />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="var(--warning)" strokeWidth={2} fill="url(#expensesGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}