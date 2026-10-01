'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '@/lib/services/authService';
import { sessionService } from '@/lib/services/sessionService';
import type { ClientWithDetails, Session, SessionStatus, SessionType } from '@/lib/types';
import { isCurrentOrFutureDate, isCurrentOrFutureDateTime } from '@/lib/dateUtils';
import DateTimeInput from '@/components/ui/DateTimeInput';
import Modal from '@/components/ui/Modal';

type SessionCategory = 'students' | 'school';

interface SessionFormData {
  category: SessionCategory | '';
  student_ids: string[];
  school_id: string;
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
  initialClientId?: string;
  templateSession?: Session | null;
}

function initialForm(
  session: Session | null | undefined,
  templateSession: Session | null | undefined,
  initialClientId: string | undefined,
  clients: ClientWithDetails[],
): SessionFormData {
  const source = session ?? templateSession;
  const clientId = source?.client_id ?? initialClientId ?? '';
  const participantIds = source?.participant_ids?.length ? source.participant_ids : clientId ? [clientId] : [];
  const selectedClient = clients.find(client => client.id === clientId);
  const category: SessionCategory | '' = !clientId
    ? ''
    : selectedClient?.client_type === 'school' ? 'school' : 'students';

  return {
    category,
    student_ids: category === 'students' ? participantIds : [],
    school_id: category === 'school' ? clientId : '',
    date: session?.date ?? '',
    start_time: source?.start_time ?? '',
    planned_duration: source?.planned_duration ?? 60,
    session_type: source?.session_type ?? 'in-person',
    location: source?.location ?? '',
    status: session?.status ?? 'scheduled',
    notes: source?.notes ?? '',
  };
}

export default function SessionModal({
  open,
  onClose,
  onSuccess,
  clients,
  editSession,
  initialClientId,
  templateSession,
}: SessionModalProps) {
  const isEdit = !!editSession;
  const [form, setForm] = useState<SessionFormData>(() => initialForm(editSession, templateSession, initialClientId, clients));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const students = useMemo(() => clients.filter(client => client.client_type === 'individual'), [clients]);
  const schools = useMemo(() => clients.filter(client => client.client_type === 'school'), [clients]);

  useEffect(() => {
    if (open) {
      setForm(initialForm(editSession, templateSession, initialClientId, clients));
      setError('');
    }
  }, [open, editSession, templateSession, initialClientId, clients]);

  const set = (key: keyof SessionFormData, value: string | number) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const setCategory = (category: SessionCategory) => {
    setForm(current => ({
      ...current,
      category,
      student_ids: [],
      school_id: '',
    }));
  };

  const setStudentSelected = (studentId: string, selected: boolean) => {
    setForm(current => {
      const studentIds = selected
        ? [...current.student_ids.filter(id => id !== studentId), studentId]
        : current.student_ids.filter(id => id !== studentId);
      return { ...current, student_ids: studentIds };
    });
  };

  const handleSave = async () => {
    const clientIds = form.category === 'students'
      ? form.student_ids
      : form.category === 'school' && form.school_id ? [form.school_id] : [];
    if (!clientIds.length || !form.date || !form.start_time) {
      const targetError = form.category === 'students' ? 'at least one student' : form.category === 'school' ? 'a school' : 'Students or School';
      setError(`Choose ${targetError}, then enter a date and start time.`);
      return;
    }
    if (form.status !== 'completed') {
      if (!isCurrentOrFutureDate(form.date)) {
        setError('Date cannot be in the past.');
        return;
      }
      if (!isCurrentOrFutureDateTime(form.date, form.start_time)) {
        setError('Start time cannot be in the past.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const commonData = {
        date: form.date,
        start_time: form.start_time,
        planned_duration: form.planned_duration,
        session_type: form.session_type,
        location: form.location,
        status: form.status,
        notes: form.notes,
      };
      let result: Session;
      if (isEdit && editSession) {
        const updated = await sessionService.updateSession(editSession.id, {
          ...commonData,
          client_id: clientIds[0],
          participant_ids: clientIds,
        });
        result = updated;
      } else {
        const coachId = authService.getCurrentCoachId();
        if (!coachId) throw new Error('Authentication required');
        result = await sessionService.createSession({
          ...commonData,
          actual_duration: null,
          coach_id: coachId,
          client_id: clientIds[0],
          participant_ids: clientIds,
        });
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
      subtitle={templateSession && !isEdit ? `Details copied from ${templateSession.date}. Choose a new date.` : undefined}
      size="md"
      footer={(
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Session'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {error && <div role="alert" className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>{error}</div>}

        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Session for *</legend>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Session category">
            {(['students', 'school'] as const).map(category => (
              <button
                key={category}
                type="button"
                aria-pressed={form.category === category}
                onClick={() => setCategory(category)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium ${form.category === category ? 'btn-primary border-primary' : 'btn-ghost'}`}
                style={form.category === category ? undefined : { borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
              >
                {category === 'students' ? 'Students' : 'School'}
              </button>
            ))}
          </div>
        </fieldset>

        {form.category === 'students' ? (
          <fieldset className="space-y-2">
            <legend className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Select {isEdit ? 'student' : 'students'} *</legend>
            <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>
              {isEdit ? 'Choose one student for this session.' : 'Choose one student or several for a group session.'}
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg border divide-y" style={{ borderColor: 'var(--border)' }}>
              {students.length ? students.map(student => (
                <label key={student.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                  <input
                    type="checkbox"
                    checked={form.student_ids.includes(student.id)}
                    onChange={event => setStudentSelected(student.id, event.target.checked)}
                    className="rounded border-gray-500 text-primary focus:ring-primary"
                  />
                  <span>{student.display_name}</span>
                </label>
              )) : <p className="px-3 py-3 text-sm" style={{ color: 'var(--foreground-subtle)' }}>No students available.</p>}
            </div>
          </fieldset>
        ) : form.category === 'school' ? (
          <div className="space-y-1.5">
            <label htmlFor="session-school" className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Select school *</label>
            <select id="session-school" value={form.school_id} onChange={event => set('school_id', event.target.value)} className="w-full px-3 py-2 text-sm input-dark">
              <option value="">Select school…</option>
              {schools.map(school => <option key={school.id} value={school.id}>{school.display_name}</option>)}
            </select>
            {!schools.length && <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>No schools available.</p>}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Choose Students or School to select who this session is for.</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Date *</label>
            <DateTimeInput type="date" allowPast={form.status === 'completed'} value={form.date} onChange={event => set('date', event.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Start Time *</label>
            <DateTimeInput type="time" dateValue={form.date} allowPast={form.status === 'completed'} value={form.start_time} onChange={event => set('start_time', event.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Duration (min)</label>
            <input type="number" min={15} step={15} value={form.planned_duration} onChange={event => set('planned_duration', Number(event.target.value))} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Type</label>
            <select value={form.session_type} onChange={event => set('session_type', event.target.value)} className="w-full px-3 py-2 text-sm input-dark">
              <option value="in-person">In-person</option>
              <option value="online">Online</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Location</label>
          <input type="text" value={form.location} onChange={event => set('location', event.target.value)} placeholder="e.g. Rosebank Library" className="w-full px-3 py-2 text-sm input-dark" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Status</label>
          <select value={form.status} onChange={event => set('status', event.target.value)} className="w-full px-3 py-2 text-sm input-dark">
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Notes</label>
          <textarea rows={2} value={form.notes} onChange={event => set('notes', event.target.value)} className="w-full px-3 py-2 text-sm input-dark resize-none" />
        </div>
      </div>
    </Modal>
  );
}
