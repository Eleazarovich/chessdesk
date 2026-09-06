'use client';
import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { sessionService } from '@/lib/services/sessionService';
import { clientService } from '@/lib/services/clientService';
import type { Session, SessionStatus, SessionType, ClientWithDetails } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { CalendarDays, Clock, MapPin, Monitor, ChevronLeft, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getWeekDates(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

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
        result = await sessionService.createSession({ ...form, coach_id: 'coach-001', actual_duration: null });
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

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<ClientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [anchor, setAnchor] = useState<Date>(() => new Date('2026-09-06'));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      sessionService.getSessions('coach-001'),
      clientService.getClients('coach-001'),
    ]).then(([s, c]) => {
      if (cancelled) return;
      setSessions(s);
      setClients(c);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);

  const sessionsByDay = useMemo(() => {
    const map: Record<string, Session[]> = {};
    sessions.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [sessions]);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach(c => { m[c.id] = c.display_name; });
    return m;
  }, [clients]);

  const displayedSessions = useMemo(() => {
    if (selectedDay) {
      const key = selectedDay.toISOString().slice(0, 10);
      return (sessionsByDay[key] || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return weekDates.flatMap(d => {
      const key = d.toISOString().slice(0, 10);
      return (sessionsByDay[key] || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
  }, [selectedDay, weekDates, sessionsByDay]);

  const prevWeek = () => { const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d); setSelectedDay(null); };
  const nextWeek = () => { const d = new Date(anchor); d.setDate(d.getDate() + 7); setAnchor(d); setSelectedDay(null); };

  const weekLabel = `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[6].getFullYear()}`;

  const handleSessionSaved = (session: Session) => {
    setSessions(prev => {
      const idx = prev.findIndex(s => s.id === session.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = session;
        return updated;
      }
      return [...prev, session];
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
    <AppLayout activePath="/schedule">
      <div className="space-y-4 fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold" style={{ color: 'var(--foreground)' }}>Schedule</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Weekly overview of your coaching sessions</p>
          </div>
          <button onClick={() => { setEditingSession(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> New Session
          </button>
        </div>

        {/* Week navigator */}
        <div className="surface-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevWeek} className="btn-ghost p-2 rounded-lg"><ChevronLeft size={18} /></button>
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{weekLabel}</span>
            <button onClick={nextWeek} className="btn-ghost p-2 rounded-lg"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((d, i) => {
              const key = d.toISOString().slice(0, 10);
              const count = (sessionsByDay[key] || []).length;
              const isSelected = selectedDay ? isSameDay(d, selectedDay) : false;
              const isToday = isSameDay(d, new Date('2026-09-06'));
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(isSelected ? null : d)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-150 ${
                    isSelected ? 'bg-primary-muted border border-primary/30' : 'hover:bg-surface-elevated border border-transparent'
                  }`}
                >
                  <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>{DAYS[d.getDay()]}</span>
                  <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'text-primary-foreground' : ''}`} style={isToday ? { background: 'var(--primary)' } : { color: 'var(--foreground)' }}>
                    {d.getDate()}
                  </span>
                  {count > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sessions list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-subtle)' }}>
            {selectedDay ? `Sessions on ${MONTHS[selectedDay.getMonth()]} ${selectedDay.getDate()}` : 'This Week\'s Sessions'}
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="surface-card rounded-xl h-20 animate-pulse" />)}
            </div>
          ) : displayedSessions.length === 0 ? (
            <div className="surface-card rounded-xl p-10 text-center">
              <CalendarDays size={32} className="mx-auto mb-3" style={{ color: 'var(--foreground-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No sessions for this period</p>
            </div>
          ) : (
            displayedSessions.map(session => (
              <div key={session.id} className="surface-card rounded-xl p-4 flex items-start gap-4 row-hover transition-colors duration-150 group">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center" style={{ background: 'var(--surface-elevated)' }}>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--primary)' }}>{session.start_time}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{clientMap[session.client_id] || session.client_id}</span>
                    <StatusBadge variant={session.status} />
                  </div>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      <Clock size={12} /> {session.planned_duration} min
                    </span>
                    {session.session_type === 'online' ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        <Monitor size={12} /> Online
                      </span>
                    ) : session.location ? (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        <MapPin size={12} /> {session.location}
                      </span>
                    ) : null}
                    <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>{session.date}</span>
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
