import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the local stack: the API from
// infra/docker-compose.dev.yml (migrated and seeded) plus this app.
// Run locally only: npm run test:e2e
//
// E2E_BASE_URL points them at a running site instead, such as the local demo
// rehearsal (https://demo.localhost, whose certificate is Caddy's own).
const externalSite = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Bookings share one API session store and seats; keep them in sequence
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: externalSite ?? 'http://localhost:3000',
    ignoreHTTPSErrors: Boolean(externalSite),
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalSite
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000/uk',
        reuseExistingServer: true,
        timeout: 120_000
      }
});
