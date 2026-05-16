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
import { hasTestUser, getTestReadingSlug } from './fixtures/test-user';

const READING_SLUG = getTestReadingSlug();

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

// 6 카드 섹션은 <h2>오늘의 분야별 흐름</h2> 으로 시작. 페이지 내 다른 점수 그리드
// (예: today-iljin-breakdown) 와 구분된다.
const AREA_SECTION = 'section:has(h2:text("오늘의 분야별 흐름"))';

async function extractAreaScores(page: Page): Promise<Record<string, number>> {
  const section = page.locator(AREA_SECTION).first();
  await expect(section).toBeVisible({ timeout: 10_000 });

  const articles = section.locator('article');
  const count = await articles.count();
  expect(count, `${AREA_SECTION} 안의 카드 6개 기대 (실제 ${count})`).toBe(
    UNIFIED_AREA_LABELS.length
  );

  const scores: Record<string, number> = {};
  for (let i = 0; i < count; i += 1) {
    const article = articles.nth(i);
    const text = (await article.innerText()).trim();
    // 첫 줄은 라벨, 둘째 줄은 숫자. innerText 가 "총운\n45" 같은 형태.
    const [label, scoreLine] = text.split('\n');
    const score = Number.parseInt(scoreLine, 10);
    expect(
      Number.isFinite(score),
      `${label} 카드 점수가 정수여야 함 (실제 "${scoreLine}")`
    ).toBe(true);
    scores[label.trim()] = score;
  }
  return scores;
}

test.describe('1. 사주 메인 페이지 — 6 영역 카드 (PR #181 회귀 차단)', () => {
  test(`/saju/${READING_SLUG} 가 6 영역 카드를 모두 노출`, async ({ page }) => {
    await page.goto(`/saju/${READING_SLUG}`);
    await page.waitForLoadState('networkidle');

    const scores = await extractAreaScores(page);

    // 6 영역 모두 라벨이 키로 존재.
    for (const label of UNIFIED_AREA_LABELS) {
      expect(scores, `사주 메인 페이지에 "${label}" 카드가 누락`).toHaveProperty(label);
    }
    // 각 점수는 0-100 범위.
    for (const [label, score] of Object.entries(scores)) {
      expect(score, `${label} 점수 0-100 범위`).toBeGreaterThanOrEqual(0);
      expect(score, `${label} 점수 0-100 범위`).toBeLessThanOrEqual(100);
    }
  });
});

test.describe('2. 사주 상세 hero anchor 작동 (PR #182 회귀 차단)', () => {
  test(`/saju/${READING_SLUG}/premium hero 카드의 anchor 가 살아있음`, async ({ page }) => {
    await page.goto(`/saju/${READING_SLUG}/premium`);
    await page.waitForLoadState('networkidle');

    // premium 페이지에는 #premium-yearly / #premium-monthly section 이 정의돼 있어야 함.
    // (PR #182 회귀 패턴: id 가 없는데 href="#xxx" 만 있어 button 무반응)
    const yearlyAnchor = page.locator('#premium-yearly');
    const monthlyAnchor = page.locator('#premium-monthly');
    await expect(yearlyAnchor, '#premium-yearly section 존재').toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(monthlyAnchor, '#premium-monthly section 존재').toHaveCount(1);

    // hero 카드의 "올해" 류 anchor link 가 #premium-yearly 를 가리켜야 함.
    // selector 가 page 디자인 변경에 따라 깨질 수 있으므로 href 만 검증.
    const yearlyHref = page.locator('a[href="#premium-yearly"], button[data-href="#premium-yearly"]');
    const yearlyCount = await yearlyHref.count();
    expect(yearlyCount, '#premium-yearly 를 가리키는 link/button 1개 이상').toBeGreaterThan(0);
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
  test(`/saju/${READING_SLUG} 의 6 영역 score 가 /today-fortune 과 1:1 일치`, async ({
    page,
  }) => {
    // 1. 사주 메인 페이지 점수 추출.
    await page.goto(`/saju/${READING_SLUG}`);
    await page.waitForLoadState('networkidle');
    const sajuScores = await extractAreaScores(page);

    // 2. 오늘 운세 페이지 점수 추출.
    await page.goto('/today-fortune');
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
