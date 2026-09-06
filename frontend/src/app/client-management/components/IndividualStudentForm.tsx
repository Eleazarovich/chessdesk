'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CommunicationPreference } from '@/lib/types';
import { clientService } from '@/lib/services/clientService';
import { authService } from '@/lib/services/authService';
import Toggle from '@/components/ui/Toggle';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface IndividualFormData {
  student_name: string;
  school_name: string;
  parent_name: string;
  whatsapp: string;
  email: string;
  preferred_communication: CommunicationPreference;
  notifications_enabled: boolean;
  notes: string;
}

interface IndividualStudentFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

const COMM_OPTIONS: { value: CommunicationPreference; label: string; desc: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp', desc: 'Send session notifications via WhatsApp' },
  { value: 'email', label: 'Email', desc: 'Send session notifications via email' },
  { value: 'both', label: 'Both', desc: 'Send via both WhatsApp and email' },
];

export default function IndividualStudentForm({ onBack, onSuccess }: IndividualStudentFormProps) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<IndividualFormData>({
    defaultValues: {
      preferred_communication: 'whatsapp',
      notifications_enabled: true,
      notes: '',
      school_name: '',
    },
  });

  const commMethod = watch('preferred_communication');

  const onSubmit = async (data: IndividualFormData) => {
    setLoading(true);
    setServerError('');
    try {
      const coachId = authService.getCurrentCoachId();
      if (!coachId) throw new Error('Authentication required');
      await clientService.createClient(
        {
          coach_id: coachId,
          client_type: 'individual',
          display_name: data.student_name,
          email: data.email,
          whatsapp: data.whatsapp,
          preferred_communication: data.preferred_communication,
          notifications_enabled: notificationsEnabled,
          notes: data.notes,
          active: true,
        },
        {
          student_name: data.student_name,
          school_name: data.school_name,
          parent_name: data.parent_name,
        }
      );
      setSaved(true);
      setTimeout(() => onSuccess(), 1200);
    } catch {
      setServerError('Failed to save client. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-muted)' }}>
          <CheckCircle2 size={22} style={{ color: 'var(--accent)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Student added successfully!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm btn-ghost px-0 mb-1" style={{ color: 'var(--foreground-muted)' }}>
        <ArrowLeft size={14} />
        Back to client type
      </button>

      {serverError && (
        <div className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
          {serverError}
        </div>
      )}

      {/* Student details section */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide pb-2 border-b" style={{ color: 'var(--foreground-subtle)', borderColor: 'var(--border)', letterSpacing: '0.08em' }}>
          Student Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Student name <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Amahle Dlamini"
              className="w-full px-3 py-2 text-sm input-dark"
              {...register('student_name', { required: 'Student name is required' })}
            />
            {errors.student_name && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.student_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
              School name
              <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--foreground-subtle)' }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Rosebank College Prep"
              className="w-full px-3 py-2 text-sm input-dark"
              {...register('school_name')}
            />
          </div>
        </div>
      </div>

      {/* Parent / guardian section */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide pb-2 border-b" style={{ color: 'var(--foreground-subtle)', borderColor: 'var(--border)', letterSpacing: '0.08em' }}>
          Parent / Guardian Details
        </h3>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Parent / guardian name <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Zanele Dlamini"
            className="w-full px-3 py-2 text-sm input-dark"
            {...register('parent_name', { required: 'Parent or guardian name is required' })}
          />
          {errors.parent_name && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.parent_name.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
              WhatsApp number <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Include country code, e.g. +27 82 123 4567</p>
            <input
              type="tel"
              placeholder="+27 82 123 4567"
              className="w-full px-3 py-2 text-sm input-dark"
              {...register('whatsapp', {
                required: 'WhatsApp number is required',
                pattern: { value: /^\+?[\d\s\-()]{10,}$/, message: 'Enter a valid phone number' },
              })}
            />
            {errors.whatsapp && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.whatsapp.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Email address <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="email"
              placeholder="parent@gmail.com"
              className="w-full px-3 py-2 text-sm input-dark"
              {...register('email', {
                required: 'Email address is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
              })}
            />
            {errors.email && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.email.message}</p>}
          </div>
        </div>
      </div>

      {/* Communication section */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide pb-2 border-b" style={{ color: 'var(--foreground-subtle)', borderColor: 'var(--border)', letterSpacing: '0.08em' }}>
          Communication Preferences
        </h3>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Preferred communication method <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {COMM_OPTIONS.map(opt => (
              <button
                key={`comm-${opt.value}`}
                type="button"
                onClick={() => setValue('preferred_communication', opt.value)}
                className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-center transition-all duration-150 ${
                  commMethod === opt.value
                    ? 'bg-primary-muted border-primary/30 text-primary' :'text-foreground-muted hover:bg-surface-elevated border-border'
                }`}
                style={{ border: '1px solid', borderColor: commMethod === opt.value ? 'var(--primary)' : 'var(--border)' }}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-2xs leading-tight" style={{ color: commMethod === opt.value ? 'var(--primary)' : 'var(--foreground-subtle)' }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Session notifications</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              Automatically send session confirmations, updates, and cancellations
            </p>
          </div>
          <Toggle
            checked={notificationsEnabled}
            onChange={setNotificationsEnabled}
            size="md"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
          Notes
          <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--foreground-subtle)' }}>(optional)</span>
        </label>
        <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Private notes about this student — never shown to clients</p>
        <textarea
          rows={3}
          placeholder="e.g. Preparing for U14 provincials, keen on endgame theory…"
          className="w-full px-3 py-2 text-sm input-dark resize-none"
          {...register('notes')}
        />
      </div>

      {/* Required fields note */}
      <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>
        Fields marked <span style={{ color: 'var(--destructive)' }}>*</span> are required
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border border-border">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-60 flex items-center gap-2"
          style={{ minWidth: '120px', justifyContent: 'center' }}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : 'Add Student'}
        </button>
      </div>
    </form>
  );
}
