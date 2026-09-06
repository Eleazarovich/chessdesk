'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CommunicationPreference, LearnerRange } from '@/lib/types';
import { clientService } from '@/lib/services/clientService';
import Toggle from '@/components/ui/Toggle';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface SchoolFormData {
  school_name: string;
  contact_person: string;
  whatsapp: string;
  email: string;
  learner_range: LearnerRange;
  preferred_communication: CommunicationPreference;
  notifications_enabled: boolean;
  notes: string;
}

interface SchoolClientFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

const LEARNER_RANGES: LearnerRange[] = ['1-10', '10-20', '20-30', '30-40', '40+'];

const COMM_OPTIONS: { value: CommunicationPreference; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'Both' },
];

export default function SchoolClientForm({ onBack, onSuccess }: SchoolClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<SchoolFormData>({
    defaultValues: {
      preferred_communication: 'email',
      learner_range: '10-20',
      notes: '',
    },
  });

  const commMethod = watch('preferred_communication');
  const learnerRange = watch('learner_range');

  const onSubmit = async (data: SchoolFormData) => {
    setLoading(true);
    setServerError('');
    try {
      // BACKEND INTEGRATION POINT: clientService.createClient maps to POST /clients
      await clientService.createClient(
        {
          coach_id: 'coach-001',
          client_type: 'school',
          display_name: data.school_name,
          email: data.email,
          whatsapp: data.whatsapp,
          preferred_communication: data.preferred_communication,
          notifications_enabled: notificationsEnabled,
          notes: data.notes,
          active: true,
        },
        {
          school_name: data.school_name,
          contact_person: data.contact_person,
          learner_range: data.learner_range,
        }
      );
      setSaved(true);
      setTimeout(() => onSuccess(), 1200);
    } catch {
      setServerError('Failed to save school client. Please try again.');
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
        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>School client added successfully!</p>
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

      {/* School details */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide pb-2 border-b" style={{ color: 'var(--foreground-subtle)', borderColor: 'var(--border)', letterSpacing: '0.08em' }}>
          School Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
              School name <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Greenfields Primary School"
              className="w-full px-3 py-2 text-sm input-dark"
              {...register('school_name', { required: 'School name is required' })}
            />
            {errors.school_name && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.school_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
              Contact person <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Mrs. Karen Botha"
              className="w-full px-3 py-2 text-sm input-dark"
              {...register('contact_person', { required: 'Contact person name is required' })}
            />
            {errors.contact_person && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.contact_person.message}</p>}
          </div>
        </div>

        {/* Learner range */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Approximate number of learners <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>How many learners participate in chess sessions at this school?</p>
          <div className="flex flex-wrap gap-2">
            {LEARNER_RANGES.map(range => (
              <button
                key={`range-${range}`}
                type="button"
                onClick={() => setValue('learner_range', range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  learnerRange === range
                    ? 'bg-primary text-white' :'text-foreground-muted hover:bg-surface-elevated border border-border'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          {errors.learner_range && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.learner_range.message}</p>}
        </div>
      </div>

      {/* Contact details */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide pb-2 border-b" style={{ color: 'var(--foreground-subtle)', borderColor: 'var(--border)', letterSpacing: '0.08em' }}>
          Contact Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
              WhatsApp number <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Contact person's WhatsApp, e.g. +27 11 456 7890</p>
            <input
              type="tel"
              placeholder="+27 11 456 7890"
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
              placeholder="admin@school.co.za"
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

      {/* Communication */}
      <div className="space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide pb-2 border-b" style={{ color: 'var(--foreground-subtle)', borderColor: 'var(--border)', letterSpacing: '0.08em' }}>
          Communication Preferences
        </h3>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Preferred communication method <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {COMM_OPTIONS.map(opt => (
              <button
                key={`school-comm-${opt.value}`}
                type="button"
                onClick={() => setValue('preferred_communication', opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  commMethod === opt.value
                    ? 'bg-primary text-white' :'text-foreground-muted hover:bg-surface-elevated border border-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Session notifications</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>
              Send automatic confirmations, updates, and cancellations to the contact person
            </p>
          </div>
          <Toggle checked={notificationsEnabled} onChange={setNotificationsEnabled} size="md" />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
          Notes
          <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--foreground-subtle)' }}>(optional)</span>
        </label>
        <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Private coaching notes — never shared with the school</p>
        <textarea
          rows={3}
          placeholder="e.g. Wednesday afternoons, school hall. 25 learners. Bring extra boards."
          className="w-full px-3 py-2 text-sm input-dark resize-none"
          {...register('notes')}
        />
      </div>

      <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>
        Fields marked <span style={{ color: 'var(--destructive)' }}>*</span> are required
      </p>

      <div className="flex items-center gap-3 justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border border-border">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-60 flex items-center gap-2"
          style={{ minWidth: '130px', justifyContent: 'center' }}
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Saving…
            </>
          ) : 'Add School Client'}
        </button>
      </div>
    </form>
  );
}