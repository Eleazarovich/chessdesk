'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { authService } from '@/lib/services/authService';

interface ForgotFormData {
  email: string;
}

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export default function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotFormData>();

  const onSubmit = async (data: ForgotFormData) => {
    setLoading(true);
    setServerError('');
    try {
      await authService.resetPassword(data.email);
      setSent(true);
    } catch {
      setServerError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-4 space-y-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'var(--accent-muted)' }}>
          <CheckCircle2 size={22} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Check your inbox</h2>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            If that email is registered, a password reset link has been sent.
          </p>
        </div>
        <button onClick={onBack} className="text-sm font-medium flex items-center gap-1.5 mx-auto" style={{ color: 'var(--primary)' }}>
          <ArrowLeft size={14} />
          Back to login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm mb-2 btn-ghost px-0" style={{ color: 'var(--foreground-muted)' }}>
        <ArrowLeft size={14} />
        Back to login
      </button>

      <div>
        <h2 className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Reset your password</h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Enter your account email and we'll send you a reset link.
        </p>
      </div>

      {serverError && (
        <div className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
          {serverError}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Email address</label>
        <input
          type="email"
          placeholder="coach@example.co.za"
          className="w-full px-3 py-2.5 text-sm input-dark"
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
          })}
        />
        {errors.email && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.email.message}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-medium btn-primary disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ minHeight: '42px' }}
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Sending reset link…
          </>
        ) : 'Send Reset Link'}
      </button>
    </form>
  );
}