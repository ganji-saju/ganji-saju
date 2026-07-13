// 2026-05-16 PR #184 — Phase 2A: Playwright smoke E2E.
// 2026-05-16 Phase 2B — 인증 fixture 추가 (auth project + storage state 재사용).
// 2026-05-16 Phase 2C — payment-blocks 시나리오 (활성 entitlement seed/cleanup).
//
// 사용자 메타 피드백 후속 자동화. dead anchor 와 score invariant 만 잡지 못하는
// UI 회귀 (페이지 진입 자체 깨짐 / 핵심 요소 미노출 / console error 등) 를
// 매 PR 자동 검출.
//
// Phase 2A 는 인증 필요 없는 페이지만 검증 (홈, /pricing, /membership 등).
// Phase 2B 는 사주 페이지 등 인증 필요 페이지 검증. 처음 한 번 로그인해서
// storage state 를 e2e/.auth/test-user.json 에 저장한 뒤 saju.spec.ts 들이
// 동일 state 를 재사용 (Playwright 권장 패턴, https://playwright.dev/docs/auth).
//
// 로컬: npm run e2e
// CI: Vercel preview URL 또는 next dev webServer
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

// 인증 fixture 가 활성화될 때만 saju spec 실행. credentials 미주입 환경 (CI 등) 은
// auth project 가 skip 처리 → saju spec 도 자동 skip. 회귀 없음.
const AUTH_STORAGE_PATH = 'e2e/.auth/test-user.json';
// E2E_TEST_USER_EMAIL 가 있을 때만 storageState 사용. 미설정 시 saju spec 자체
// 가 beforeEach 에서 skip 하므로 storageState 가 로드되지 않아도 안전.
const HAS_TEST_USER = Boolean(process.env.E2E_TEST_USER_EMAIL && process.env.E2E_TEST_USER_PASSWORD);

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
    // 인증 필요 없는 smoke (Phase 2A). 항상 실행.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/saju.spec.ts', '**/auth.setup.ts', '**/payment-blocks.spec.ts'],
    },
    // 인증 setup — credentials 있으면 로그인 + storage state 저장. saju spec 의존성.
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Phase 2B 사주 페이지 등 인증 필요 spec.
    {
      name: 'chromium-auth',
      use: {
        ...devices['Desktop Chrome'],
        // credentials 있을 때만 storageState 사용. 미설정 시 saju spec 의
        // beforeEach 에서 자동 skip 되므로 storageState 가 없어도 무해.
        ...(HAS_TEST_USER ? { storageState: AUTH_STORAGE_PATH } : {}),
      },
      dependencies: ['auth-setup'],
      testMatch: /saju\.spec\.ts/,
    },
    // 사용방법 첫 진입 자동 실행 검증. 기존 auth setup/storage state를 재사용하고,
    // credentials 미설정 환경에서는 spec이 사유를 명시해 skip한다.
    {
      name: 'chromium-auth-guide',
      use: {
        ...devices['Desktop Chrome'],
        ...(HAS_TEST_USER ? { storageState: AUTH_STORAGE_PATH } : {}),
      },
      dependencies: ['auth-setup'],
      testMatch: /system-guide-onboarding\.spec\.ts/,
    },
    // Phase 2C 활성 entitlement 사용자 결제 차단 spec.
    // service_role + test user 양쪽 필요. 미설정 시 beforeEach 가 skip 처리.
    {
      name: 'chromium-payment-blocks',
      use: {
        ...devices['Desktop Chrome'],
        ...(HAS_TEST_USER ? { storageState: AUTH_STORAGE_PATH } : {}),
      },
      dependencies: ['auth-setup'],
      testMatch: /payment-blocks\.spec\.ts/,
    },
  ],
  // PLAYWRIGHT_BASE_URL 환경변수가 없으면 로컬 서버 자동 실행.
  //   CI: 'npm run start'(프로덕션 빌드, next start)로 검증 — 개발 모드 전용
  //     React/Next 경고(예: App Router template 의 keyless-array dev 경고)가
  //     "console error 0" smoke 단언을 flaky 하게 깨는 문제 제거 + 실제 사용자가
  //     받는 프로덕션 빌드를 테스트. (.next 출력 필요 → CI 워크플로가 'npm run build'
  //     스텝을 선행한다.)
  //   로컬: 'npm run dev' 로 빠른 반복 유지(빌드 불필요).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
