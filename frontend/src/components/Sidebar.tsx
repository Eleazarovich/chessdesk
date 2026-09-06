'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLogo from './ui/AppLogo';
import { authService } from '@/lib/services/authService';
import { clientService } from '@/lib/services/clientService';
import { sessionService } from '@/lib/services/sessionService';
import { invoiceService } from '@/lib/services/invoiceService';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList,
  FileText, Banknote, Settings, ChevronLeft, ChevronRight,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: keyof SidebarCounts;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard size={18} /> },
  { label: 'Clients', href: '/client-management', icon: <Users size={18} />, badge: 'clients' },
  { label: 'Schedule', href: '/schedule', icon: <CalendarDays size={18} /> },
  { label: 'Sessions', href: '/sessions', icon: <ClipboardList size={18} />, badge: 'scheduledSessions' },
  { label: 'Invoices', href: '/invoices', icon: <FileText size={18} />, badge: 'unpaidInvoices' },
  { label: 'Expenses', href: '/expenses', icon: <Banknote size={18} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
];

interface SidebarCounts {
  clients: number;
  scheduledSessions: number;
  unpaidInvoices: number;
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  activePath?: string;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, activePath }: SidebarProps) {
  const router = useRouter();
  const [counts, setCounts] = useState<SidebarCounts>({ clients: 0, scheduledSessions: 0, unpaidInvoices: 0 });
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    if (signingOut) return;
    setSigningOut(true);
    void authService.logout().catch(() => undefined);
    router.replace('/sign-up-login-screen');
  };

  useEffect(() => {
    const coachId = authService.getCurrentCoachId();
    if (!coachId) return;

    let cancelled = false;
    Promise.all([
      clientService.getClients(coachId),
      sessionService.getSessions(coachId),
      invoiceService.getInvoices(coachId),
    ]).then(([clients, sessions, invoices]) => {
      if (cancelled) return;
      setCounts({
        clients: clients.length,
        scheduledSessions: sessions.filter(session => session.status === 'scheduled').length,
        unpaidInvoices: invoices.filter(invoice => invoice.status === 'unpaid').length,
      });
    }).catch(() => {
      // Sidebar counts are supplementary to the page-level data.
    });

    return () => { cancelled = true; };
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return activePath === '/' || activePath === undefined;
    return activePath?.startsWith(href);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col sidebar-transition overflow-hidden
          border-r z-30 flex-shrink-0
        `}
        style={{
          width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
          background: 'var(--background-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <SidebarContent collapsed={collapsed} onToggle={onToggle} isActive={isActive} counts={counts} onSignOut={handleSignOut} signingOut={signingOut} />
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col lg:hidden
          transform transition-transform duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--background-secondary)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <SidebarContent collapsed={false} onToggle={onMobileClose} isActive={isActive} isMobile counts={counts} onSignOut={handleSignOut} signingOut={signingOut} />
      </aside>
    </>
  );
}

interface SidebarContentProps {
  collapsed: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean | undefined;
  counts: SidebarCounts;
  onSignOut: () => void;
  signingOut: boolean;
  isMobile?: boolean;
}

function SidebarContent({ collapsed, onToggle, isActive, counts, onSignOut, signingOut, isMobile }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b ${collapsed && !isMobile ? 'justify-center' : ''}`} style={{ borderColor: 'var(--border)' }}>
        <AppLogo size={28} />
        {(!collapsed || isMobile) && (
          <div className="min-w-0">
            <span className="font-display font-semibold text-sm block leading-tight" style={{ color: 'var(--foreground)' }}>ChessDesk</span>
            <span className="text-2xs block" style={{ color: 'var(--foreground-subtle)' }}>Run your chess coaching business from one place.</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={`nav-${item.href}`}
              href={item.href}
              title={collapsed && !isMobile ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150 group relative
                ${active
                  ? 'bg-primary-muted text-primary border border-primary/20' :'text-foreground-muted hover:bg-surface-elevated hover:text-foreground border border-transparent'
                }
                ${collapsed && !isMobile ? 'justify-center' : ''}
              `}
            >
              <span className={`flex-shrink-0 ${active ? 'text-primary' : 'text-foreground-muted group-hover:text-foreground'}`}>
                {item.icon}
              </span>
              {(!collapsed || isMobile) && (
                <span className="flex-1 min-w-0 truncate">{item.label}</span>
              )}
              {(!collapsed || isMobile) && item.badge !== undefined && counts[item.badge] > 0 && (
                <span className="flex-shrink-0 text-2xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
                  {counts[item.badge]}
                </span>
              )}
              {collapsed && !isMobile && item.badge !== undefined && counts[item.badge] > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onSignOut}
          disabled={signingOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground-muted hover:bg-surface-elevated hover:text-destructive transition-all duration-150 ${collapsed && !isMobile ? 'justify-center' : ''}`}
        >
          <LogOut size={16} />
          {(!collapsed || isMobile) && <span>{signingOut ? 'Signing out…' : 'Sign Out'}</span>}
        </button>

        {!isMobile && (
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-foreground-subtle hover:text-foreground-muted hover:bg-surface-elevated transition-all duration-150"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );
}
