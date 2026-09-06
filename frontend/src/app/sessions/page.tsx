'use client';
import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { sessionService } from '@/lib/services/sessionService';
import { clientService } from '@/lib/services/clientService';
import { authService } from '@/lib/services/authService';
import type { Session, SessionStatus, SessionType, ClientWithDetails } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { ClipboardList, Clock, MapPin, Monitor, Search, Plus, Edit2, Trash2 } from 'lucide-react';

const STATUS_FILTERS: { label: string; value: SessionStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

interface SessionFormData {
  client_id: string;
  date: string;
  start_time: string;
  planned_duration: number;
  session_type: SessionType;
  location: string;
  status: SessionStatus;
  notes: string;
}

interface SessionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (session: Session) => void;
  clients: ClientWithDetails[];
  editSession?: Session | null;
}

function SessionModal({ open, onClose, onSuccess, clients, editSession }: SessionModalProps) {
  const isEdit = !!editSession;
  const [form, setForm] = useState<SessionFormData>({
    client_id: editSession?.client_id ?? '',
    date: editSession?.date ?? '',
    start_time: editSession?.start_time ?? '',
    planned_duration: editSession?.planned_duration ?? 60,
    session_type: editSession?.session_type ?? 'in-person',
    location: editSession?.location ?? '',
    status: editSession?.status ?? 'scheduled',
    notes: editSession?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        client_id: editSession?.client_id ?? '',
        date: editSession?.date ?? '',
        start_time: editSession?.start_time ?? '',
        planned_duration: editSession?.planned_duration ?? 60,
        session_type: editSession?.session_type ?? 'in-person',
        location: editSession?.location ?? '',
        status: editSession?.status ?? 'scheduled',
        notes: editSession?.notes ?? '',
      });
      setError('');
    }
  }, [open, editSession]);

  const set = (k: keyof SessionFormData, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.client_id || !form.date || !form.start_time) {
      setError('Client, date and start time are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let result: Session;
      if (isEdit && editSession) {
        result = await sessionService.updateSession(editSession.id, form);
      } else {
        const coachId = authService.getCurrentCoachId();
        if (!coachId) throw new Error('Authentication required');
        result = await sessionService.createSession({ ...form, coach_id: coachId, actual_duration: null });
      }
      onSuccess(result);
    } catch {
      setError('Failed to save session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Session' : 'New Session'}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Session'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>{error}</div>}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Client *</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="w-full px-3 py-2 text-sm input-dark">
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Date *</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Start Time *</label>
            <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Duration (min)</label>
            <input type="number" min={15} step={15} value={form.planned_duration} onChange={e => set('planned_duration', Number(e.target.value))} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Type</label>
            <select value={form.session_type} onChange={e => set('session_type', e.target.value)} className="w-full px-3 py-2 text-sm input-dark">
              <option value="in-person">In-person</option>
              <option value="online">Online</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Location</label>
          <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Rosebank Library" className="w-full px-3 py-2 text-sm input-dark" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2 text-sm input-dark">
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full px-3 py-2 text-sm input-dark resize-none" />
        </div>
      </div>
    </Modal>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<ClientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const coachId = authService.getCurrentCoachId();
    if (!coachId) {
      setLoading(false);
      return;
    }
    Promise.all([
      sessionService.getSessions(coachId),
      clientService.getClients(coachId),
    ]).then(([s, c]) => {
      if (cancelled) return;
      setSessions(s.sort((a, b) => b.date.localeCompare(a.date)));
      setClients(c);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach(c => { m[c.id] = c.display_name; });
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (clientMap[s.client_id] || '').toLowerCase();
        if (!name.includes(q) && !s.location.toLowerCase().includes(q) && !s.notes.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [sessions, statusFilter, search, clientMap]);

  const counts = useMemo(() => ({
    all: sessions.length,
    scheduled: sessions.filter(s => s.status === 'scheduled').length,
    completed: sessions.filter(s => s.status === 'completed').length,
    cancelled: sessions.filter(s => s.status === 'cancelled').length,
  }), [sessions]);

  const handleSessionSaved = (session: Session) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === session.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = session;
        return updated.sort((a, b) => b.date.localeCompare(a.date));
      }
      return [session, ...prev].sort((a, b) => b.date.localeCompare(a.date));
    });
    setModalOpen(false);
    setEditingSession(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await sessionService.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <AppLayout activePath="/sessions">
      <div className="space-y-4 fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold" style={{ color: 'var(--foreground)' }}>Sessions</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>All coaching sessions across your clients</p>
          </div>
          <button onClick={() => { setEditingSession(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> New Session
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  statusFilter === f.value ? 'text-primary-foreground' : 'text-foreground-muted hover:text-foreground'
                }`}
                style={statusFilter === f.value ? { background: 'var(--primary)' } : {}}
              >
                {f.label} <span className="ml-1 opacity-60">{counts[f.value]}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--foreground-subtle)' }} />
            <input
              type="text"
              placeholder="Search sessions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm input-dark"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="surface-card rounded-xl h-20 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <ClipboardList size={32} className="mx-auto mb-3" style={{ color: 'var(--foreground-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No sessions found</p>
            </div>
          ) : (
            filtered.map(session => (
              <div key={session.id} className="surface-card rounded-xl p-4 flex items-start gap-4 row-hover transition-colors duration-150 group">
                <div className="flex-shrink-0 text-center w-14">
                  <div className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>{session.start_time}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--foreground-subtle)' }}>{session.date.slice(5)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{clientMap[session.client_id] || session.client_id}</span>
                    <StatusBadge variant={session.status} />
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-elevated)', color: 'var(--foreground-muted)' }}>
                      {session.session_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      <Clock size={12} />
                      {session.actual_duration ?? session.planned_duration} min
                      {session.actual_duration && session.actual_duration !== session.planned_duration && (
                        <span style={{ color: 'var(--foreground-subtle)' }}>(planned {session.planned_duration})</span>
                      )}
                    </span>
                    {session.session_type === 'online' ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}><Monitor size={12} /> Online</span>
                    ) : session.location ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}><MapPin size={12} /> {session.location}</span>
                    ) : null}
                  </div>
                  {session.notes && <p className="text-xs mt-1 truncate" style={{ color: 'var(--foreground-subtle)' }}>{session.notes}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => { setEditingSession(session); setModalOpen(true); }}
                    className="p-1.5 rounded-lg btn-ghost"
                    title="Edit session"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(session.id)}
                    className="p-1.5 rounded-lg btn-ghost"
                    title="Delete session"
                    style={{ color: 'var(--destructive)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Session modal */}
      <SessionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSession(null); }}
        onSuccess={handleSessionSaved}
        clients={clients}
        editSession={editingSession}
      />

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-glass scale-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Delete session?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--foreground-muted)' }}>This will permanently remove this session. This cannot be undone.</p>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border border-border">Cancel</button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--destructive)' }}
              >
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Delete Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
