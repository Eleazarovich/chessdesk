import React from 'react';
import type { DashboardFinancials } from '@/lib/types';
import { TrendingUp, TrendingDown, Wallet, Banknote, AlertCircle, ArrowDownCircle } from 'lucide-react';

interface KpiBentoGridProps {
  financials: DashboardFinancials;
}

function formatZAR(amount: number): string {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function KpiBentoGrid({ financials }: KpiBentoGridProps) {
  const cards = [
    {
      id: 'kpi-revenue',
      label: 'Revenue Earned',
      value: formatZAR(financials.revenue_earned),
      subtext: 'Total invoiced this period',
      icon: <TrendingUp size={18} />,
      variant: 'neutral' as const,
      trend: null,
    },
    {
      id: 'kpi-payments',
      label: 'Payments Received',
      value: formatZAR(financials.payments_received),
      subtext: 'Cash collected',
      icon: <Wallet size={18} />,
      variant: 'positive' as const,
      trend: financials.payments_received >= financials.revenue_earned * 0.8 ? 'good' : 'low',
    },
    {
      id: 'kpi-outstanding',
      label: 'Outstanding',
      value: formatZAR(financials.outstanding),
      subtext: financials.outstanding > 0 ? 'Awaiting payment' : 'All invoices paid',
      icon: <AlertCircle size={18} />,
      variant: financials.outstanding > 0 ? 'warning' as const : 'positive' as const,
      trend: financials.outstanding > 0 ? 'alert' : null,
    },
    {
      id: 'kpi-expenses',
      label: 'Expenses',
      value: formatZAR(financials.expenses),
      subtext: 'Total spend this period',
      icon: <ArrowDownCircle size={18} />,
      variant: 'default' as const,
      trend: null,
    },
    {
      id: 'kpi-net',
      label: 'Net Income',
      value: formatZAR(financials.net_income),
      subtext: 'Payments minus expenses',
      icon: <Banknote size={18} />,
      variant: financials.net_income >= 0 ? 'positive' as const : 'negative' as const,
      trend: financials.net_income >= 0 ? 'positive' : 'negative',
    },
  ];

  const cardClass: Record<string, string> = {
    positive: 'kpi-card-positive',
    negative: 'kpi-card-negative',
    warning: 'kpi-card-warning',
    neutral: 'kpi-card-neutral',
    default: 'kpi-card-default',
  };

  const iconBg: Record<string, string> = {
    positive: 'var(--accent-muted)',
    negative: 'var(--destructive-muted)',
    warning: 'var(--warning-muted)',
    neutral: 'var(--primary-muted)',
    default: 'var(--surface-elevated)',
  };

  const iconColor: Record<string, string> = {
    positive: 'var(--accent)',
    negative: 'var(--destructive)',
    warning: 'var(--warning)',
    neutral: 'var(--primary)',
    default: 'var(--foreground-muted)',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-5 gap-3">
      {cards.map(card => (
        <div
          key={card.id}
          className={`rounded-xl p-4 transition-all duration-200 hover:shadow-card cursor-default ${cardClass[card.variant]}`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-muted)', letterSpacing: '0.06em' }}>
              {card.label}
            </p>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg[card.variant] }}>
              <span style={{ color: iconColor[card.variant] }}>{card.icon}</span>
            </div>
          </div>
          <p className="text-xl font-bold tabular-nums mb-1" style={{ color: 'var(--foreground)' }}>
            {card.value}
          </p>
          <div className="flex items-center gap-1.5">
            {card.trend === 'alert' && <AlertCircle size={11} style={{ color: 'var(--warning)' }} />}
            {card.trend === 'positive' && <TrendingUp size={11} style={{ color: 'var(--accent)' }} />}
            {card.trend === 'negative' && <TrendingDown size={11} style={{ color: 'var(--destructive)' }} />}
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{card.subtext}</p>
          </div>
        </div>
      ))}
    </div>
  );
}