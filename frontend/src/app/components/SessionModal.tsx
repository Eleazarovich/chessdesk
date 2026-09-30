'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '@/lib/services/authService';
import { sessionService } from '@/lib/services/sessionService';
import type { ClientWithDetails, Session, SessionStatus, SessionType } from '@/lib/types';
import { isCurrentOrFutureDate, isCurrentOrFutureDateTime } from '@/lib/dateUtils';
import DateTimeInput from '@/components/ui/DateTimeInput';
import Modal from '@/components/ui/Modal';

interface SessionFormData {
  client_id: string;
  participant_ids: string[];
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

function initialForm(session?: Session | null): SessionFormData {
  const participantIds = session?.participant_ids?.length
    ? session.participant_ids
    : session?.client_id ? [session.client_id] : [];
  return {
    client_id: participantIds[0] ?? '',
    participant_ids: participantIds,
    date: session?.date ?? '',
    start_time: session?.start_time ?? '',
    planned_duration: session?.planned_duration ?? 60,
    session_type: session?.session_type ?? 'in-person',
    location: session?.location ?? '',
    status: session?.status ?? 'scheduled',
    notes: session?.notes ?? '',
  };
}

export default function SessionModal({ open, onClose, onSuccess, clients, editSession }: SessionModalProps) {
  const isEdit = !!editSession;
  const [form, setForm] = useState<SessionFormData>(() => initialForm(editSession));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const students = useMemo(() => clients.filter(client => client.client_type === 'individual'), [clients]);
  const schools = useMemo(() => clients.filter(client => client.client_type === 'school'), [clients]);
  const selectedSchoolId = form.participant_ids.find(id => schools.some(school => school.id === id)) ?? '';

  useEffect(() => {
    if (open) {
      setForm(initialForm(editSession));
      setError('');
    }
  }, [open, editSession]);

  const set = (key: keyof SessionFormData, value: string | number) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const setStudentSelected = (studentId: string, selected: boolean) => {
    setForm(current => {
      const selectedStudents = current.participant_ids.filter(id => students.some(student => student.id === id));
      const nextStudents = selected
        ? [...selectedStudents, studentId]
        : selectedStudents.filter(id => id !== studentId);
      return { ...current, client_id: nextStudents[0] ?? '', participant_ids: nextStudents };
    });
  };

  const setSchoolSelected = (schoolId: string) => {
    setForm(current => ({
      ...current,
      client_id: schoolId,
      participant_ids: schoolId ? [schoolId] : [],
    }));
  };

  const handleSave = async () => {
    if (!form.participant_ids.length || !form.date || !form.start_time) {
      setError('Select at least one student or school, then enter a date and start time.');
      return;
    }
    if (!isCurrentOrFutureDate(form.date)) {
      setError('Date cannot be in the past.');
      return;
    }
    if (!isCurrentOrFutureDateTime(form.date, form.start_time)) {
      setError('Start time cannot be in the past.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const data = {
        ...form,
        client_id: form.participant_ids[0],
        participant_ids: form.participant_ids,
      };
      let result: Session;
      if (isEdit && editSession) {
        result = await sessionService.updateSession(editSession.id, data);
      } else {
        const coachId = authService.getCurrentCoachId();
        if (!coachId) throw new Error('Authentication required');
        result = await sessionService.createSession({ ...data, coach_id: coachId, actual_duration: null });
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
          <legend className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Students *</legend>
          <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Select one or more students for this session.</p>
          <div className="max-h-40 overflow-y-auto rounded-lg border divide-y" style={{ borderColor: 'var(--border)' }}>
            {students.length ? students.map(student => (
              <label key={student.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={form.participant_ids.includes(student.id)}
                  onChange={event => setStudentSelected(student.id, event.target.checked)}
                  className="rounded border-gray-500 text-primary focus:ring-primary"
                />
                <span>{student.display_name}</span>
              </label>
            )) : <p className="px-3 py-3 text-sm" style={{ color: 'var(--foreground-subtle)' }}>No students available.</p>}
          </div>
        </fieldset>

        {schools.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Or schedule for a school</label>
            <select value={selectedSchoolId} onChange={event => setSchoolSelected(event.target.value)} className="w-full px-3 py-2 text-sm input-dark">
              <option value="">No school selected</option>
              {schools.map(school => <option key={school.id} value={school.id}>{school.display_name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Date *</label>
            <DateTimeInput type="date" value={form.date} onChange={event => set('date', event.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Start Time *</label>
            <DateTimeInput type="time" dateValue={form.date} value={form.start_time} onChange={event => set('start_time', event.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
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
