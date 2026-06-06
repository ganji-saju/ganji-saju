// 2026-06-07 — 미완성 UI 금지문구 회귀 차단 E2E (가드 2단계).
//
// 닫힌 PR #235(phase-5f) 계승. 1단계(#421)에서 공개 노출 '준비 중'/'결과가 없습니다'
// 잔존 카피를 표준 컴포넌트·확정 카피로 정리한 결과를 회귀로부터 보호한다.
//
// 동작: 공개 핵심 페이지 진입 시, 렌더된 body.innerText 에 금지문구가 노출되면 fail.
//   - innerText 기반이라 주석/스크립트/스타일/data-attribute 는 자연히 제외된다.
//   - "출시 예정" 은 의도된 카피라 허용. 금지 대상은 미완성/플레이스홀더 표기.
//
// 스코프 정책(B3, 2026-06-07 확정):
//   가드는 UI 크롬(가격·배지·빈상태·로딩) 회귀를 잡는 용도다. 콘텐츠 프로즈
//   라우트(/dream, /dream-interpretation/[slug] 등)는 본문 자연어에 '준비 중'
//   ("임신을 준비 중인 분들" 등)이 정상적으로 등장하므로 **스코프에서 제외**한다.
//   해당 콘텐츠는 별도 단위 가드(dream-content 한자/금지어휘 테스트,
//   public-commercialization-copy.test.ts)가 소스 레벨에서 보호한다.

import { test, expect, type Page } from '@playwright/test';

// 렌더된 visible text 에서 0건이어야 하는 미완성 표기.
//   '불러오는 중'·'준비 중' 류 로딩/플레이스홀더는 LoadingState/EmptyState/
//   FeatureUnavailable 표준 컴포넌트의 확정 카피로 대체되어야 한다.
const FORBIDDEN_PHRASES: ReadonlyArray<string> = [
  '준비 중',
  '준비중',
  '로딩중',
  '로딩 중',
  '불러오는 중',
  '결과가 없습니다',
  'Coming soon',
  'TODO',
  'FIXME',
];

// 인증이 필요 없는 공개·상업 핵심 라우트.
//   콘텐츠 프로즈 라우트(/dream*, /dream-interpretation/[slug])는 B3 정책상 제외.
//   인증 페이지(/my/*, /admin/*)는 범위 밖.
const PUBLIC_PAGES = [
  { path: '/', name: '홈' },
  { path: '/pricing', name: '/pricing' },
  { path: '/membership', name: '/membership' },
  { path: '/today-fortune', name: '/today-fortune' },
  { path: '/tarot/daily', name: '/tarot/daily' },
  { path: '/zodiac', name: '/zodiac' },
  { path: '/star-sign', name: '/star-sign' },
  { path: '/credits', name: '/credits' },
  { path: '/saju/new', name: '/saju/new' },
  { path: '/compatibility/input', name: '/compatibility/input' },
  { path: '/dialogue', name: '/dialogue' },
  { path: '/login', name: '/login' },
  { path: '/terms', name: '/terms' },
  { path: '/privacy', name: '/privacy' },
  { path: '/legal', name: '/legal' },
  { path: '/help', name: '/help' },
  { path: '/support/faq', name: '/support/faq' },
  { path: '/sample-report', name: '/sample-report' },
] as const;

/** body 의 visible 텍스트만 추출 (script/style/주석 제외). */
async function getVisibleText(page: Page): Promise<string> {
  return await page.evaluate(() => document.body?.innerText ?? '');
}

for (const { path, name } of PUBLIC_PAGES) {
  test(`${name} — 미완성 금지문구(준비 중 / 로딩중 / 결과가 없습니다 등) 미노출`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBeLessThan(400);

    // 핵심 골격이 보일 때까지 대기 — Suspense fallback 도 visible text 에 잡히면 검출 대상.
    await expect(
      page.locator('main, [role="main"], h1, h2, header, nav').first()
    ).toBeVisible({ timeout: 15_000 });

    const visibleText = await getVisibleText(page);
    const found = FORBIDDEN_PHRASES.filter((phrase) => visibleText.includes(phrase));

    expect(
      found,
      `${name} 페이지 visible text 에 미완성 금지문구 노출: ${found.join(', ')}. ` +
        `표준 컴포넌트(FeatureUnavailable / EmptyState / LoadingState)나 확정 카피로 교체 필요. ` +
        `(가드 정책: docs/superpowers/notes/2026-06-07-incomplete-ui-phrase-scan.md)`
    ).toEqual([]);
  });
}
