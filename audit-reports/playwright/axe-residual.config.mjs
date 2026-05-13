// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'axe-residual.spec.mjs',
  timeout: 45000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: { actionTimeout: 10000, navigationTimeout: 30000 },
});
