import type { Invoice, PaymentMethod } from '../types';
import { MOCK_INVOICES, MOCK_INVOICE_SESSIONS } from './mockData';

// BACKEND INTEGRATION POINT: Replace with real API calls to your backend

let invoices = [...MOCK_INVOICES];
const invoiceSessions = [...MOCK_INVOICE_SESSIONS];

export const invoiceService = {
  async getInvoices(coachId: string): Promise<Invoice[]> {
    await new Promise(r => setTimeout(r, 300));
    return invoices.filter(inv => inv.coach_id === coachId);
  },

  async createInvoice(data: Omit<Invoice, 'id'>, sessionIds: string[]): Promise<Invoice> {
    await new Promise(r => setTimeout(r, 400));
    const invoice: Invoice = { ...data, id: `inv-${Date.now()}` };
    invoices.push(invoice);
    sessionIds.forEach(sid => invoiceSessions.push({ invoice_id: invoice.id, session_id: sid }));
    return invoice;
  },

  async markPaid(id: string, paidDate: string, method: PaymentMethod, reference: string): Promise<Invoice> {
    await new Promise(r => setTimeout(r, 300));
    const idx = invoices.findIndex(inv => inv.id === id);
    if (idx === -1) throw new Error('Invoice not found');
    invoices[idx] = { ...invoices[idx], status: 'paid', paid_date: paidDate, payment_method: method, payment_reference: reference };
    return invoices[idx];
  },

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
    await new Promise(r => setTimeout(r, 300));
    const idx = invoices.findIndex(inv => inv.id === id);
    if (idx === -1) throw new Error('Invoice not found');
    invoices[idx] = { ...invoices[idx], ...data };
    return invoices[idx];
  },

  async deleteInvoice(id: string): Promise<void> {
    await new Promise(r => setTimeout(r, 200));
    invoices = invoices.filter(inv => inv.id !== id);
  },

  async getSessionsForInvoice(invoiceId: string): Promise<string[]> {
    return invoiceSessions.filter(is => is.invoice_id === invoiceId).map(is => is.session_id);
  },
};