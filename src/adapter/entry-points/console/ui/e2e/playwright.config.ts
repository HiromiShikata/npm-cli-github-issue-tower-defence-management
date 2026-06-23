import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: path.join(__dirname, 'report') }],
  ],
  outputDir: path.join(__dirname, 'test-results'),
  timeout: 60_000,
  expect: { timeout: 3_000 },
  use: {
    actionTimeout: 3_000,
    navigationTimeout: 3_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
