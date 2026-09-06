'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Copy, CheckCircle2, Loader2 } from 'lucide-react';
import { authService } from '@/lib/services/authService';
import { useRouter } from 'next/navigation';

interface LoginFormData {
  email: string;
  password: string;
  remember: boolean;
}

interface LoginFormProps {
  onForgotPassword: () => void;
}

const DEMO_CREDENTIALS = {
  email: 'thabo@chessops.co.za',
  password: 'chess2026!',
};

export default function LoginForm({ onForgotPassword }: LoginFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    defaultValues: { email: '', password: '', remember: false },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setServerError('');
    try {
      await authService.login({ email: data.email, password: data.password });
      router.push('/');
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const autofill = () => {
    setValue('email', DEMO_CREDENTIALS.email);
    setValue('password', DEMO_CREDENTIALS.password);
  };

  const copyToClipboard = async (field: 'email' | 'password') => {
    await navigator.clipboard.writeText(DEMO_CREDENTIALS[field]);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Welcome back</h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Sign in to your ChessOps account</p>
      </div>

      {serverError && (
        <div className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
          {serverError}
        </div>
      )}

      {/* Email */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
          Email address
        </label>
        <input
          type="email"
          autoComplete="email"
          placeholder="coach@example.co.za"
          className="w-full px-3 py-2.5 text-sm input-dark"
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
          })}
        />
        {errors.email && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>
            Password
          </label>
          <button type="button" onClick={onForgotPassword} className="text-xs hover:underline" style={{ color: 'var(--primary)' }}>
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            className="w-full px-3 py-2.5 pr-10 text-sm input-dark"
            {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Password must be at least 6 characters' } })}
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost p-0"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.password.message}</p>}
      </div>

      {/* Remember me */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="remember"
          className="w-4 h-4 rounded accent-primary"
          {...register('remember')}
        />
        <label htmlFor="remember" className="text-sm cursor-pointer" style={{ color: 'var(--foreground-muted)' }}>
          Remember me
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-sm font-medium btn-primary disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ minHeight: '42px' }}
      >
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Signing in…
          </>
        ) : 'Sign In'}
      </button>

      {/* Demo credentials */}
      <div className="mt-4 rounded-xl p-4 space-y-3" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--foreground-subtle)', letterSpacing: '0.06em' }}>
            Demo Account
          </p>
          <button
            type="button"
            onClick={autofill}
            className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-150"
            style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}
          >
            Autofill
          </button>
        </div>
        <div className="space-y-2">
          {(['email', 'password'] as const).map(field => (
            <div key={`cred-${field}`} className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-2xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--foreground-subtle)' }}>{field}</p>
                <p className="text-xs font-mono truncate" style={{ color: 'var(--foreground-muted)' }}>{DEMO_CREDENTIALS[field]}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(field)}
                className="flex-shrink-0 p-1.5 rounded-lg btn-ghost"
                aria-label={`Copy ${field}`}
              >
                {copiedField === field ? <CheckCircle2 size={13} style={{ color: 'var(--accent)' }} /> : <Copy size={13} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}