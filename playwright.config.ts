import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8000';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: './test-results',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
