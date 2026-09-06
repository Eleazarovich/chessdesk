import React from 'react';
import { LucideIcon } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--primary-muted)' }}>
        <Icon size={24} style={{ color: 'var(--primary)' }} />
      </div>
      <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{title}</h3>
      <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-4 py-2 rounded-lg text-sm font-medium btn-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}