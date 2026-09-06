import React from 'react';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--surface-elevated)' }} />;
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <SkeletonBlock className="h-3.5 w-24 mb-4" />
      <SkeletonBlock className="h-8 w-32 mb-3" />
      <SkeletonBlock className="h-3 w-20" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 8 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={`skel-col-${i}`} className="px-4 py-3">
          <SkeletonBlock className={`h-4 ${i === 0 ? 'w-32' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <SkeletonBlock className="w-full rounded-xl" style={{ height }} />;
}