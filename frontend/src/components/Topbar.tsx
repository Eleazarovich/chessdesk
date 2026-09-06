'use client';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Menu, Bell, Search, LogOut, X, Users, ClipboardList, FileText, ChevronRight } from 'lucide-react';
import AppLogo from './ui/AppLogo';
import { authService } from '@/lib/services/authService';
import { useRouter } from 'next/navigation';
import type { AuthUser } from '@/lib/types';
import { MOCK_CLIENTS, MOCK_SESSIONS, MOCK_INVOICES } from '@/lib/services/mockData';

interface TopbarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

interface SearchResult {
  id: string;
  type: 'client' | 'session' | 'invoice';
  title: string;
  subtitle: string;
  href: string;
}

interface MockNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'payment' | 'session' | 'invoice' | 'system';
}

const MOCK_NOTIFICATIONS: MockNotification[] = [
  { id: 'n1', title: 'Payment received', body: 'Amahle Dlamini paid R800 for August sessions.', time: '2 min ago', read: false, type: 'payment' },
  { id: 'n2', title: 'Session reminder', body: 'Session with Liam van der Berg starts in 1 hour.', time: '58 min ago', read: false, type: 'session' },
  { id: 'n3', title: 'Invoice overdue', body: 'Invoice #inv-003 for Greenfields Primary is 7 days overdue.', time: '3 hrs ago', read: false, type: 'invoice' },
  { id: 'n4', title: 'New client registered', body: 'Sipho Mokoena completed registration.', time: 'Yesterday', read: true, type: 'system' },
  { id: 'n5', title: 'Invoice sent', body: 'Invoice #inv-007 sent to Sunridge High School.', time: '2 days ago', read: true, type: 'invoice' },
];

const notifColor: Record<MockNotification['type'], string> = {
  payment: 'var(--success)',
  session: 'var(--primary)',
  invoice: 'var(--warning)',
  system: 'var(--foreground-subtle)',
};

// Build a client id → name lookup once
const clientNameMap: Record<string, string> = {};
MOCK_CLIENTS.forEach(c => { clientNameMap[c.id] = c.display_name; });

export default function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<MockNotification[]>(MOCK_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(authService.getStoredUser());
  }, []);

  // Refresh user when profile is updated from settings
  useEffect(() => {
    const handleProfileUpdate = () => {
      setUser(authService.getStoredUser());
    };
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search logic — runs synchronously against mock data
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];

    // Clients
    MOCK_CLIENTS.filter(c =>
      c.display_name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    ).slice(0, 3).forEach(c => results.push({
      id: c.id, type: 'client',
      title: c.display_name,
      subtitle: c.client_type === 'school' ? 'School client' : (c.email ?? 'Individual'),
      href: '/client-management',
    }));

    // Sessions
    MOCK_SESSIONS.filter(s => {
      const name = clientNameMap[s.client_id] ?? '';
      return name.toLowerCase().includes(q) ||
        (s.notes ?? '').toLowerCase().includes(q) ||
        (s.status ?? '').toLowerCase().includes(q) ||
        (s.date ?? '').includes(q);
    }).slice(0, 3).forEach(s => results.push({
      id: s.id, type: 'session',
      title: clientNameMap[s.client_id] ?? 'Session',
      subtitle: `${s.date} · ${s.status}`,
      href: '/sessions',
    }));

    // Invoices
    MOCK_INVOICES.filter(inv => {
      const name = clientNameMap[inv.client_id] ?? '';
      return name.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        (inv.status ?? '').toLowerCase().includes(q) ||
        (inv.description ?? '').toLowerCase().includes(q);
    }).slice(0, 3).forEach(inv => results.push({
      id: inv.id, type: 'invoice',
      title: `Invoice #${inv.id}`,
      subtitle: `${clientNameMap[inv.client_id] ?? ''} · R${(inv.amount ?? 0).toLocaleString()}`,
      href: '/invoices',
    }));

    return results.slice(0, 8);
  }, [searchQuery]);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
  };

  const handleResultClick = (href: string) => {
    router.push(href);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const handleLogout = async () => {
    setLoggingOut(true);
    await authService.logout();
    router.push('/sign-up-login-screen');
  };

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')
    : 'TN';

  const typeIcon = (type: SearchResult['type']) => {
    if (type === 'client') return <Users size={13} />;
    if (type === 'session') return <ClipboardList size={13} />;
    return <FileText size={13} />;
  };

  return (
    <header
      className="flex items-center gap-3 px-4 sm:px-6 h-14 flex-shrink-0 border-b"
      style={{ background: 'var(--background-secondary)', borderColor: 'var(--border)' }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg btn-ghost"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile logo */}
      <div className="flex items-center gap-2 lg:hidden">
        <AppLogo size={22} />
        <span className="font-display font-semibold text-sm" style={{ color: 'var(--foreground)' }}>ChessDesk</span>
      </div>

      {/* Search */}
      <div ref={searchRef} className="flex-1 max-w-md hidden sm:block relative">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg input-dark">
          <Search size={14} style={{ color: 'var(--foreground-subtle)' }} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKey}
            placeholder="Search clients, sessions, invoices…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)', caretColor: 'var(--primary)' }}
          />
          {searchQuery ? (
            <button onClick={() => { setSearchQuery(''); }} className="ml-auto flex-shrink-0">
              <X size={13} style={{ color: 'var(--foreground-subtle)' }} />
            </button>
          ) : (
            <span className="ml-auto flex-shrink-0" />
          )}
        </div>

        {/* Search dropdown */}
        {searchOpen && searchQuery.trim() && (
          <div
            className="absolute top-full mt-1 left-0 right-0 rounded-xl border shadow-xl z-50 overflow-hidden"
            style={{ background: 'var(--background-secondary)', borderColor: 'var(--border)' }}
          >
            {searchResults.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--foreground-subtle)' }}>
                No results for &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <ul>
                {searchResults.map(r => (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      onClick={() => handleResultClick(r.href)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-elevated"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
                        {typeIcon(r.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{r.title}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--foreground-subtle)' }}>{r.subtitle}</p>
                      </div>
                      <ChevronRight size={13} style={{ color: 'var(--foreground-subtle)' }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 lg:flex-none" />

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => setNotifOpen(prev => !prev)}
          className="relative p-2 rounded-lg btn-ghost"
          aria-label="Notifications"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
          )}
        </button>

        {/* Notification dropdown */}
        {notifOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-80 rounded-xl border shadow-xl z-50 overflow-hidden"
            style={{ background: 'var(--background-secondary)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                Notifications
                {unreadCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'var(--warning)', color: '#000' }}>
                    {unreadCount}
                  </span>
                )}
              </span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {notifications.map(n => (
                <li
                  key={n.id}
                  className="flex gap-3 px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-surface-elevated cursor-default"
                  style={{ borderColor: 'var(--border)', background: n.read ? 'transparent' : 'rgba(139,92,246,0.06)' }}
                >
                  <span
                    className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                    style={{ background: notifColor[n.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{n.title}</p>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--foreground-subtle)' }}>{n.body}</p>
                    <p className="text-xs mt-1 opacity-60" style={{ color: 'var(--foreground-subtle)', fontSize: '0.65rem' }}>{n.time}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Mock data — connect backend to enable live notifications</span>
            </div>
          </div>
        )}
      </div>

      {/* Avatar + name */}
      <button
        onClick={() => router.push('/settings')}
        className="flex items-center gap-2 rounded-lg px-2 py-1 btn-ghost transition-colors"
        aria-label="Go to settings"
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
          {initials}
        </div>
        <span className="hidden sm:block text-sm font-medium" style={{ color: 'var(--foreground)' }}>{user?.name ?? 'Thabo Nkosi'}</span>
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="p-2 rounded-lg btn-ghost disabled:opacity-50"
        aria-label="Log out"
        title="Log out"
      >
        <LogOut size={16} />
      </button>
    </header>
  );
}