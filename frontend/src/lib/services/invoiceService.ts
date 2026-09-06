import type { Invoice, PaymentMethod } from '../types';
import { apiClient } from '../api';

export const invoiceService = {
  async getInvoices(coachId: string): Promise<Invoice[]> {
    return apiClient.get<Invoice[]>('/invoices', { coach_id: coachId });
  },

  async createInvoice(data: Omit<Invoice, 'id'>, sessionIds: string[]): Promise<Invoice> {
    return apiClient.post<Invoice>('/invoices', {
      ...data,
      session_ids: sessionIds,
    });
  },

  async markPaid(id: string, paidDate: string, method: PaymentMethod, reference: string): Promise<Invoice> {
    return apiClient.patch<Invoice>(`/invoices/${id}`, {
      status: 'paid',
      paid_date: paidDate,
      payment_method: method,
      payment_reference: reference,
    });
  },

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const { id: _id, coach_id: _coachId, ...updates } = data;
    return apiClient.patch<Invoice>(`/invoices/${id}`, updates);
  },

  async deleteInvoice(id: string): Promise<void> {
    await apiClient.delete(`/invoices/${id}`);
  },

  async getSessionsForInvoice(invoiceId: string): Promise<string[]> {
    return apiClient.get<string[]>(`/invoices/${invoiceId}/sessions`);
  },
};
