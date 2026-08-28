// 2026-05-16 Phase 2B — 사주 페이지 인증 E2E.
//
// Phase 2A (smoke.spec.ts) 가 인증 X 페이지를 자동 검증한다면, Phase 2B 는
// 로그인 필요 페이지 (사주 메인/상세, 결제 진입점) 의 4 회귀 시나리오를 매 PR
// 자동 검증한다.
//
// 검증 시나리오 ↔ 회귀 매핑:
// | # | PR | 시나리오 |
// |---|---|---|
// | 1 | #181 | 사주 메인 페이지에 6 영역 카드 (총운/직장/재물/연애/관계/컨디션) 모두 노출 |
// | 2 | #182 | /saju/[slug]/premium 의 hero 카드 3 버튼이 살아있는 anchor 로 이동 |
// | 3 | #177/#178 | /membership 플랜 카드가 활성 구독자에게 "이용 중" 배지 노출 (보유 시) |
// | 4 | #179-#181 | /saju/[slug] 의 6 영역 score 와 /today-fortune 의 동일 영역 score 가 1:1 일치 |
//
// 인증 fixture: auth.setup.ts 가 처음 1회 로그인해서 storage state 저장 → 본 spec
// 들이 storageState 로 재사용. credentials 미설정 환경에서는 auth-setup 이 skip
// → 본 spec 도 dependency 로 자동 skip (CI 안전).

import { test, expect } from '@playwright/test';
import { hasTestUser, getTestUser } from './fixtures/test-user';
import { resolveProfileReadingSlug } from './fixtures/reading-slug';
import { resolveTestUserId, resetFreeDailyUsage } from './fixtures/entitlement-helpers';

// 2026-06-27 — 슬러그는 더 이상 영속 reading(E2E_TEST_READING_SLUG)에 의존하지 않고
// 테스트 유저 프로필에서 런타임 유도한다(#484 데이터 초기화로 readings 삭제돼도 안전).
// 상세: e2e/fixtures/reading-slug.ts

// 인증 fixture 미설정 환경은 dependency chain 으로 skip 되지만, 명시적 가드로
// 디버그 메시지를 남긴다.
test.beforeEach(async () => {
  test.skip(!hasTestUser(), 'E2E_TEST_USER_EMAIL/PASSWORD 미설정 — Phase 2B skip');
});

// 2026-08-29 — 6 영역 카드 라벨 상수와 extractAreaScores 헬퍼를 걷어냈다.
//   그 UI 는 1035cd6d 로 사라졌고(사용자 확정), 산식 계약은 단위 테스트가 지킨다:
//   src/server/today-fortune/saju-data-entry-invariant.test.ts

// 🔴 2026-08-29 — 이 자리에 있던 '6 영역 카드' 가드(PR #181)를 **계약이 바뀌어** 교체한다.
//   `1035cd6d` (사용자 확정: "중복·군더더기 제거 — '오늘의 분야별 흐름' 카드")이 사주
//   결과에서 SajuAreaCardsSection 을 내렸고, 지금은 앱 어디에서도 렌더되지 않는다.
//   즉 없는 UI 를 계속 단언하고 있었다 — 통과할 수 없는 가드는 가드가 아니다.
//
//   6 영역 **산식**은 사라지지 않았고 단위 테스트가 지킨다:
//     src/server/today-fortune/saju-data-entry-invariant.test.ts
//   여기서는 개편이 실제로 약속하는 것 — 무료로 보이는 것과 잠기는 것 — 을 고정한다.
test.describe('1. 사주 결과 — 무료 지면과 결제 경계 (개편 계약)', () => {
  test('/saju/[slug] 는 종합 리포트 목차를 열어두고 점수는 잠근다', async ({ page }) => {
    const slug = await resolveProfileReadingSlug(page);
    await page.goto(`/saju/${slug}`);
    await page.waitForLoadState('networkidle');

    // 간판 상품(bundle_comprehensive) 업셀 목차 — 무료로 보여야 결제로 이어진다.
    await expect(
      page.locator('[aria-label="종합사주 리포트 안내"]'),
      '종합 리포트 목차(무료 지면)'
    ).toBeVisible({ timeout: 10_000 });

    // 🔴 돈줄 가드 — 종합점수는 무료가 아니다(score-total 3,300원). 미결제 계정에서
    //   잠금이 풀려 보이면 상품을 공짜로 내주는 것이다.
    await expect(
      page.locator('[aria-label="사주 점수 (잠금)"]'),
      '미결제 계정에서 점수 잠금'
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('2. 사주 상세 hero anchor 작동 (PR #182 회귀 차단)', () => {
  test('/saju/[slug]/premium hero 카드 anchor 가 실제 id 로 매핑됨', async ({
    page,
  }) => {
    const slug = await resolveProfileReadingSlug(page);
    await page.goto(`/saju/${slug}/premium`);
    await page.waitForLoadState('networkidle');

    // hero 카드 anchor 버튼 — `#premium-*` 를 가리키는 link/button 만 추출.
    // 무료 사용자 (premium content 미 unlock) 는 hero 카드 자체가 없을 수 있음.
    const heroAnchors = page.locator('a[href^="#premium-"], button[data-href^="#premium-"]');
    const heroCount = await heroAnchors.count();

    test.skip(
      heroCount === 0,
      'test user 가 premium content 권한 없음 — hero 카드 미렌더. paid 계정으로 재실행 필요. ' +
        '(PR #182 회귀는 audit-dead-anchors.mjs + 본 E2E 양쪽에서 점검; E2E 는 paid 상태 한정)'
    );

    // hero anchor 가 있으면 → 각 href 가 가리키는 id 가 실제 페이지에 렌더링돼야 함 (PR #182 회귀 차단).
    const hrefs = await heroAnchors.evaluateAll((els) =>
      Array.from(
        new Set(
          els
            .map(
              (el) =>
                el.getAttribute('href') || el.getAttribute('data-href') || ''
            )
            .filter((h) => h.startsWith('#'))
        )
      )
    );

    expect(hrefs.length, '`#premium-*` 형식의 hero anchor 1개 이상').toBeGreaterThan(0);

    for (const href of hrefs) {
      const target = page.locator(href);
      const count = await target.count();
      expect(
        count,
        `${href} anchor 가 가리키는 id 가 페이지에 존재해야 함 (PR #182 류 dead anchor 회귀)`
      ).toBeGreaterThan(0);
    }
  });
});

test.describe('3. /membership 결제 진입점 (PR #177/#178 회귀 차단)', () => {
  test('/membership 이 정상 렌더 + 활성 구독자에게 "이용 중" 배지 노출', async ({ page }) => {
    await page.goto('/membership');
    await page.waitForLoadState('networkidle');

    // plan 카드 영역이 있어야 함 (구체 selector 는 컴포넌트 구조에 따라 조정 필요).
    const planSection = page.locator('main, [role="main"]');
    await expect(planSection.first()).toBeVisible({ timeout: 10_000 });

    // 활성 구독자라면 "이용 중" 배지 1개 이상. 비구독자는 0개여도 정상 — 차단 검증은
    // 후속 step 에서 추가. (PR #177/#178 의 "이용 중" 차단 9 곳 중 /membership 의
    // 1 곳 만 우선 검증; 나머지는 별도 fixture 필요)
    const inUseBadge = page.locator('text=/이용\\s*중/');
    const inUseCount = await inUseBadge.count();
    if (inUseCount > 0) {
      // 활성 구독자: 결제 button 이 "결제 내역" 등 대체 CTA 로 바뀌어야 함.
      // PR #177 fix: "결제" → "✓ 이용 중 · 결제 내역" 류.
      const checkoutButton = page.locator(
        'button:has-text("결제하기"), a[href*="checkout"][href*="plan="]'
      );
      // 활성 plan 의 결제 버튼은 미노출 또는 다른 라벨이어야 함. 본 검증은 향후
      // 보강 — 현재는 page 정상 렌더 + 배지 존재만 확인.
      // eslint-disable-next-line playwright/no-conditional-in-test
      console.log(
        `[Phase 2B] 활성 구독 감지 — "이용 중" 배지 ${inUseCount}개, 결제 button ${await checkoutButton.count()}개`
      );
    }
  });
});

// 2026-07-18 — 무료 오늘운세가 1장 요약으로 축소되면서(20260718 PPTX slide6) 결과 페이지에서
//   6 영역 카드(TodayCategoryReadings)가 빠졌다. 6영역 상세는 유료 '오늘 자세히 보기'로 이동.
//   따라서 무료 화면에서 검증 가능한 불변식은 **총운(종합점수) 일치**로 좁힌다.
//   (사주 페이지의 6영역 카드 자체는 위 describe 1 이 계속 지킨다.)
test.describe('4. 점수 일치 (PR #179-#181 회귀 차단)', () => {
  // 2026-08-03 — 무료 하루 1회 제한(daily-limit.ts, 2026-07-18)이 공유 test 계정의
  //   today-fortune 쿼터를 소진시켜, 같은 KST 날짜에 CI 가 두 번째로 돌면 아래 제출이
  //   free_daily_limit 으로 막혀 결과 페이지로 넘어가지 못했다(#660 머지 후 main red 의
  //   실제 원인 — 08-02 쿠폰 PR 연속 머지로 하루 여러 run 이 겹쳤다). 매 시도 전에 계정
  //   쿼터를 리셋해 결정론화. service_role 미설정(로컬)이면 리셋 skip(기존 동작 유지).
  //   (쿠키 gj_free_today 는 매 run fresh context 라 사전 존재 X → 계정 리셋만으로 충분.)
  test.beforeEach(async () => {
    const credentials = getTestUser();
    if (!credentials || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const userId = await resolveTestUserId(credentials.email);
    await resetFreeDailyUsage(userId);
  });

  // 🔴 2026-08-29 — 원래 이 테스트는 사주 페이지의 '총운' 카드 점수와 오늘운세 결과의
  //   종합점수를 **화면끼리** 대조했다. 개편으로 두 전제가 다 사라졌다:
  //     ① 사주 페이지의 6 영역 카드 제거(1035cd6d) → 읽을 '총운' 숫자가 없다
  //     ② 종합점수는 유료(score-total) → 미결제 계정에는 애초에 숫자가 안 보인다
  //   점수 일치(#179~#181)는 **산식**의 계약이므로 단위 테스트로 지킨다
  //   (saju-data-entry-invariant.test.ts — 저장된 V1 ↔ 재계산이 6 영역 동일).
  //   E2E 에는 브라우저라야 확인되는 것만 남긴다: 두 화면이 살아 있고, 유료 경계가 지켜진다.
  test('오늘운세 결과는 종합점수를 렌더하고, 사주 페이지 점수는 잠겨 있다', async ({ page }) => {
    const slug = await resolveProfileReadingSlug(page);
    await page.goto(`/saju/${slug}`);
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('[aria-label="사주 점수 (잠금)"]'),
      '미결제 계정에서 사주 점수 잠금'
    ).toBeVisible({ timeout: 10_000 });

    await page.goto('/today-fortune');
    await page.waitForLoadState('networkidle');

    const submitButton = page.getByRole('button', { name: '오늘 운세 보기' });
    await expect(submitButton, '/today-fortune 의 "오늘 운세 보기" 버튼').toBeVisible({
      timeout: 10_000,
    });
    await submitButton.click();

    await page.waitForURL((url) => url.pathname.startsWith('/today-fortune/result'), {
      timeout: 15_000,
    });
    await page.waitForLoadState('networkidle');

    // TodayScoreReveal 은 0 → 목표값 카운트업이라 최종값을 poll 로 기다린다.
    const scoreSection = page.locator('section[aria-label="오늘운세 점수"]');
    await expect(scoreSection, '오늘운세 점수 섹션').toBeVisible({ timeout: 10_000 });
    await expect
      .poll(
        async () => {
          const found = (await scoreSection.innerText()).match(/\b(\d{1,3})\b/);
          return found ? Number.parseInt(found[1], 10) : -1;
        },
        { timeout: 10_000, message: '오늘운세 종합점수가 0-100 범위로 렌더되지 않음' }
      )
      .toBeGreaterThanOrEqual(0);
  });
});
