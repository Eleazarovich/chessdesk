'use client';
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Menu, Bell, Search, LogOut, X, Users, ClipboardList, FileText, ChevronRight } from 'lucide-react';
import AppLogo from './ui/AppLogo';
import { authService } from '@/lib/services/authService';
import { clientService } from '@/lib/services/clientService';
import { sessionService } from '@/lib/services/sessionService';
import { invoiceService } from '@/lib/services/invoiceService';
import { useRouter } from 'next/navigation';
import type { AuthUser, ClientWithDetails, Invoice, Session } from '@/lib/types';
import { DATA_CHANGED_EVENT, type DataChangeDetail } from '@/lib/api';
import { formatLocalDateTime } from '@/lib/dateUtils';

interface TopbarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
  onLogout: () => Promise<void>;
  loggingOut: boolean;
}

interface SearchResult {
  id: string;
  type: 'client' | 'session' | 'invoice';
  title: string;
  subtitle: string;
  href: string;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'client' | 'payment' | 'session' | 'invoice' | 'expense' | 'system';
  href: string;
}

const notifColor: Record<NotificationItem['type'], string> = {
  client: 'var(--info)',
  payment: 'var(--success)',
  session: 'var(--primary)',
  invoice: 'var(--warning)',
  expense: '#F97316',
  system: 'var(--foreground-subtle)',
};

const NOTIFICATION_STORAGE_KEY = 'chessdesk_activity_notifications';
const MAX_NOTIFICATIONS = 30;

function notificationStorageKey(userId: string): string {
  return `${NOTIFICATION_STORAGE_KEY}:${userId}`;
}

function readStoredNotifications(userId: string): NotificationItem[] {
  try {
    const raw = localStorage.getItem(notificationStorageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is NotificationItem => (
      item !== null &&
      typeof item === 'object' &&
      typeof (item as NotificationItem).id === 'string' &&
      typeof (item as NotificationItem).title === 'string' &&
      typeof (item as NotificationItem).body === 'string' &&
      typeof (item as NotificationItem).time === 'string' &&
      typeof (item as NotificationItem).read === 'boolean' &&
      typeof (item as NotificationItem).href === 'string'
    )).slice(0, MAX_NOTIFICATIONS);
  } catch {
    return [];
  }
}

function persistNotifications(userId: string, notifications: NotificationItem[]): void {
  try {
    localStorage.setItem(notificationStorageKey(userId), JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // Notifications are supplementary and should never interrupt a saved change.
  }
}

function recordFrom(detail: DataChangeDetail): Record<string, unknown> {
  return detail.record !== null && typeof detail.record === 'object'
    ? detail.record as Record<string, unknown>
    : {};
}

function textValue(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value ? value : null;
}

function makeNotificationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createActivityNotification(
  detail: DataChangeDetail,
  clientNameMap: Record<string, string>,
): NotificationItem | null {
  const [resource, resourceId] = detail.path.replace(/^\/+/, '').split('/');
  const record = recordFrom(detail);
  const method = detail.method;
  const action = method === 'POST' ? 'created' : method === 'PATCH' ? 'updated' : 'deleted';
  const hrefByResource: Record<string, string> = {
    clients: '/client-management',
    sessions: '/schedule',
    invoices: '/invoices',
    expenses: '/expenses',
    coaches: '/settings',
  };
  const href = hrefByResource[resource];
  if (!href) return null;

  let title = '';
  let body = '';
  let type: NotificationItem['type'] = 'system';

  if (resource === 'clients') {
    const name = textValue(record, 'display_name') ?? 'A client';
    title = `Client ${action}`;
    body = `${name} was ${action}.`;
    type = 'client';
  } else if (resource === 'sessions') {
    const clientName = clientNameMap[textValue(record, 'client_id') ?? ''] ?? 'A client';
    const date = textValue(record, 'date');
    const startTime = textValue(record, 'start_time');
    const schedule = date && startTime ? ` · ${date} at ${startTime}` : '';
    const status = textValue(record, 'status');
    title = status === 'cancelled' ? 'Session cancelled'
      : status === 'completed' ? 'Session completed'
        : method === 'POST' ? 'Session scheduled' : 'Session updated';
    body = `${clientName}${schedule}`;
    type = 'session';
  } else if (resource === 'invoices') {
    const invoiceId = textValue(record, 'id') ?? resourceId ?? 'Invoice';
    const amount = typeof record.amount === 'number' ? ` · R${record.amount.toLocaleString('en-ZA')}` : '';
    title = textValue(record, 'status') === 'paid' ? 'Invoice marked paid' : `Invoice ${action}`;
    body = `${invoiceId}${amount}`;
    type = textValue(record, 'status') === 'paid' ? 'payment' : 'invoice';
  } else if (resource === 'expenses') {
    const amount = typeof record.amount === 'number' ? `R${record.amount.toLocaleString('en-ZA')}` : 'An expense';
    const category = textValue(record, 'category');
    title = `Expense ${action}`;
    body = category ? `${amount} · ${category}` : amount;
    type = 'expense';
  } else if (resource === 'coaches' && detail.path.endsWith('/profile')) {
    title = 'Profile updated';
    body = 'Your account details were updated.';
  } else {
    return null;
  }

  return {
    id: makeNotificationId(),
    title,
    body,
    time: detail.occurredAt,
    read: false,
    type,
    href,
  };
}

function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return formatLocalDateTime(date);
}

export default function Topbar({ onMenuClick, onLogout, loggingOut }: TopbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [clients, setClients] = useState<ClientWithDetails[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = authService.getStoredUser();
    setUser(storedUser);
    if (!storedUser) return;

    let cancelled = false;
    Promise.all([
      clientService.getClients(storedUser.id),
      sessionService.getSessions(storedUser.id),
      invoiceService.getInvoices(storedUser.id),
    ]).then(([clientData, sessionData, invoiceData]) => {
      if (cancelled) return;
      setClients(clientData);
      setSessions(sessionData);
      setInvoices(invoiceData);
    }).catch(() => {
      // The page-level data views surface API errors; the topbar is auxiliary.
    });

    return () => { cancelled = true; };
  }, []);

  // Restore activity for this account and keep it in sync across tabs.
  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    const key = notificationStorageKey(user.id);
    setNotifications(readStoredNotifications(user.id));
    const handleStorage = (event: StorageEvent) => {
      if (event.key === key) setNotifications(readStoredNotifications(user.id));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [user?.id]);

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

  const clientNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach(client => { map[client.id] = client.display_name; });
    return map;
  }, [clients]);

  // Every successful mutation made by the app becomes an activity notification.
  useEffect(() => {
    if (!user?.id) return;

    const handleDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<DataChangeDetail>).detail;
      if (!detail) return;
      const notification = createActivityNotification(detail, clientNameMap);
      if (!notification) return;

      setNotifications(previous => {
        const next = [notification, ...previous].slice(0, MAX_NOTIFICATIONS);
        persistNotifications(user.id, next);
        return next;
      });
    };

    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged);
  }, [user?.id, clientNameMap]);

  // Search logic runs against the records loaded from the backend.
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];

    // Clients
    clients.filter(c =>
      c.display_name.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    ).slice(0, 3).forEach(c => results.push({
      id: c.id, type: 'client',
      title: c.display_name,
      subtitle: c.client_type === 'school' ? 'School client' : (c.email ?? 'Individual'),
      href: '/client-management',
    }));

    // Sessions
    sessions.filter(s => {
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
    invoices.filter(inv => {
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
  }, [searchQuery, clients, sessions, invoices, clientNameMap]);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
  };

  const handleResultClick = (href: string) => {
    router.push(href);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const markNotificationRead = (id: string) => {
    if (!user?.id) return;
    setNotifications(previous => {
      const next = previous.map(notification => notification.id === id ? { ...notification, read: true } : notification);
      persistNotifications(user.id, next);
      return next;
    });
  };
  const markAllRead = () => {
    if (!user?.id) return;
    setNotifications(previous => {
      const next = previous.map(notification => ({ ...notification, read: true }));
      persistNotifications(user.id, next);
      return next;
    });
  };
  const handleNotificationClick = (notification: NotificationItem) => {
    markNotificationRead(notification.id);
    router.push(notification.href);
    setNotifOpen(false);
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

      <div className="flex-1" />

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
              {notifications.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm" style={{ color: 'var(--foreground-subtle)' }}>
                  No recent activity
                </li>
              ) : notifications.map(n => (
                <li key={n.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className="w-full flex gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated"
                    style={{ background: n.read ? 'transparent' : 'rgba(139,92,246,0.06)' }}
                  >
                    <span
                      className="flex-shrink-0 w-2 h-2 rounded-full mt-1.5"
                      style={{ background: n.read ? 'var(--foreground-subtle)' : notifColor[n.type] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>{n.title}</p>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--foreground-muted)' }}>{n.body}</p>
                      <p className="text-xs mt-1 opacity-60" style={{ color: 'var(--foreground-subtle)', fontSize: '0.65rem' }}>{formatNotificationTime(n.time)}</p>
                    </div>
                    {!n.read && <span className="text-2xs mt-0.5" style={{ color: 'var(--primary)' }}>New</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Activity from this workspace</span>
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
        onClick={onLogout}
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
