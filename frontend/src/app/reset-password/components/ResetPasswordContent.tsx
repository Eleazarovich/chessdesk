'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { authService } from '@/lib/services/authService';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordContent() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordFormData>();
  const password = watch('password');

  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    setToken(resetToken);
    setTokenReady(true);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setLoading(true);
    setServerError('');
    try {
      await authService.confirmPasswordReset(token, data.password);
      setSuccess(true);
    } catch {
      setServerError('This reset link may have expired or already been used. Request a new link and try again.');
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => router.replace('/sign-up-login-screen');

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 chess-pattern"
      style={{ background: 'var(--background)' }}
    >
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-md relative z-10 scale-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <AppLogo size={36} />
            <span className="font-display text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>ChessDesk</span>
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--foreground-muted)' }}>
            Run your chess coaching business from one place.
          </p>
        </div>

        <div className="glass-card-elevated rounded-2xl shadow-glass overflow-hidden p-6">
          {success ? (
            <div className="text-center py-2 space-y-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: 'var(--accent-muted)' }}>
                <CheckCircle2 size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <h1 className="font-display text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Password updated</h1>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Your password has been changed. Sign in with your new password.
                </p>
              </div>
              <button onClick={backToLogin} className="w-full py-2.5 rounded-lg text-sm font-medium btn-primary">
                Back to login
              </button>
            </div>
          ) : !tokenReady ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              <Loader2 size={15} className="animate-spin" />
              Checking reset link…
            </div>
          ) : !token ? (
            <div className="text-center py-2 space-y-4">
              <div>
                <h1 className="font-display text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Reset link unavailable</h1>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Request a new password reset link to continue.
                </p>
              </div>
              <button onClick={backToLogin} className="w-full py-2.5 rounded-lg text-sm font-medium btn-primary">
                <span className="inline-flex items-center justify-center gap-1.5">
                  <ArrowLeft size={14} />
                  Back to login
                </span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <h1 className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Choose a new password</h1>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Use at least 8 characters.</p>
              </div>

              {serverError && (
                <div className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
                  {serverError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="reset-password" className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
                  New password
                </label>
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 text-sm input-dark"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                  })}
                />
                {errors.password && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.password.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reset-confirm-password" className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
                  Confirm new password
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 text-sm input-dark"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: value => value === password || 'Passwords do not match',
                  })}
                />
                {errors.confirmPassword && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-sm font-medium btn-primary disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ minHeight: '42px' }}
              >
                {loading ? <><Loader2 size={15} className="animate-spin" /> Updating password…</> : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--foreground-subtle)' }}>
          © 2026 ChessDesk · Built for independent chess coaches in South Africa
        </p>
      </div>
    </div>
  );
}
