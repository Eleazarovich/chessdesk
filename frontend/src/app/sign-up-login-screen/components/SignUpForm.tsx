'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { authService } from '@/lib/services/authService';

interface SignUpFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

interface SignUpFormProps {
  onSuccess: () => void;
}

export default function SignUpForm({ onSuccess }: SignUpFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, watch, formState: { errors } } = useForm<SignUpFormData>();
  const password = watch('password');

  const onSubmit = async (data: SignUpFormData) => {
    setLoading(true);
    setServerError('');
    try {
      await authService.signUp({ name: data.name, email: data.email, password: data.password });
      onSuccess();
    } catch {
      setServerError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Create your account</h2>
        <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Start managing your chess coaching business</p>
      </div>

      {serverError && (
        <div className="px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
          {serverError}
        </div>
      )}

      {/* Full name */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Full name</label>
        <input
          type="text"
          placeholder="Thabo Nkosi"
          className="w-full px-3 py-2.5 text-sm input-dark"
          {...register('name', { required: 'Full name is required', minLength: { value: 2, message: 'Name must be at least 2 characters' } })}
        />
        {errors.name && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.name.message}</p>}
      </div>

      {/* Email */}
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

      {/* Password */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Password</label>
        <p className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>At least 8 characters</p>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a strong password"
            className="w-full px-3 py-2.5 pr-10 text-sm input-dark"
            {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Password must be at least 8 characters' } })}
          />
          <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost p-0" aria-label="Toggle password">
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.password.message}</p>}
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Confirm password</label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Repeat your password"
            className="w-full px-3 py-2.5 pr-10 text-sm input-dark"
            {...register('confirmPassword', {
              required: 'Please confirm your password',
              validate: v => v === password || 'Passwords do not match',
            })}
          />
          <button type="button" onClick={() => setShowConfirm(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 btn-ghost p-0" aria-label="Toggle confirm password">
            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.confirmPassword && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.confirmPassword.message}</p>}
      </div>

      {/* Terms */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            className="w-4 h-4 rounded accent-primary mt-0.5"
            {...register('terms', { required: 'You must accept the terms to continue' })}
          />
          <label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>
            I agree to the{' '}
            <span className="underline cursor-pointer" style={{ color: 'var(--primary)' }}>Terms of Service</span>
            {' '}and{' '}
            <span className="underline cursor-pointer" style={{ color: 'var(--primary)' }}>Privacy Policy</span>
          </label>
        </div>
        {errors.terms && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{errors.terms.message}</p>}
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
            Creating account…
          </>
        ) : 'Create Account'}
      </button>
    </form>
  );
}