import { expect, test } from '@playwright/test';

const demoEmail = 'thabo@chessops.co.za';
const demoPassword = 'chess2026!';
const appURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8000';

function apiURL(path: string): string {
  return new URL(`/api/v1/${path}`, appURL).toString();
}

function dateInputValue(daysFromToday: number): string {
  const value = new Date();
  value.setDate(value.getDate() + daysFromToday);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test('coach can log in and create an invoice', async ({ page }) => {
  let accessToken: string | null = null;
  let invoiceId: string | null = null;

  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.locator('input[type="email"]').fill(demoEmail);
    await page.locator('input[type="password"]').fill(demoPassword);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    accessToken = await page.evaluate(() => sessionStorage.getItem('chessdesk_access_token'));
    expect(accessToken).toBeTruthy();

    await page.getByRole('link', { name: /Invoices/ }).click();
    await expect(page).toHaveURL(/\/invoices\/?$/);
    await expect(page.getByRole('heading', { name: 'Invoices', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New Invoice' }).click();
    await expect(page.getByRole('heading', { name: 'New Invoice' })).toBeVisible();

    const clientSelect = page.locator('select').first();
    await expect(clientSelect.locator('option', { hasText: 'Amahle Dlamini' })).toHaveCount(1);
    await clientSelect.selectOption({ label: 'Amahle Dlamini' });

    const invoiceDate = dateInputValue(1);
    const dueDate = dateInputValue(8);
    await page.locator('input[type="date"]').nth(0).fill(invoiceDate);
    await page.locator('input[type="date"]').nth(1).fill(dueDate);
    await page.locator('input[type="number"]').fill('1250');

    const description = `Playwright E2E invoice ${Date.now()}`;
    await page.getByPlaceholder('e.g. August sessions — 2 sessions').fill(description);
    await page.locator('textarea').fill('Created by the Compose end-to-end test.');

    const createResponsePromise = page.waitForResponse(response =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/api/v1/invoices'),
    );
    await page.getByRole('button', { name: 'Create Invoice', exact: true }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const invoice = await createResponse.json() as { id: string; amount: number; status: string };
    invoiceId = invoice.id;
    expect(invoice.amount).toBe(1250);
    expect(invoice.status).toBe('unpaid');

    const invoiceRow = page.locator('div.surface-card').filter({ hasText: description });
    await expect(invoiceRow).toHaveCount(1);
    await expect(invoiceRow).toContainText('Amahle Dlamini');
    await expect(invoiceRow).toContainText('Unpaid');
    await expect(invoiceRow).toContainText(invoiceDate);
    await expect(invoiceRow).toContainText(dueDate);
  } finally {
    try {
      if (accessToken && invoiceId) {
        const deleteResponse = await page.request.delete(
          apiURL(`invoices/${invoiceId}`),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        expect(deleteResponse.status()).toBe(204);
      }
    } finally {
      if (accessToken) {
        const logoutResponse = await page.request.post(
          apiURL('auth/logout'),
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        expect(logoutResponse.status()).toBe(204);
      }
    }
  }
});
