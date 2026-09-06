'use client';
import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { authService } from '@/lib/services/authService';
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

  useEffect(() => {
    if (authService.getStoredUser()) {
      setAuthorized(true);
    } else {
      router.replace('/sign-up-login-screen');
    }
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
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          onMenuClick={() => setMobileSidebarOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
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
