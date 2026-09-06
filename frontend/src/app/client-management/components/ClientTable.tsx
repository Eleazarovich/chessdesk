'use client';
import React, { useState } from 'react';
import type { ClientWithDetails } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import { Edit2, Trash2, CalendarDays, MessageSquare, Mail } from 'lucide-react';
import { clientService } from '@/lib/services/clientService';
import Modal from '@/components/ui/Modal';
import Toggle from '@/components/ui/Toggle';

interface ClientTableProps {
  clients: ClientWithDetails[];
  onRefresh: () => void;
}

function formatZAR(amount: number): string {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function formatUpcoming(dateTimeStr: string | null | undefined): string {
  if (!dateTimeStr) return '—';
  const [datePart, timePart] = dateTimeStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[month - 1]} ${year}, ${timePart}`;
}

function CommBadge({ method }: { method: 'whatsapp' | 'email' | 'both' }) {
  if (method === 'whatsapp') return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>
      <MessageSquare size={11} /> WhatsApp
    </span>
  );
  if (method === 'email') return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--info)' }}>
      <Mail size={11} /> Email
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--primary)' }}>
      <MessageSquare size={11} /><Mail size={11} /> Both
    </span>
  );
}

interface EditClientModalProps {
  client: ClientWithDetails;
  onClose: () => void;
  onSuccess: () => void;
}

function EditClientModal({ client, onClose, onSuccess }: EditClientModalProps) {
  const [displayName, setDisplayName] = useState(client.display_name);
  const [email, setEmail] = useState(client.email);
  const [whatsapp, setWhatsapp] = useState(client.whatsapp);
  const [commMethod, setCommMethod] = useState(client.preferred_communication);
  const [notifications, setNotifications] = useState(client.notifications_enabled);
  const [active, setActive] = useState(client.active);
  const [notes, setNotes] = useState(client.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!displayName.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await clientService.updateClient(client.id, {
        display_name: displayName,
        email,
        whatsapp,
        preferred_communication: commMethod,
        notifications_enabled: notifications,
        active,
        notes,
      });
      onSuccess();
    } catch {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Client"
      subtitle={`Editing ${client.display_name}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border" style={{ borderColor: 'var(--border)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Display Name *</label>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>WhatsApp</label>
            <input type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Communication Method</label>
          <div className="flex gap-2">
            {(['whatsapp', 'email', 'both'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setCommMethod(m)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
                style={{
                  background: commMethod === m ? 'var(--primary)' : 'var(--surface-elevated)',
                  color: commMethod === m ? 'white' : 'var(--foreground-muted)',
                }}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Notifications</p>
          <Toggle checked={notifications} onChange={setNotifications} size="md" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Active</p>
          <Toggle checked={active} onChange={setActive} size="md" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Notes</label>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 text-sm input-dark resize-none" />
        </div>
      </div>
    </Modal>
  );
}

export default function ClientTable({ clients, onRefresh }: ClientTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<ClientWithDetails | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await clientService.deleteClient(id);
      onRefresh();
    } catch {
      // The page refreshes its data after successful mutations.
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--background-secondary)' }}>
              {[
                { label: 'Client Name', w: 'w-44' },
                { label: 'Type', w: 'w-24' },
                { label: 'Contact', w: 'w-48' },
                { label: 'Comm. Method', w: 'w-28' },
                { label: 'Notifications', w: 'w-28' },
                { label: 'Next Session', w: 'w-44' },
                { label: 'Outstanding', w: 'w-28' },
                { label: 'Status', w: 'w-20' },
                { label: '', w: 'w-24' },
              ].map(h => (
                <th key={`th-${h.label || 'actions'}`} className={`${h.w} px-4 py-3 text-left text-xs font-medium uppercase tracking-wide`} style={{ color: 'var(--foreground-subtle)', letterSpacing: '0.06em' }}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((client, idx) => (
              <tr
                key={`client-row-${client.id}`}
                className="row-hover transition-colors duration-100 group"
                style={{
                  borderBottom: idx < clients.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                {/* Client name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{
                        background: client.client_type === 'individual' ? 'var(--primary-muted)' : 'var(--info-muted)',
                        color: client.client_type === 'individual' ? 'var(--primary)' : 'var(--info)',
                      }}
                    >
                      {client.display_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-[140px]" style={{ color: 'var(--foreground)' }}>{client.display_name}</p>
                      {client.individual_details?.parent_name && (
                        <p className="text-xs truncate max-w-[140px]" style={{ color: 'var(--foreground-subtle)' }}>
                          {client.individual_details.parent_name}
                        </p>
                      )}
                      {client.school_details?.contact_person && (
                        <p className="text-xs truncate max-w-[140px]" style={{ color: 'var(--foreground-subtle)' }}>
                          {client.school_details.contact_person}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Type */}
                <td className="px-4 py-3">
                  <StatusBadge variant={client.client_type} />
                  {client.school_details?.learner_range && (
                    <p className="text-2xs mt-1" style={{ color: 'var(--foreground-subtle)' }}>
                      {client.school_details.learner_range} learners
                    </p>
                  )}
                </td>

                {/* Contact */}
                <td className="px-4 py-3">
                  <p className="text-xs truncate max-w-[180px]" style={{ color: 'var(--foreground-muted)' }}>{client.email}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-subtle)' }}>{client.whatsapp}</p>
                </td>

                {/* Comm method */}
                <td className="px-4 py-3">
                  <CommBadge method={client.preferred_communication} />
                </td>

                {/* Notifications */}
                <td className="px-4 py-3">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: client.notifications_enabled ? 'var(--accent-muted)' : 'var(--surface-elevated)',
                      color: client.notifications_enabled ? 'var(--accent)' : 'var(--foreground-subtle)',
                    }}
                  >
                    {client.notifications_enabled ? 'On' : 'Off'}
                  </span>
                </td>

                {/* Next session */}
                <td className="px-4 py-3">
                  {client.upcoming_session ? (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      <CalendarDays size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      {formatUpcoming(client.upcoming_session)}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>None scheduled</span>
                  )}
                </td>

                {/* Outstanding */}
                <td className="px-4 py-3">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: client.outstanding_amount > 0 ? 'var(--warning)' : 'var(--foreground-subtle)' }}
                  >
                    {client.outstanding_amount > 0 ? formatZAR(client.outstanding_amount) : '—'}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge variant={client.active ? 'active' : 'inactive'} />
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title="Edit client"
                      onClick={() => setEditingClient(client)}
                      className="p-1.5 rounded-lg btn-ghost"
                      aria-label="Edit client"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      title="Delete client — this cannot be undone"
                      onClick={() => setConfirmDeleteId(client.id)}
                      className="p-1.5 rounded-lg btn-ghost hover:text-destructive"
                      aria-label="Delete client"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSuccess={() => { setEditingClient(null); onRefresh(); }}
        />
      )}

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-glass scale-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Delete client?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--foreground-muted)' }}>
              This will permanently delete the client and all associated data. This cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border border-border"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 flex items-center gap-2 transition-all duration-150"
                style={{ background: 'var(--destructive)' }}
              >
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Delete Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
