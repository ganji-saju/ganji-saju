// 2026-05-16 Phase 2B — 인증 setup project.
//
// 처음 1회 실행되어 /login?mode=login 에서 이메일 비번 로그인을 수행한 뒤
// 인증된 storage state (cookie + localStorage) 를 e2e/.auth/test-user.json 에 저장.
// 이후 chromium-auth project 의 모든 spec 이 같은 state 를 재사용 (login 1회만).
//
// credentials 미설정 환경 (CI 등) 에서는 test.skip — 후속 saju spec 도 dependency
// 실패가 아닌 skip 으로 흘러간다 (Playwright dependency + skip 의도 동작).

import { test as setup, expect } from '@playwright/test';
import { SYSTEM_GUIDE_STORAGE_KEY } from '../src/features/system-guide/system-guide-state';
import { getTestUser } from './fixtures/test-user';

const AUTH_STORAGE_PATH = 'e2e/.auth/test-user.json';

setup('authenticate as test user', async ({ page }) => {
  const credentials = getTestUser();

  // 미설정 환경: skip. dependency 가 skip 되면 후속 project 도 자동 skip.
  setup.skip(
    !credentials,
    'E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 미설정 — Phase 2B 인증 spec skip'
  );

  if (!credentials) return; // type narrowing

  // /login?mode=login 으로 이메일 로그인 화면 직링크.
  await page.goto('/login?mode=login');

  // 입력 + 제출.
  await page.locator('#login-email').fill(credentials.email);
  await page.locator('#login-password').fill(credentials.password);
  await page.getByRole('button', { name: /로그인하고 내 정보 불러오기|로그인 중/ }).click();

  // 성공 시 /saju/new?autoProfile=1 (또는 next param 경로) 로 리디렉트.
  // /login 페이지가 아니게 될 때까지 대기.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

  // 인증 cookie 가 실제로 설정됐는지 확인 (Supabase sb-* token).
  const cookies = await page.context().cookies();
  const hasSupabaseToken = cookies.some((c) => /^sb-.*-auth-token/.test(c.name));
  expect(hasSupabaseToken, '로그인 후 Supabase auth cookie 가 설정돼야 한다').toBe(true);

  // 일반 인증/결제 E2E는 첫 실행 안내와 독립적으로 검증한다.
  // chromium-auth-guide는 addInitScript에서 이 key를 제거해 자동 실행을 별도 검증한다.
  await page.evaluate((storageKey) => {
    localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      status: 'dismissed',
      stepIndex: 0,
    }));
  }, SYSTEM_GUIDE_STORAGE_KEY);

  // storage state 저장 — 후속 spec 들이 storageState 옵션으로 재사용.
  await page.context().storageState({ path: AUTH_STORAGE_PATH });
});
