import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const baseURL = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const demoEmail = 'thabo@chessops.co.za';
const demoPassword = 'chess2026!';

type CreatedRecords = {
  clientId?: string;
  sessionId?: string;
  invoiceId?: string;
  expenseId?: string;
};

type DashboardSnapshot = {
  activeStudents: number;
  upcomingSessions: number;
  unpaidInvoices: number;
  revenue: number;
  outstanding: number;
  expenses: number;
  netIncome: number;
};

async function waitForApiResponse(page: Page, method: string, path: string) {
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === method && url.pathname.endsWith(path);
  });
}

function localDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function readCount(page: Page, selector: string): Promise<number> {
  const text = await page.locator(selector).locator('span').last().innerText();
  return Number(text.replace(/[^\d-]/g, ''));
}

async function readKpi(page: Page, label: string): Promise<number> {
  const card = page.locator('[class*="kpi-card"]').filter({ hasText: label });
  const text = await card.locator('p').nth(1).innerText();
  return Number(text.replace(/[^\d-]/g, ''));
}

async function readDashboard(page: Page): Promise<DashboardSnapshot> {
  await expect(page.locator('#stat-students')).toBeVisible();
  await expect(page.locator('[class*="kpi-card"]').filter({ hasText: 'Revenue Earned' })).toBeVisible();
  return {
    activeStudents: await readCount(page, '#stat-students'),
    upcomingSessions: await readCount(page, '#stat-upcoming'),
    unpaidInvoices: await readCount(page, '#stat-unpaid'),
    revenue: await readKpi(page, 'Revenue Earned'),
    outstanding: await readKpi(page, 'Outstanding'),
    expenses: await readKpi(page, 'Expenses'),
    netIncome: await readKpi(page, 'Net Income'),
  };
}

async function openAllTimeDashboard(page: Page): Promise<DashboardSnapshot> {
  await page.goto('/dashboard/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Updated/ })).toBeVisible();
  const dashboardResponse = waitForApiResponse(page, 'GET', '/api/v1/dashboard');
  await page.getByRole('button', { name: 'All Time', exact: true }).click();
  const response = await dashboardResponse;
  expect(response.ok()).toBeTruthy();
  expect(new URL(response.url()).searchParams.get('filter')).toBe('all_time');
  await expect(page.getByRole('button', { name: /^Updated/ })).toBeVisible();
  return readDashboard(page);
}

async function removeRecord(
  request: APIRequestContext,
  endpoint: string,
  recordId: string | undefined,
  headers: Record<string, string>,
  strict: boolean,
): Promise<void> {
  if (!recordId) return;
  try {
    const response = await request.delete(`${baseURL}/api/v1/${endpoint}/${recordId}`, { headers });
    if (strict) expect([204, 404]).toContain(response.status());
    if ([204, 404].includes(response.status())) return;
  } catch (error) {
    if (strict) throw error;
  }
}

test('coach completes the business workflow, verifies dashboard and profile updates, then signs out', async ({ page }) => {
  const records: CreatedRecords = {};
  let accessToken: string | undefined;
  let coachId: string | undefined;
  let originalProfile: { businessName: string; phone: string } | undefined;
  let profileNeedsRestore = false;
  let signedOut = false;
  const suffix = Date.now().toString();
  const studentName = `E2E Student ${suffix}`;
  const email = `e2e-${suffix}@example.com`;
  const sessionNote = `E2E scheduled session ${suffix}`;
  const invoiceDescription = `E2E invoice ${suffix}`;
  const expenseDescription = `E2E expense ${suffix}`;
  const sessionDate = localDate(1);
  const invoiceDate = localDate(1);
  const dueDate = localDate(8);

  try {
    await page.goto('/sign-up-login-screen/');
    await page.locator('input[type="email"]').fill(demoEmail);
    await page.locator('input[type="password"]').fill(demoPassword);
    const loginResponse = waitForApiResponse(page, 'POST', '/api/v1/auth/login');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    expect((await loginResponse).ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/dashboard\/?$/);

    const authState = await page.evaluate(() => ({
      token: sessionStorage.getItem('chessdesk_access_token'),
      user: localStorage.getItem('chessops_auth'),
    }));
    accessToken = authState.token ?? undefined;
    coachId = authState.user ? (JSON.parse(authState.user) as { id: string }).id : undefined;
    expect(accessToken).toBeTruthy();
    expect(coachId).toBeTruthy();

    const baseline = await openAllTimeDashboard(page);

    // Create a client through the Clients screen.
    await page.goto('/client-management/');
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Client', exact: true }).click();
    await page.getByRole('button', { name: /Individual Student/ }).click();
    await page.getByPlaceholder('Amahle Dlamini').fill(studentName);
    await page.getByPlaceholder('Rosebank College Prep').fill('ChessDesk E2E School');
    await page.getByPlaceholder('Zanele Dlamini').fill(`Parent ${suffix}`);
    await page.locator('input[type="tel"]').fill('+27 82 555 0101');
    await page.locator('input[type="email"]').fill(email);
    const clientResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/clients');
    await page.getByRole('button', { name: 'Add Student', exact: true }).click();
    const clientResponse = await clientResponsePromise;
    expect(clientResponse.status()).toBe(201);
    records.clientId = (await clientResponse.json() as { id: string }).id;
    await expect(page.getByText('Student added successfully!')).toBeVisible();
    await expect(page.getByText(studentName, { exact: true })).toBeVisible();

    // Schedule a future session for the client, then confirm it appears on both session screens.
    await page.goto('/schedule/');
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
    await page.getByRole('button', { name: 'New Session', exact: true }).click();
    await expect(page.locator('select').first().getByRole('option', { name: studentName })).toHaveCount(1);
    await page.locator('select').first().selectOption({ label: studentName });
    await page.locator('input[type="date"]').fill(sessionDate);
    await page.locator('input[type="time"]').fill('00:00');
    await page.locator('select').nth(1).selectOption('online');
    await page.locator('textarea').last().fill(sessionNote);
    const sessionResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/sessions');
    await page.getByRole('button', { name: 'Create Session', exact: true }).click();
    const sessionResponse = await sessionResponsePromise;
    expect(sessionResponse.status()).toBe(201);
    records.sessionId = (await sessionResponse.json() as { id: string }).id;

    // Tomorrow crosses the schedule week boundary only when today is Saturday.
    if (new Date().getDay() === 6) {
      await page.locator('.surface-card').first().getByRole('button').last().click();
    }
    const scheduledCard = page.locator('.surface-card').filter({ hasText: sessionNote });
    await expect(scheduledCard).toBeVisible();
    await expect(scheduledCard).toContainText(studentName);
    await expect(scheduledCard).toContainText('Scheduled');

    await page.goto('/sessions/');
    await expect(page.getByRole('heading', { name: 'Sessions' })).toBeVisible();
    const sessionRow = page.locator('.surface-card').filter({ hasText: sessionNote });
    await expect(sessionRow).toBeVisible();
    await expect(sessionRow).toContainText(studentName);
    await expect(sessionRow).toContainText('Scheduled');

    // Create an unpaid invoice for the same client.
    await page.goto('/invoices/');
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
    await page.getByRole('button', { name: 'New Invoice', exact: true }).click();
    await expect(page.locator('select').first().getByRole('option', { name: studentName })).toHaveCount(1);
    await page.locator('select').first().selectOption({ label: studentName });
    await page.locator('input[type="date"]').nth(0).fill(invoiceDate);
    await page.locator('input[type="date"]').nth(1).fill(dueDate);
    await page.locator('input[type="number"]').first().fill('1250');
    await page.getByPlaceholder('e.g. August sessions — 2 sessions').fill(invoiceDescription);
    const invoiceResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/invoices');
    await page.getByRole('button', { name: 'Create Invoice', exact: true }).click();
    const invoiceResponse = await invoiceResponsePromise;
    expect(invoiceResponse.status()).toBe(201);
    records.invoiceId = (await invoiceResponse.json() as { id: string }).id;
    const invoiceCard = page.locator('.surface-card').filter({ hasText: invoiceDescription });
    await expect(invoiceCard).toBeVisible();
    await expect(invoiceCard).toContainText(studentName);
    await expect(invoiceCard).toContainText('Unpaid');
    await expect(invoiceCard).toContainText(/1[\s,]?250[.,]00/);

    // Record a business expense.
    await page.goto('/expenses/');
    await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
    await page.locator('input[type="date"]').fill(invoiceDate);
    await page.locator('input[type="number"]').fill('300');
    await page.locator('select').selectOption('food');
    await page.getByPlaceholder('e.g. Fuel — Rosebank trip').fill(expenseDescription);
    const expenseResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/expenses');
    await page.getByRole('button', { name: 'Add Expense', exact: true }).last().click();
    const expenseResponse = await expenseResponsePromise;
    expect(expenseResponse.status()).toBe(201);
    records.expenseId = (await expenseResponse.json() as { id: string }).id;
    const expenseCard = page.locator('.surface-card').filter({ hasText: expenseDescription });
    await expect(expenseCard).toBeVisible();
    await expect(expenseCard).toContainText('Food');
    await expect(expenseCard).toContainText(/300[.,]00/);

    // Check the new client, session, invoice, and expense in dashboard activity and totals.
    const afterWorkflow = await openAllTimeDashboard(page);
    expect(afterWorkflow.activeStudents).toBe(baseline.activeStudents + 1);
    expect(afterWorkflow.upcomingSessions).toBe(baseline.upcomingSessions + 1);
    expect(afterWorkflow.unpaidInvoices).toBe(baseline.unpaidInvoices + 1);
    expect(afterWorkflow.revenue).toBe(baseline.revenue + 1250);
    expect(afterWorkflow.outstanding).toBe(baseline.outstanding + 1250);
    expect(afterWorkflow.expenses).toBe(baseline.expenses + 300);
    expect(afterWorkflow.netIncome).toBe(baseline.netIncome - 300);
    const dashboardSession = page.locator('.row-hover').filter({ hasText: studentName });
    await expect(dashboardSession).toBeVisible();
    await expect(dashboardSession).toContainText('00:00');

    // Change the profile, verify it survives a reload, and confirm the dashboard uses it.
    await page.goto('/settings/');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    const businessNameInput = page.getByText('Business Name', { exact: true }).locator('..').locator('input');
    const phoneInput = page.getByText('Phone / WhatsApp', { exact: true }).locator('..').locator('input');
    originalProfile = {
      businessName: await businessNameInput.inputValue(),
      phone: await phoneInput.inputValue(),
    };
    const updatedBusinessName = `${originalProfile.businessName || 'ChessDesk'} E2E ${suffix.slice(-6)}`;
    const updatedPhone = '+27 82 555 0199';
    await businessNameInput.fill(updatedBusinessName);
    await phoneInput.fill(updatedPhone);
    profileNeedsRestore = true;
    const profileUpdatePromise = waitForApiResponse(page, 'PATCH', `/api/v1/coaches/${coachId}/profile`);
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    expect((await profileUpdatePromise).ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: 'Saved!', exact: true })).toBeVisible();
    await page.reload();
    await expect(businessNameInput).toHaveValue(updatedBusinessName);
    await expect(phoneInput).toHaveValue(updatedPhone);

    await page.goto('/dashboard/');
    await expect(page.getByText(`${updatedBusinessName} — financial & activity overview`, { exact: true })).toBeVisible();

    // Restore the shared demo profile and remove test records before the final sign-out.
    await page.goto('/settings/');
    const restoreBusinessName = page.getByText('Business Name', { exact: true }).locator('..').locator('input');
    const restorePhone = page.getByText('Phone / WhatsApp', { exact: true }).locator('..').locator('input');
    await restoreBusinessName.fill(originalProfile.businessName);
    await restorePhone.fill(originalProfile.phone);
    const restoreResponsePromise = waitForApiResponse(page, 'PATCH', `/api/v1/coaches/${coachId}/profile`);
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    expect((await restoreResponsePromise).ok()).toBeTruthy();
    await expect(restoreBusinessName).toHaveValue(originalProfile.businessName);
    await expect(restorePhone).toHaveValue(originalProfile.phone);
    profileNeedsRestore = false;

    const headers = { Authorization: `Bearer ${accessToken}` };
    await removeRecord(page.request, 'invoices', records.invoiceId, headers, true);
    records.invoiceId = undefined;
    await removeRecord(page.request, 'expenses', records.expenseId, headers, true);
    records.expenseId = undefined;
    await removeRecord(page.request, 'sessions', records.sessionId, headers, true);
    records.sessionId = undefined;
    await removeRecord(page.request, 'clients', records.clientId, headers, true);
    records.clientId = undefined;

    // Signing out is the final browser action in the workflow.
    const logoutResponsePromise = waitForApiResponse(page, 'POST', '/api/v1/auth/logout');
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    const logoutResponse = await logoutResponsePromise;
    expect(logoutResponse.status()).toBe(204);
    await expect(page).toHaveURL(/\/sign-up-login-screen\/?$/);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('chessdesk_access_token'))).toBeNull();
    signedOut = true;
    accessToken = undefined;
  } finally {
    if (accessToken) {
      const headers = { Authorization: `Bearer ${accessToken}` };
      // Best-effort cleanup keeps later Compose runs independent if an assertion fails.
      await removeRecord(page.request, 'invoices', records.invoiceId, headers, false);
      await removeRecord(page.request, 'expenses', records.expenseId, headers, false);
      await removeRecord(page.request, 'sessions', records.sessionId, headers, false);
      await removeRecord(page.request, 'clients', records.clientId, headers, false);

      if (profileNeedsRestore && coachId && originalProfile) {
        try {
          await page.request.patch(`${baseURL}/api/v1/coaches/${coachId}/profile`, {
            headers,
            data: { business_name: originalProfile.businessName, phone: originalProfile.phone },
          });
        } catch {
          // Preserve the original test failure if the application is unavailable during cleanup.
        }
      }

      if (!signedOut) {
        try {
          await page.request.post(`${baseURL}/api/v1/auth/logout`, { headers });
        } catch {
          // Preserve the original test failure if the application is unavailable during cleanup.
        }
      }
    }
  }
});
