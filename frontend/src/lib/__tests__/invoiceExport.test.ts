import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportInvoicePDF } from '../invoiceExport';
import type { Invoice } from '../types';

describe('invoice export security', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('prints user content as text and isolates the print window', () => {
    vi.useFakeTimers();
    const document = window.document.implementation.createHTMLDocument();
    const popup = { document, opener: window, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const attack = '<script>window.audit=true</script><img src=x onerror="alert(1)">';
    const invoice: Invoice = {
      id: '</title>' + attack, coach_id: 'coach-1', client_id: 'client-1',
      invoice_date: '2026-09-24', due_date: '2026-09-25', amount: 100,
      description: attack, notes: attack, status: 'paid', paid_date: '2026-09-24',
      payment_method: 'eft', payment_reference: '',
    };
    exportInvoicePDF(invoice, attack);
    expect(document.querySelector('script, img, [onerror]')).toBeNull();
    expect(document.body.textContent).toContain(attack);
    expect(document.title).toContain(invoice.id);
    expect(document.querySelector('meta[http-equiv="Content-Security-Policy"]')).not.toBeNull();
    expect(popup.opener).toBeNull();
    vi.runAllTimers();
    expect(popup.print).toHaveBeenCalledOnce();
  });
});
