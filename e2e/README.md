# Playwright end-to-end test

The E2E workflow uses the demo coach account to sign in, create a client,
schedule a session, create an invoice, and record an expense through the app.
It checks each record in its list and confirms the dashboard activity and
financial totals update. It also changes the profile, verifies the saved values
after a reload and on the dashboard, restores the demo profile, removes the
test records, and signs out as its final browser action.

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
