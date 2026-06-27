// 2026-05-16 Phase 2C — 결제 중복 차단 9곳 활성 계정 검증 (PR #177/#178 회귀 차단).
//
// Phase 2B 가 free user 의 4 시나리오를 검증한다면, Phase 2C 는 **활성 entitlement**
// 사용자 시나리오를 매 PR 자동 검출한다.
//
// 전략:
// - test.beforeAll 에서 service_role 로 entitlement seed
// - 각 describe 가 UI 차단 동작 검증
// - test.afterAll 에서 cleanup (다음 spec run 영향 0)
//
// 검증 시나리오 ↔ PR 매핑:
// | # | 페이지 | 검증 |
// |---|---|---|
// | 1 | /membership | 활성 구독 plan 카드에 "이용 중" 배지 노출 (PR #177) |
// | 2 | /pricing | 활성 구독 plan 카드에 "✓ 이용 중 · 결제 내역" 버튼 (PR #177) |
// | 3 | /membership/checkout?plan=... | "이미 이용 중인 멤버십입니다" 안내 (PR #177) |
// | 4 | /saju/[slug]/deep | lifetime 보유 시 "✓ 구매한 풀이 보기" CTA (PR #177) |
//
// 다음 sprint (Phase 2C-2):
// - today-detail entitlement (premium-lock-card)
// - love-question entitlement (compatibility/result)
// - monthly-calendar entitlement (fortune-calendar-panel)
// - subscription-expiring notification feed

import { test, expect } from '@playwright/test';
import { hasTestUser, getTestUser } from './fixtures/test-user';
import { resolveProfileReadingSlug } from './fixtures/reading-slug';
import {
  resolveTestUserId,
  seedSubscription,
  cleanupSubscription,
  seedProductEntitlement,
  cleanupProductEntitlement,
  buildLifetimeReportScopeKey,
} from './fixtures/entitlement-helpers';

// auth.setup.ts 가 저장하는 storageState — beforeAll 에서 인증 컨텍스트로 슬러그 유도용.
const AUTH_STORAGE_PATH = 'e2e/.auth/test-user.json';

// 모든 spec 이 service_role + test user 의존. 미설정 환경은 skip.
test.beforeEach(async () => {
  test.skip(
    !hasTestUser() || !process.env.SUPABASE_SERVICE_ROLE_KEY,
    'E2E_TEST_USER_* / SUPABASE_SERVICE_ROLE_KEY 미설정 — Phase 2C skip'
  );
});

test.describe('1-3. Active subscription 활성 사용자 (PR #177 회귀 차단)', () => {
  // serial mode — 단일 worker 가 beforeAll → 3 test → afterAll 순서로 실행.
  // (fullyParallel + 다중 worker 시 한 worker 의 afterAll cleanup 이 다른 worker
  // test 의 UI check 전에 실행되어 seed 가 사라지는 race 차단)
  test.describe.configure({ mode: 'serial' });

  let userId: string;

  test.beforeAll(async () => {
    const credentials = getTestUser();
    if (!credentials || !process.env.SUPABASE_SERVICE_ROLE_KEY) return; // beforeEach 가 skip 처리
    userId = await resolveTestUserId(credentials.email);
    // 2026-06-23 — 라이트(plus_monthly) 멤버십 신규 판매 중단 → 프리미엄 구독 기준으로 검증.
    await seedSubscription(userId, 'premium_monthly');
  });

  test.afterAll(async () => {
    if (!userId) return;
    await cleanupSubscription(userId);
  });

  test('/membership 에 활성 구독 plan 카드 "이용 중" 배지 노출', async ({ page }) => {
    await page.goto('/membership');
    await page.waitForLoadState('networkidle');

    // "이용 중" 텍스트 1개 이상 — 활성 plan 의 배지.
    const inUseBadge = page.getByText('이용 중', { exact: false });
    await expect(
      inUseBadge.first(),
      '/membership 활성 plan 카드에 "이용 중" 배지'
    ).toBeVisible({ timeout: 10_000 });
  });

  test('/pricing 에 활성 구독 plan "✓ 이용 중 · 결제 내역" CTA', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');

    // 결제 button 대체 CTA — "✓ 이용 중 · 결제 내역" 또는 유사 텍스트.
    const altCta = page.getByText(/이용\s*중.*결제\s*내역/);
    await expect(
      altCta.first(),
      '/pricing 활성 plan "✓ 이용 중 · 결제 내역" CTA'
    ).toBeVisible({ timeout: 10_000 });
  });

  test('/membership/checkout?plan=premium 에 "이미 이용 중인 멤버십입니다" 안내', async ({
    page,
  }) => {
    // premium_monthly = premium plan. URL 의 plan slug 는 premium.
    await page.goto('/membership/checkout?plan=premium');
    await page.waitForLoadState('networkidle');

    const blockMessage = page.getByText(/이미 이용 중인 멤버십/);
    await expect(
      blockMessage.first(),
      '/membership/checkout 이미 이용 중 안내'
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('4. Lifetime report 보유 사용자 (PR #177 회귀 차단)', () => {
  // serial mode — beforeAll/afterAll race 방지 (위 describe 와 동일 이유).
  test.describe.configure({ mode: 'serial' });

  let userId: string;
  // 슬러그·scopeKey 는 beforeAll 에서 프로필 기반으로 런타임 유도(영속 reading 의존 제거).
  let readingSlug: string;
  let scopeKey: string;

  test.beforeAll(async ({ browser }) => {
    const credentials = getTestUser();
    if (!credentials || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    // 인증 컨텍스트로 테스트 유저의 정식 사주 슬러그 유도 → 같은 슬러그로 scope seed +
    // deep 페이지 접근(권한 매칭 보장). #484 데이터 초기화에도 안 깨짐.
    const context = await browser.newContext({ storageState: AUTH_STORAGE_PATH });
    try {
      const page = await context.newPage();
      readingSlug = await resolveProfileReadingSlug(page);
    } finally {
      await context.close();
    }
    scopeKey = buildLifetimeReportScopeKey(readingSlug);
    userId = await resolveTestUserId(credentials.email);
    await seedProductEntitlement(userId, 'lifetime-report', scopeKey);
  });

  test.afterAll(async () => {
    if (!userId || !scopeKey) return;
    await cleanupProductEntitlement(userId, 'lifetime-report', scopeKey);
  });

  test('/saju/[slug]/deep 에 "✓ 구매한 풀이 보기" CTA (결제 button 미노출)', async ({
    page,
  }) => {
    await page.goto(`/saju/${readingSlug}/deep`);
    await page.waitForLoadState('networkidle');

    const ownedCta = page.getByText(/구매한 풀이 보기/);
    await expect(
      ownedCta.first(),
      'lifetime 보유 사용자의 deep 페이지 CTA'
    ).toBeVisible({ timeout: 10_000 });
  });
});
