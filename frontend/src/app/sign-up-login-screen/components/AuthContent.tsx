'use client';
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import ForgotPasswordForm from './ForgotPasswordForm';
import AppLogo from '@/components/ui/AppLogo';
import { useRouter } from 'next/navigation';

type AuthView = 'login' | 'signup' | 'forgot';

export default function AuthContent() {
  const router = useRouter();
  const [view, setView] = useState<AuthView>('login');

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 chess-pattern"
      style={{ background: 'var(--background)' }}
    >
      {/* Background glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-md relative z-10 scale-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-3">
            <AppLogo size={36} />
            <span className="font-display text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>ChessDesk</span>
          </div>
          <p className="text-sm text-center" style={{ color: 'var(--foreground-muted)' }}>
            Run your chess coaching business from one place.
          </p>
        </div>

        {/* Card */}
        <div className="glass-card-elevated rounded-2xl shadow-glass overflow-hidden">
          {/* Tabs */}
          {view !== 'forgot' && (
            <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setView('login')}
                className={`flex-1 py-3.5 text-sm font-medium transition-all duration-150 ${view === 'login' ? 'text-primary border-b-2 border-primary' : 'text-foreground-muted hover:text-foreground'}`}
              >
                Log In
              </button>
              <button
                onClick={() => setView('signup')}
                className={`flex-1 py-3.5 text-sm font-medium transition-all duration-150 ${view === 'signup' ? 'text-primary border-b-2 border-primary' : 'text-foreground-muted hover:text-foreground'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          <div className="p-6">
            {view === 'login' && <LoginForm onForgotPassword={() => setView('forgot')} />}
            {view === 'signup' && <SignUpForm onSuccess={() => router.push('/')} />}
            {view === 'forgot' && <ForgotPasswordForm onBack={() => setView('login')} />}
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--foreground-subtle)' }}>
          © 2026 ChessDesk · Built for independent chess coaches in South Africa
        </p>
      </div>
    </div>
  );
}
