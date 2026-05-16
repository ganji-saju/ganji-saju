// 2026-05-16 PR #184 — Phase 2A: Playwright smoke E2E.
//
// 사용자 메타 피드백 후속 자동화. dead anchor 와 score invariant 만 잡지 못하는
// UI 회귀 (페이지 진입 자체 깨짐 / 핵심 요소 미노출 / console error 등) 를
// 매 PR 자동 검출.
//
// Phase 2A 는 인증 필요 없는 페이지만 검증 (홈, /pricing, /membership 등).
// 사주 페이지는 Supabase 인증 + reading slug 필요 → 별도 fixture 작업 (Phase 2B).
//
// 로컬: npm run e2e
// CI: Vercel preview URL 또는 next dev webServer
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // PLAYWRIGHT_BASE_URL 환경변수가 없으면 로컬 next dev 자동 실행.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
