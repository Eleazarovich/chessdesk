import { describe, it, expect } from 'vitest';
import { invoiceService } from '../invoiceService';

describe('invoiceService', () => {
  describe('getInvoices', () => {
    it('returns invoices for the given coach', async () => {
      const invoices = await invoiceService?.getInvoices('coach-001');
      expect(invoices?.length)?.toBeGreaterThan(0);
    });

    it('contains both paid and unpaid invoices', async () => {
      const invoices = await invoiceService?.getInvoices('coach-001');
      const unpaid = invoices?.filter(i => i?.status === 'unpaid');
      const paid = invoices?.filter(i => i?.status === 'paid');
      expect(unpaid?.length)?.toBeGreaterThan(0);
      expect(paid?.length)?.toBeGreaterThan(0);
    });
  });

  describe('createInvoice', () => {
    it('creates an invoice with unpaid status', async () => {
      const invoice = await invoiceService?.createInvoice(
        {
          coach_id: 'coach-001',
          client_id: 'client-001',
          invoice_date: '2026-09-06',
          due_date: '2026-09-13',
          amount: 500,
          description: 'Test invoice',
          status: 'unpaid',
          paid_date: null,
          payment_method: null,
          payment_reference: '',
          notes: '',
        },
        ['session-005']
      );
      expect(invoice?.id)?.toBeTruthy();
      expect(invoice?.status)?.toBe('unpaid');
      expect(invoice?.amount)?.toBe(500);
    });

    it('associates sessions with the invoice', async () => {
      const invoice = await invoiceService?.createInvoice(
        {
          coach_id: 'coach-001',
          client_id: 'client-002',
          invoice_date: '2026-09-06',
          due_date: '2026-09-13',
          amount: 900,
          description: 'Multi-session invoice',
          status: 'unpaid',
          paid_date: null,
          payment_method: null,
          payment_reference: '',
          notes: '',
        },
        ['session-006', 'session-011']
      );
      const sessions = await invoiceService?.getSessionsForInvoice(invoice?.id);
      expect(sessions)?.toContain('session-006');
      expect(sessions)?.toContain('session-011');
    });
  });

  describe('markPaid', () => {
    it('transitions invoice status to paid', async () => {
      const invoice = await invoiceService?.createInvoice(
        {
          coach_id: 'coach-001',
          client_id: 'client-003',
          invoice_date: '2026-09-06',
          due_date: '2026-09-13',
          amount: 350,
          description: 'September session',
          status: 'unpaid',
          paid_date: null,
          payment_method: null,
          payment_reference: '',
          notes: '',
        },
        []
      );
      const paid = await invoiceService?.markPaid(invoice?.id, '2026-09-07', 'cash', '');
      expect(paid?.status)?.toBe('paid');
      expect(paid?.paid_date)?.toBe('2026-09-07');
      expect(paid?.payment_method)?.toBe('cash');
    });

    it('records payment reference when provided', async () => {
      const invoice = await invoiceService?.createInvoice(
        {
          coach_id: 'coach-001',
          client_id: 'client-005',
          invoice_date: '2026-09-06',
          due_date: '2026-09-20',
          amount: 2800,
          description: 'School sessions',
          status: 'unpaid',
          paid_date: null,
          payment_method: null,
          payment_reference: '',
          notes: '',
        },
        []
      );
      const paid = await invoiceService?.markPaid(invoice?.id, '2026-09-10', 'eft', 'EFT-REF-001');
      expect(paid?.payment_reference)?.toBe('EFT-REF-001');
    });
  });
});