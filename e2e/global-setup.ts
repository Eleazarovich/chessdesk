import { request, type FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = String(config.use.baseURL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
  const api = await request.newContext({ timeout: 2_000 });
  const deadline = Date.now() + 90_000;
  let lastError = 'no response from the application';

  try {
    while (Date.now() < deadline) {
      try {
        const response = await api.get(`${baseURL}/api/v1/openapi.json`);
        if (response.ok()) return;
        lastError = `HTTP ${response.status()}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } finally {
    await api.dispose();
  }

  throw new Error(
    `ChessDesk at ${baseURL} did not become ready (${lastError}). ` +
    'Start the Compose stack with `docker compose up --build -d` or run `make e2e`.',
  );
}
