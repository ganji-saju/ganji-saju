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

import { test, expect, type Page } from '@playwright/test';
import { hasTestUser } from './fixtures/test-user';
import { resolveProfileReadingSlug } from './fixtures/reading-slug';

// 2026-06-27 — 슬러그는 더 이상 영속 reading(E2E_TEST_READING_SLUG)에 의존하지 않고
// 테스트 유저 프로필에서 런타임 유도한다(#484 데이터 초기화로 readings 삭제돼도 안전).
// 상세: e2e/fixtures/reading-slug.ts

// 인증 fixture 미설정 환경은 dependency chain 으로 skip 되지만, 명시적 가드로
// 디버그 메시지를 남긴다.
test.beforeEach(async () => {
  test.skip(!hasTestUser(), 'E2E_TEST_USER_EMAIL/PASSWORD 미설정 — Phase 2B skip');
});

// 6 영역 카드 라벨 — UNIFIED_AREA_LABELS 와 동기화.
// src/lib/today-fortune/compute-saju-area-scores.ts 변경 시 본 배열도 갱신 필요.
const UNIFIED_AREA_LABELS = [
  '총운',
  '직장·사업운',
  '재물운',
  '애정·연애운',
  '인간관계운',
  '컨디션·건강운',
] as const;

// 6 영역 score 추출 — 페이지마다 DOM 구조가 다르므로 (사주 페이지 = SajuAreaCardsSection
// vs 운세 페이지 = today-category-readings.tsx), heading/section 에 의존하지 않고
// label 텍스트가 정확히 매칭되는 article 을 찾아 그 안의 첫 번째 숫자를 score 로 사용.
//
// 안전장치:
// - exact text 매칭 (`label` 이 다른 article 본문에 substring 으로 포함돼도 무시)
// - 0-100 범위 정수 검증
async function extractAreaScores(page: Page): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};
  for (const label of UNIFIED_AREA_LABELS) {
    const article = page
      .locator('article')
      .filter({ has: page.getByText(label, { exact: true }) })
      .first();
    await expect(article, `${label} 카드 visible`).toBeVisible({ timeout: 10_000 });

    const text = (await article.innerText()).trim();
    // 첫 1-3 자리 정수 = score. (label 이 한국어 텍스트라 숫자와 충돌 없음)
    const match = text.match(/\b(\d{1,3})\b/);
    expect(match, `${label} 카드에서 score 추출 실패. innerText: "${text}"`).not.toBeNull();
    const score = Number.parseInt(match![1], 10);
    expect(score, `${label} score 0-100 범위`).toBeGreaterThanOrEqual(0);
    expect(score, `${label} score 0-100 범위`).toBeLessThanOrEqual(100);
    scores[label] = score;
  }
  return scores;
}

test.describe('1. 사주 메인 페이지 — 6 영역 카드 (PR #181 회귀 차단)', () => {
  test('/saju/[slug] 가 6 영역 카드를 모두 노출', async ({ page }) => {
    const slug = await resolveProfileReadingSlug(page);
    await page.goto(`/saju/${slug}`);
    await page.waitForLoadState('networkidle');

    // extractAreaScores 가 6 label 각각의 article 존재 + score 0-100 범위 자동 검증.
    // 누락 / 회귀 시 즉시 fail.
    const scores = await extractAreaScores(page);
    expect(Object.keys(scores).length, '6 영역 카드 모두 추출').toBe(UNIFIED_AREA_LABELS.length);
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

test.describe('4. 점수 일치 (PR #179-#181 회귀 차단)', () => {
  test('/saju/[slug] 의 6 영역 score 가 /today-fortune 결과 페이지와 1:1 일치', async ({
    page,
  }) => {
    // 1. 사주 메인 페이지 점수 추출. 슬러그는 프로필에서 유도 → /today-fortune(같은
    //    프로필 자동완성)과 동일 입력이므로 점수가 일치해야 함.
    const slug = await resolveProfileReadingSlug(page);
    await page.goto(`/saju/${slug}`);
    await page.waitForLoadState('networkidle');
    const sajuScores = await extractAreaScores(page);

    // 2. /today-fortune 은 입력 form 페이지 → "오늘 운세 보기" 클릭해서 결과 페이지로 이동.
    //    (form 은 logged-in 사용자의 MY 프로필이 자동 채워짐)
    await page.goto('/today-fortune');
    await page.waitForLoadState('networkidle');

    const submitButton = page.getByRole('button', { name: '오늘 운세 보기' });
    await expect(submitButton, '/today-fortune 의 "오늘 운세 보기" 버튼').toBeVisible({
      timeout: 10_000,
    });
    await submitButton.click();

    // 결과 페이지 (/today-fortune/result) 로 이동 + 6 카드 렌더 대기.
    await page.waitForURL((url) => url.pathname.startsWith('/today-fortune/result'), {
      timeout: 15_000,
    });
    await page.waitForLoadState('networkidle');

    const todayScores = await extractAreaScores(page);

    // 3. 6 영역 모두 1:1 일치.
    for (const label of UNIFIED_AREA_LABELS) {
      expect(
        sajuScores[label],
        `"${label}" 점수가 사주 페이지 vs 운세 페이지 불일치 (사주 ${sajuScores[label]} / 운세 ${todayScores[label]})`
      ).toBe(todayScores[label]);
    }
  });
});
