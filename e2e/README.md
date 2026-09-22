# Playwright end-to-end test

The E2E test uses the demo coach account, signs in through the browser, and
creates an invoice from the Invoices page. It removes the created invoice and
logs out during cleanup.

Install the Playwright dependency and Chromium once from the repository root:

```bash
npm ci
npx playwright install chromium
```

Run the test with:

```bash
make e2e
```

The target builds and starts `docker-compose.yaml` before running Playwright.
The Compose services and PostgreSQL volume remain running afterward. To target
an already-running Compose app on another address, set `E2E_BASE_URL`.
