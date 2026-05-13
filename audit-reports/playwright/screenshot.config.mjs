// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'screenshot.spec.mjs',
  timeout: 60000,
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: { actionTimeout: 8000, navigationTimeout: 30000, screenshot: 'off', trace: 'off' },
});
