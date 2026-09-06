'use client';
import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { settingsService } from '@/lib/services/settingsService';
import { authService, AUTH_STORAGE_KEY } from '@/lib/services/authService';
import type { Coach } from '@/lib/types';
import Toggle from '@/components/ui/Toggle';
import { User, Bell, Shield, Save, Check } from 'lucide-react';

type Tab = 'profile' | 'notifications' | 'security';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User size={15} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { id: 'security', label: 'Security', icon: <Shield size={15} /> },
];

export default function SettingsPage() {
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [form, setForm] = useState<Partial<Coach>>({});
  const [notifSettings, setNotifSettings] = useState({
    session_reminders: true,
    payment_alerts: true,
    weekly_summary: false,
    new_client: true,
  });

  useEffect(() => {
    let cancelled = false;
    const coachId = authService.getCurrentCoachId();
    if (!coachId) {
      setLoading(false);
      return;
    }
    settingsService.getProfile(coachId).then(data => {
      if (cancelled) return;
      setCoach(data);
      setForm(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (!coach) return;
    setSaving(true);
    try {
      const coachId = authService.getCurrentCoachId();
      if (!coachId) throw new Error('Authentication required');
      const updated = await settingsService.updateProfile(coachId, form);
      setCoach(updated);
      // Sync name to stored auth user so Topbar updates immediately
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(AUTH_STORAGE_KEY);
          if (raw) {
            const stored = JSON.parse(raw);
            stored.name = updated.name ?? stored.name;
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(stored));
          }
        } catch {}
        window.dispatchEvent(new Event('profileUpdated'));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg text-sm input-dark";

  return (
    <AppLayout activePath="/settings">
      <div className="space-y-6 fade-in max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-semibold" style={{ color: 'var(--foreground)' }}>Settings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Manage your profile and preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--surface)' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                activeTab === tab.id ? 'text-primary-foreground' : 'text-foreground-muted hover:text-foreground'
              }`}
              style={activeTab === tab.id ? { background: 'var(--primary)' } : {}}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="surface-card rounded-xl p-6 space-y-5">
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--surface-elevated)' }} />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Full Name</label>
                    <input
                      type="text"
                      value={form.name || ''}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Email Address</label>
                    <input
                      type="email"
                      value={form.email || ''}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Phone / WhatsApp</label>
                    <input
                      type="text"
                      value={form.phone || ''}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Business Name</label>
                    <input
                      type="text"
                      value={form.business_name || ''}
                      onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Currency</label>
                    <div
                      className="w-full px-3 py-2.5 rounded-lg text-sm input-dark flex items-center gap-2 cursor-default select-none"
                      style={{ opacity: 0.8 }}
                    >
                      <span style={{ color: 'var(--foreground)' }}>ZAR — South African Rand</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
                  >
                    {saved ? <Check size={15} /> : <Save size={15} />}
                    {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="surface-card rounded-xl p-6 space-y-4">
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Control which notifications you receive.</p>
            {[
              { key: 'session_reminders', label: 'Session Reminders', desc: 'Get reminded before upcoming sessions' },
              { key: 'payment_alerts', label: 'Payment Alerts', desc: 'Alerts for overdue invoices' },
              { key: 'weekly_summary', label: 'Weekly Summary', desc: 'Weekly digest of your coaching activity' },
              { key: 'new_client', label: 'New Client Alerts', desc: 'Notify when a new client is added' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{item.desc}</p>
                </div>
                <Toggle
                  checked={notifSettings[item.key as keyof typeof notifSettings]}
                  onChange={v => setNotifSettings(s => ({ ...s, [item.key]: v }))}
                />
              </div>
            ))}
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="surface-card rounded-xl p-6 space-y-5">
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Update your password and security settings.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Current Password</label>
                <input type="password" placeholder="••••••••" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>New Password</label>
                <input type="password" placeholder="••••••••" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Confirm New Password</label>
                <input type="password" placeholder="••••••••" className={inputClass} />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium">
                <Save size={15} /> Update Password
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
