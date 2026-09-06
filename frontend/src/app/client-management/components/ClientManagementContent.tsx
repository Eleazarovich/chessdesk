'use client';
import React, { useState, useEffect, useMemo } from 'react';
import type { ClientWithDetails, ClientType } from '@/lib/types';
import { clientService } from '@/lib/services/clientService';
import { authService } from '@/lib/services/authService';
import ClientTable from './ClientTable';
import AddClientModal from './AddClientModal';
import { TableRowSkeleton } from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { Users, Plus, Search, AlertTriangle, GraduationCap, Building2, UserCheck } from 'lucide-react';

type FilterType = 'all' | ClientType;

export default function ClientManagementContent() {
  const [clients, setClients] = useState<ClientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadClients = () => {
    const coachId = authService.getCurrentCoachId();
    if (!coachId) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    setLoading(true);
    setError(null);
    clientService.getClients(coachId)
      .then(data => { setClients(data); setLoading(false); })
      .catch(() => { setError('Failed to load clients. Check your connection and try again.'); setLoading(false); });
  };

  useEffect(() => { loadClients(); }, []);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchesSearch = c.display_name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'all' || c.client_type === typeFilter;
      const matchesActive = !activeOnly || c.active;
      return matchesSearch && matchesType && matchesActive;
    });
  }, [clients, search, typeFilter, activeOnly]);

  const counts = useMemo(() => ({
    all: clients.length,
    individual: clients.filter(c => c.client_type === 'individual').length,
    school: clients.filter(c => c.client_type === 'school').length,
    active: clients.filter(c => c.active).length,
  }), [clients]);

  const TYPE_FILTERS: { label: string; value: FilterType; count: number; icon: React.ReactNode }[] = [
    { label: 'All Clients', value: 'all', count: counts.all, icon: <Users size={13} /> },
    { label: 'Students', value: 'individual', count: counts.individual, icon: <GraduationCap size={13} /> },
    { label: 'Schools', value: 'school', count: counts.school, icon: <Building2 size={13} /> },
  ];

  return (
    <div className="space-y-4 fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
            {counts.active} active — {counts.individual} students, {counts.school} schools
          </p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium btn-primary"
        >
          <Plus size={15} />
          Add Client
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--foreground-subtle)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-3 py-2 text-sm input-dark"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={`type-filter-${f.value}`}
              onClick={() => setTypeFilter(f.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                typeFilter === f.value
                  ? 'bg-primary text-white' :'text-foreground-muted hover:text-foreground hover:bg-surface-elevated border border-border'
              }`}
            >
              {f.icon}
              {f.label}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-2xs font-semibold ${
                typeFilter === f.value ? 'bg-white/20 text-white' : 'bg-surface-elevated text-foreground-subtle'
              }`}>
                {f.count}
              </span>
            </button>
          ))}

          {/* Active toggle */}
          <button
            onClick={() => setActiveOnly(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              activeOnly
                ? 'bg-accent-muted text-accent border border-accent/20' :'text-foreground-muted hover:text-foreground hover:bg-surface-elevated border border-border'
            }`}
          >
            <UserCheck size={13} />
            Active only
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background-secondary)' }}>
                {['Client', 'Type', 'Contact', 'Comm. Method', 'Notifications', 'Next Session', 'Outstanding', 'Status', 'Actions'].map(h => (
                  <th key={`th-${h}`} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-subtle)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={`row-skel-${i}`} cols={9} />)}
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search || typeFilter !== 'all' ? 'No clients match your filters' : 'No clients yet'}
            description={search || typeFilter !== 'all' ?'Try adjusting your search or filter criteria.' :'Add your first individual student or school client to get started.'}
            action={!search && typeFilter === 'all' ? { label: 'Add First Client', onClick: () => setAddModalOpen(true) } : undefined}
          />
        ) : (
          <ClientTable clients={filtered} onRefresh={loadClients} />
        )}
      </div>

      {/* Result count */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>
          Showing {filtered.length} of {clients.length} clients
        </p>
      )}

      {/* Add Client Modal */}
      <AddClientModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => { setAddModalOpen(false); loadClients(); }}
      />
    </div>
  );
}
