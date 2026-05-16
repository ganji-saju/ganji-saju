// 2026-05-16 PR #184 — Phase 2A: 인증 필요 없는 페이지 smoke E2E.
//
// 사용자 메타 피드백 ("사용성 회귀를 사용자가 매번 보고하는 cycle 단축") 대응.
// 페이지 진입 자체가 깨지거나 console error 가 발생하는 회귀를 자동 검출.
//
// Phase 2A 검증 범위 (인증 X 페이지):
//   - 페이지 status 200
//   - 핵심 HTML 골격 (main / header / nav) 노출
//   - console error 0
//   - dead internal link 0
//
// 인증 필요 페이지 (사주, /my/*, /admin/*) 는 Phase 2B 에서 fixture 작업 후 추가.
import { test, expect, type Page } from '@playwright/test';

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });
  return errors;
}

// 인증 필요 없는 핵심 페이지 — 매번 자동 검증.
const PUBLIC_PAGES = [
  { path: '/', name: '홈' },
  { path: '/pricing', name: '/pricing' },
  { path: '/membership', name: '/membership' },
  { path: '/compatibility/input', name: '/compatibility/input' },
] as const;

for (const { path, name } of PUBLIC_PAGES) {
  test.describe(`${name} 페이지`, () => {
    test('정상 로드 + 핵심 HTML 골격 노출 + console error 0', async ({ page }) => {
      const errors = collectConsoleErrors(page);
      const response = await page.goto(path);

      // 1. status 200 (또는 적어도 200-399).
      expect(response?.status(), `${path} returned ${response?.status()}`).toBeLessThan(400);

      // 2. 최소한 어떤 visible 콘텐츠가 있어야 함 — page 가 완전 빈 화면 회귀 차단.
      const visibleContent = page.locator('main, [role="main"], h1, h2, nav, header');
      await expect(visibleContent.first()).toBeVisible({ timeout: 10_000 });

      // 3. console error 0.
      //   허용 예외: 외부 service (analytics) 등으로 인한 미세 error 는 무시하고 싶을 수 있음.
      //   현재는 strict — 발견 시 spec 에 명시적 ignore 추가.
      const significant = errors.filter(
        (e) =>
          // Vercel analytics / 외부 script 의 흔한 무해 error 무시.
          !/Failed to load resource.*analytics/i.test(e) &&
          !/manifest\.webmanifest/i.test(e)
      );
      expect(significant, `${path} console errors:\n${significant.join('\n')}`).toEqual([]);
    });
  });
}

test.describe('dead link 검증 (사용자 보고 PR #182 류 회귀 차단)', () => {
  test('홈에서 노출되는 internal link 가 모두 200-399', async ({ page }) => {
    await page.goto('/');

    const hrefs = await page.locator('a[href]').evaluateAll((els) =>
      els
        .map((el) => (el as HTMLAnchorElement).getAttribute('href'))
        .filter(
          (h): h is string =>
            !!h &&
            !h.startsWith('http') &&
            !h.startsWith('mailto:') &&
            !h.startsWith('tel:') &&
            !h.startsWith('#') &&
            !h.startsWith('javascript:')
        )
    );

    // 중복 제거 + 최대 20 sampling (시간 절약).
    const sample = Array.from(new Set(hrefs)).slice(0, 20);
    const failures: string[] = [];
    for (const href of sample) {
      const res = await page.request.get(href, { failOnStatusCode: false });
      if (res.status() >= 400) failures.push(`${href} → ${res.status()}`);
    }
    expect(failures, `dead links:\n${failures.join('\n')}`).toEqual([]);
  });
});
