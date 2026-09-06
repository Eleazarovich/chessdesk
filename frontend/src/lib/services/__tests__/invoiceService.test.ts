import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api';
import { invoiceService } from '../invoiceService';

const invoice = {
  id: 'inv-001',
  coach_id: 'coach-001',
  client_id: 'client-001',
  invoice_date: '2026-09-06',
  due_date: '2026-09-13',
  amount: 500,
  description: 'September session',
  status: 'unpaid' as const,
  paid_date: null,
  payment_method: null,
  payment_reference: '',
  notes: '',
};

describe('invoiceService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('loads invoices for a coach', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([invoice]);

    await expect(invoiceService.getInvoices('coach-001')).resolves.toEqual([invoice]);
    expect(get).toHaveBeenCalledWith('/invoices', { coach_id: 'coach-001' });
  });

  it('includes related sessions when creating an invoice', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(invoice);

    await invoiceService.createInvoice(invoice, ['session-001', 'session-002']);

    expect(post).toHaveBeenCalledWith('/invoices', {
      ...invoice,
      session_ids: ['session-001', 'session-002'],
    });
  });

  it('marks an invoice paid through the backend', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({ ...invoice, status: 'paid' });

    await invoiceService.markPaid('inv-001', '2026-09-07', 'eft', 'EFT-001');

    expect(patch).toHaveBeenCalledWith('/invoices/inv-001', {
      status: 'paid',
      paid_date: '2026-09-07',
      payment_method: 'eft',
      payment_reference: 'EFT-001',
    });
  });
});
