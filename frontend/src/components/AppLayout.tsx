'use client';
import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { authService } from '@/lib/services/authService';
import { SESSION_EXPIRED_EVENT } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AppLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

export default function AppLayout({ children, activePath }: AppLayoutProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (authService.getStoredUser()) {
      setAuthorized(true);
    } else {
      router.replace('/sign-up-login-screen');
    }
  }, [router]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      router.replace('/sign-up-login-screen');
    }
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      setAuthorized(false);
      router.replace('/sign-up-login-screen');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [router]);

  if (!authorized) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        activePath={activePath}
        onSignOut={handleLogout}
        signingOut={loggingOut}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onLogout={handleLogout}
          loggingOut={loggingOut}
        />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 sm:px-5 lg:px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-screen-xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
