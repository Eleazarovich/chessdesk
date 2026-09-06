'use client';
import React, { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { expenseService } from '@/lib/services/expenseService';
import { authService } from '@/lib/services/authService';
import type { Expense, ExpenseCategory } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import { Receipt, Plus, Trash2, Edit2 } from 'lucide-react';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  transport: 'Transport',
  food: 'Food',
  equipment: 'Equipment',
  internet: 'Internet',
  venue: 'Venue',
  chess_materials: 'Chess Materials',
  other: 'Other',
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  transport: 'var(--info)',
  food: 'var(--warning)',
  equipment: 'var(--primary)',
  internet: 'var(--accent)',
  venue: '#EC4899',
  chess_materials: '#F97316',
  other: 'var(--foreground-subtle)',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as ExpenseCategory[];

function formatZAR(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ExpenseFormData {
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
}

interface ExpenseModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (expense: Expense) => void;
  editExpense?: Expense | null;
}

function ExpenseModal({ open, onClose, onSuccess, editExpense }: ExpenseModalProps) {
  const isEdit = !!editExpense;
  const [form, setForm] = useState<ExpenseFormData>({
    date: editExpense?.date ?? '',
    amount: editExpense?.amount ?? 0,
    category: editExpense?.category ?? 'transport',
    description: editExpense?.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        date: editExpense?.date ?? '',
        amount: editExpense?.amount ?? 0,
        category: editExpense?.category ?? 'transport',
        description: editExpense?.description ?? '',
      });
      setError('');
    }
  }, [open, editExpense]);

  const set = (k: keyof ExpenseFormData, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.date || form.amount <= 0 || !form.description.trim()) {
      setError('Date, amount and description are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let result: Expense;
      if (isEdit && editExpense) {
        result = await expenseService.updateExpense(editExpense.id, form);
      } else {
        const coachId = authService.getCurrentCoachId();
        if (!coachId) throw new Error('Authentication required');
        result = await expenseService.createExpense({ ...form, coach_id: coachId });
      }
      onSuccess(result);
    } catch {
      setError('Failed to save expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Expense' : 'Add Expense'}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border" style={{ borderColor: 'var(--border)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium btn-primary disabled:opacity-60">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Expense'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--destructive-muted)', border: '1px solid var(--destructive)', color: 'var(--destructive)' }}>{error}</div>}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Date *</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="w-full px-3 py-2 text-sm input-dark" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Amount (ZAR) *</label>
          <input type="number" min={0} step={10} value={form.amount} onChange={e => set('amount', Number(e.target.value))} className="w-full px-3 py-2 text-sm input-dark" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full px-3 py-2 text-sm input-dark">
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: 'var(--foreground-muted)' }}>Description *</label>
          <input type="text" value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Fuel — Rosebank trip" className="w-full px-3 py-2 text-sm input-dark" />
        </div>
      </div>
    </Modal>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const coachId = authService.getCurrentCoachId();
    if (!coachId) {
      setLoading(false);
      return;
    }
    expenseService.getExpenses(coachId).then(data => {
      if (cancelled) return;
      setExpenses(data.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const categoryTotals = useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {};
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }, [expenses]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return expenses;
    return expenses.filter(e => e.category === categoryFilter);
  }, [expenses, categoryFilter]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await expenseService.deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleExpenseSaved = (expense: Expense) => {
    setExpenses(prev => {
      const idx = prev.findIndex(e => e.id === expense.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = expense;
        return updated;
      }
      return [expense, ...prev].sort((a, b) => b.date.localeCompare(a.date));
    });
    setModalOpen(false);
    setEditingExpense(null);
  };

  const categories = Object.keys(categoryTotals) as ExpenseCategory[];

  return (
    <AppLayout activePath="/expenses">
      <div className="space-y-4 fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold" style={{ color: 'var(--foreground)' }}>Expenses</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Track your coaching business expenses</p>
          </div>
          <button onClick={() => { setEditingExpense(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> Add Expense
          </button>
        </div>

        {/* Total + breakdown */}
        <div className="surface-card rounded-xl p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-xl font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{formatZAR(totalExpenses)}</span>
            <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>total expenses</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${categoryFilter === 'all' ? 'text-primary-foreground' : 'text-foreground-muted hover:text-foreground'}`}
              style={categoryFilter === 'all' ? { background: 'var(--primary)' } : { background: 'var(--surface-elevated)' }}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat === categoryFilter ? 'all' : cat)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 flex items-center gap-1.5"
                style={{
                  background: categoryFilter === cat ? CATEGORY_COLORS[cat] + '33' : 'var(--surface-elevated)',
                  color: categoryFilter === cat ? CATEGORY_COLORS[cat] : 'var(--foreground-muted)',
                  border: `1px solid ${categoryFilter === cat ? CATEGORY_COLORS[cat] + '66' : 'transparent'}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[cat] }} />
                {CATEGORY_LABELS[cat]}
                <span className="opacity-70">{formatZAR(categoryTotals[cat] || 0)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="surface-card rounded-xl h-16 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="surface-card rounded-xl p-12 text-center">
              <Receipt size={32} className="mx-auto mb-3" style={{ color: 'var(--foreground-subtle)' }} />
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>No expenses found</p>
            </div>
          ) : (
            filtered.map(expense => (
              <div key={expense.id} className="surface-card rounded-xl p-4 flex items-center gap-4 row-hover transition-colors duration-150 group">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: CATEGORY_COLORS[expense.category] + '22' }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[expense.category] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{expense.description}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-elevated)', color: 'var(--foreground-muted)' }}>
                      {CATEGORY_LABELS[expense.category]}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--foreground-subtle)' }}>{expense.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>{formatZAR(expense.amount)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingExpense(expense); setModalOpen(true); }}
                      className="p-1.5 rounded-lg btn-ghost"
                      title="Edit expense"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(expense.id)}
                      disabled={deletingId === expense.id}
                      className="p-1.5 rounded-lg btn-ghost disabled:opacity-30"
                      title="Delete expense"
                      style={{ color: 'var(--destructive)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Expense modal */}
      <ExpenseModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingExpense(null); }}
        onSuccess={handleExpenseSaved}
        editExpense={editingExpense}
      />

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-2xl p-6 w-full max-w-sm shadow-glass scale-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Delete expense?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--foreground-muted)' }}>This will permanently remove this expense. This cannot be undone.</p>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-lg text-sm font-medium btn-ghost border border-border">Cancel</button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--destructive)' }}
              >
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
