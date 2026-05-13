// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'persona-matrix.spec.mjs',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    actionTimeout: 10000,
    navigationTimeout: 20000,
    screenshot: 'off',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
});
