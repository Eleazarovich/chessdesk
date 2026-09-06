import React from 'react';
import type { SessionStatus, InvoiceStatus, ClientType } from '@/lib/types';

type BadgeVariant = SessionStatus | InvoiceStatus | ClientType | 'active' | 'inactive' | 'online' | 'in-person' | 'whatsapp' | 'email' | 'both';

interface StatusBadgeProps {
  variant: BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
}

const BADGE_STYLES: Record<BadgeVariant, string> = {
  scheduled: 'bg-info-muted text-info border-info/20',
  completed: 'bg-success-muted text-accent border-accent/20',
  cancelled: 'bg-destructive-muted text-destructive border-destructive/20',
  unpaid: 'bg-warning-muted text-warning border-warning/20',
  paid: 'bg-success-muted text-accent border-accent/20',
  individual: 'bg-primary-muted text-primary border-primary/20',
  school: 'bg-info-muted text-info border-info/20',
  active: 'bg-success-muted text-accent border-accent/20',
  inactive: 'bg-surface-elevated text-foreground-subtle border-border',
  online: 'bg-info-muted text-info border-info/20',
  'in-person': 'bg-primary-muted text-primary border-primary/20',
  whatsapp: 'bg-success-muted text-accent border-accent/20',
  email: 'bg-info-muted text-info border-info/20',
  both: 'bg-primary-muted text-primary border-primary/20',
};

const BADGE_LABELS: Partial<Record<BadgeVariant, string>> = {
  'in-person': 'In-Person',
  individual: 'Student',
  school: 'School',
};

export default function StatusBadge({ variant, label, size = 'sm' }: StatusBadgeProps) {
  const displayLabel = label ?? BADGE_LABELS[variant] ?? variant.charAt(0).toUpperCase() + variant.slice(1);
  const styles = BADGE_STYLES[variant] ?? 'bg-surface-elevated text-foreground-muted border-border';
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${sizeClass} ${styles}`}>
      {displayLabel}
    </span>
  );
}