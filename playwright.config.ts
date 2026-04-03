import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx --yes serve -l 4321 app/dist/dev-lens/browser',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
