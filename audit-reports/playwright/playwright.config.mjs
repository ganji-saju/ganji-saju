// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 60000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: 'html-report', open: 'never' }]],
  use: {
    baseURL: 'https://www.xn--s39at50bo6fmwa.kr',
    actionTimeout: 8000,
    navigationTimeout: 30000,
    screenshot: 'off',
    trace: 'retain-on-failure',
  },
});
