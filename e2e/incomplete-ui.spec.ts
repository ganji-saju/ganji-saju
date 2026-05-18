// 2026-05-18 Phase 5-F — 미완성 UI 회귀 차단 E2E.
//
// 사용자 directive: 공개 핵심 페이지에서 미완성 문구 0건.
// 본 spec 은 공개 페이지 진입 시 금지 문구가 렌더링된 HTML 에 노출되면 즉시 fail.
//
// Phase 5-A+B+C+D+E 의 정리 결과를 회귀로부터 보호.
// 정확한 노출 텍스트만 검출 — comment / data attribute / SR-only sr-only 영역은 제외.

import { test, expect, type Page } from '@playwright/test';

// 금지 문구 — 운영자 검토 후 confirm 된 미완성 표현.
// "출시 예정" 은 의도된 카피라 허용. "준비 중" / "로딩중" / "결과가 없습니다" 단순 표기는 금지.
const FORBIDDEN_PHRASES: ReadonlyArray<string> = [
  '준비 중',
  '준비중',
  '로딩중...',
  '결과가 없습니다',
  'TODO',
  'FIXME',
  'Coming soon',
  'coming-soon', // CSS class / data attr — visible text 매치 우려는 낮으나 추가 안전망
];

// 공개 핵심 페이지 — 사용자에게 직접 노출되는 routes.
// 인증 필요 페이지 (/my/*, /admin/*) 는 별도 spec.
const PUBLIC_PAGES = [
  { path: '/', name: '홈' },
  { path: '/pricing', name: '/pricing' },
  { path: '/membership', name: '/membership' },
  { path: '/today-fortune', name: '/today-fortune' },
  { path: '/tarot/daily', name: '/tarot/daily' },
  { path: '/zodiac', name: '/zodiac' },
  { path: '/star-sign', name: '/star-sign' },
  { path: '/dream-interpretation', name: '/dream-interpretation' },
  { path: '/credits', name: '/credits' },
  { path: '/saju/new', name: '/saju/new' },
  { path: '/dialogue', name: '/dialogue' },
  { path: '/login', name: '/login' },
  { path: '/terms', name: '/terms' },
  { path: '/privacy', name: '/privacy' },
  { path: '/legal', name: '/legal' },
  { path: '/help', name: '/help' },
  { path: '/support/faq', name: '/support/faq' },
  { path: '/sample-report', name: '/sample-report' },
] as const;

/**
 * 페이지의 visible 텍스트만 추출 (script / style / template / 주석 제외).
 * Playwright 의 textContent / innerText 도 가능하나 본 spec 은 body 의 모든 text node 합산.
 */
async function getVisibleText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // script / style 제거 후 body innerText
    const body = document.body;
    if (!body) return '';
    return body.innerText ?? '';
  });
}

for (const { path, name } of PUBLIC_PAGES) {
  test(`${name} — 금지 문구 (준비 중 / 로딩중 / TODO 등) 미노출`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `${path} status`).toBeLessThan(400);

    // 페이지 로드 완료 대기 — Suspense fallback 도 visible text 안에 있으면 검출 대상.
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const visibleText = await getVisibleText(page);

    const found = FORBIDDEN_PHRASES.filter((p) => visibleText.includes(p));
    expect(
      found,
      `${name} 페이지에 금지 문구가 visible HTML 에 노출됨: ${found.join(', ')}. ` +
        `Phase 5-A+B 의 미완성 UI 정리 회귀. src/components/state/feature-unavailable.tsx 또는 ` +
        `<EmptyState /> 표준 컴포넌트 사용 권장.`
    ).toEqual([]);
  });
}
