'use client';
import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { invoiceService } from '@/lib/services/invoiceService';
import { clientService } from '@/lib/services/clientService';
import { authService } from '@/lib/services/authService';
import type { Invoice, InvoiceStatus, ClientWithDetails } from '@/lib/types';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import DateTimeInput from '@/components/ui/DateTimeInput';
import { isCurrentOrFutureDate } from '@/lib/dateUtils';
import { exportInvoicePDF } from '@/lib/invoiceExport';
import { FileText, CheckCircle, Search, Plus, Edit2, Trash2, Download } from 'lucide-react';

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Paid', value: 'paid' },
];

function formatZAR(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface InvoiceFormData {
  client_id: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  description: string;
  notes: string;
}

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (invoice: Invoice) => void;
  clients: ClientWithDetails[];
  editInvoice?: Invoice | null;
}

function InvoiceModal({ open, onClose, onSuccess, clients, editInvoice }: InvoiceModalProps) {
  const isEdit = !!editInvoice;
  const [form, setForm] = useState<InvoiceFormData>({
    client_id: editInvoice?.client_id ?? '',
    invoice_date: editInvoice?.invoice_date ?? '',
    due_date: editInvoice?.due_date ?? '',
    amount: editInvoice?.amount ?? 0,
    description: editInvoice?.description ?? '',
    notes: editInvoice?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        client_id: editInvoice?.client_id ?? '',
        invoice_date: editInvoice?.invoice_date ?? '',
        due_date: editInvoice?.due_date ?? '',
        amount: editInvoice?.amount ?? 0,
        description: editInvoice?.description ?? '',
        notes: editInvoice?.notes ?? '',
      });
      setError('');
    }
  }, [open, editInvoice]);

  const set = (k: keyof InvoiceFormData, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.client_id || !form.invoice_date || !form.due_date || form.amount <= 0) {
      setError('Client, dates and amount are required.');
      return;
    }
    if (!isCurrentOrFutureDate(form.invoice_date) || !isCurrentOrFutureDate(form.due_date)) {
      setError('Invoice and due dates cannot be in the past.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let result: Invoice;
      if (isEdit && editInvoice) {
        result = await invoiceService.updateInvoice(editInvoice.id, form);
      } else {
        const coachId = authService.getCurrentCoachId();
        if (!coachId) throw new Error('Authentication required');
        result = await invoiceService.createInvoice({
          ...form,
          coach_id: coachId,
          status: 'unpaid',
          paid_date: null,
          payment_method: null,
          payment_reference: '',
        }, []);
      }
      onSuccess(result);
    } catch {
      setError('Failed to save invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Invoice' : 'New Invoice'}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>{error}</div>}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Client *</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className="w-full px-3 py-2 text-sm input-dark">
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Invoice Date *</label>
            <DateTimeInput type="date" value={form.invoice_date} onChange={e => set('invoice_date', e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Due Date *</label>
            <DateTimeInput type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Amount (ZAR) *</label>
          <input type="number" min={0} step={50} value={form.amount} onChange={e => set('amount', Number(e.target.value))} className="w-full px-3 py-2 text-sm input-dark" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Description</label>
          <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. August sessions — 2 sessions" className="w-full px-3 py-2 text-sm input-dark" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full px-3 py-2 text-sm input-dark resize-none" />
        </div>
      </div>
    </Modal>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const coachId = authService.getCurrentCoachId();
    if (!coachId) {
      setLoading(false);
      return;
    }
    Promise.all([
      invoiceService.getInvoices(coachId),
      clientService.getClients(coachId),
    ]).then(([inv, c]) => {
      if (cancelled) return;
      setInvoices(inv.sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)));
      setClients(c);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach(c => { m[c.id] = c.display_name; });
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (clientMap[inv.client_id] || '').toLowerCase();
        if (!name.includes(q) && !inv.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, search, clientMap]);

  const totals = useMemo(() => ({
    unpaid: invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + i.amount, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0),
  }), [invoices]);

  const handleMarkPaid = async (inv: Invoice) => {
    setMarkingPaid(inv.id);
    try {
      const updated = await invoiceService.markPaid(inv.id, new Date().toISOString().slice(0, 10), 'eft', '');
      setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleInvoiceSaved = (invoice: Invoice) => {
    setInvoices(prev => {
      const idx = prev.findIndex(i => i.id === invoice.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = invoice;
        return updated;
      }
      return [invoice, ...prev].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
    });
    setModalOpen(false);
    setEditingInvoice(null);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await invoiceService.deleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <AppLayout activePath="/invoices">
      <div className="space-y-4 fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold" style={{ color: 'var(--foreground)' }}>Invoices</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Track payments and outstanding balances</p>
          </div>
          <button onClick={() => { setEditingInvoice(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> New Invoice
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="kpi-card-warning rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--foreground-subtle)' }}>Outstanding</p>
            <p className="text-xl font-semibold tabular-nums mt-1" style={{ color: 'var(--warning)' }}>{formatZAR(totals.unpaid)}</p>
          </div>
          <div className="kpi-card-positive rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--foreground-subtle)' }}>Collected</p>
            <p className="text-xl font-semibold tabular-nums mt-1" style={{ color: 'var(--accent)' }}>{formatZAR(totals.paid)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  statusFilter === f.value ? 'text-primary-foreground' : 'text-foreground-muted hover:text-foreground'
                }`}
                style={statusFilter === f.value ? { background: 'var(--primary)' } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--foreground-subtle)' }} />
            <input
              type="text"
              placeholder="Search invoices…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm input-dark"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="surface-card rounded-xl h-20 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <FileText size={32} className="mx-auto mb-3" style={{ color: 'var(--foreground-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No invoices found</p>
            </div>
          ) : (
            filtered.map(inv => (
              <div key={inv.id} className="surface-card rounded-xl p-4 flex items-start gap-4 row-hover transition-colors duration-150 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{clientMap[inv.client_id] || inv.client_id}</span>
                    <StatusBadge variant={inv.status} />
                    <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>{inv.id}</span>
                  </div>
                  <p className="text-xs mt-1 truncate" style={{ color: 'var(--foreground-muted)' }}>{inv.description}</p>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>Issued: {inv.invoice_date}</span>
                    <span className="text-xs" style={{ color: inv.status === 'unpaid' ? 'var(--warning)' : 'var(--foreground-subtle)' }}>Due: {inv.due_date}</span>
                    {inv.paid_date && <span className="text-xs" style={{ color: 'var(--accent)' }}>Paid: {inv.paid_date}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-base font-semibold tabular-nums" style={{ color: inv.status === 'paid' ? 'var(--accent)' : 'var(--foreground)' }}>
                    {formatZAR(inv.amount)}
                  </span>
                  <div className="flex items-center gap-1">
                    {inv.status === 'unpaid' && (
                      <button
                        onClick={() => handleMarkPaid(inv)}
                        disabled={markingPaid === inv.id}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 disabled:opacity-50"
                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                      >
                        <CheckCircle size={12} />
                        {markingPaid === inv.id ? 'Saving…' : 'Mark Paid'}
                      </button>
                    )}
                    <button
                      onClick={() => exportInvoicePDF(inv, clientMap[inv.client_id] || inv.client_id)}
                      className="p-1.5 rounded-lg btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Export PDF"
                      style={{ color: 'var(--primary)' }}
                    >
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() => { setEditingInvoice(inv); setModalOpen(true); }}
                      className="p-1.5 rounded-lg btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit invoice"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(inv.id)}
                      className="p-1.5 rounded-lg btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete invoice"
                      style={{ color: 'var(--destructive)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invoice modal */}
      <InvoiceModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingInvoice(null); }}
        onSuccess={handleInvoiceSaved}
        clients={clients}
        editInvoice={editingInvoice}
      />

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-glass scale-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Delete invoice?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--foreground-muted)' }}>This will permanently remove this invoice. This cannot be undone.</p>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border border-border">Cancel</button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--destructive)' }}
              >
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
