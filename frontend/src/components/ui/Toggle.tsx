'use client';
import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function Toggle({ checked, onChange, label, disabled, size = 'sm' }: ToggleProps) {
  const trackW = size === 'sm' ? 'w-8' : 'w-10';
  const trackH = size === 'sm' ? 'h-4.5' : 'h-6';
  const thumbSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const thumbTranslate = size === 'sm' ? (checked ? 'translate-x-4' : 'translate-x-0.5') : (checked ? 'translate-x-5' : 'translate-x-1');

  return (
    <label className={`flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex items-center ${trackW} ${trackH} rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30`}
        style={{ background: checked ? 'var(--primary)' : 'var(--surface-elevated)', border: '1px solid', borderColor: checked ? 'var(--primary)' : 'var(--border)' }}
      >
        <span
          className={`${thumbSize} rounded-full transition-transform duration-200 ${thumbTranslate}`}
          style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
        />
      </button>
      {label && <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{label}</span>}
    </label>
  );
}