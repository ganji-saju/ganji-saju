import { test, expect } from '@playwright/test';

// 2026-08-29 — 스티키 서브헤더(뒤로가기+제목)가 상단 메뉴에 반쯤 먹히던 회귀 차단.
//
//   원인은 오프셋을 상수로 박아둔 것이었다. `subpages.css` 의 `top: 3.25rem` 은
//   `app-shell.css` 의 `min-height: 3.25rem` 을 보고 쓴 값인데, 나중에 readability.css 가
//   헤더를 3.95rem 으로 키우면서 상수는 따라가지 않았다 — 실측 헤더는 뷰포트마다
//   64/69/77px 이라 12~25px 이 헤더 밑으로 파고들어 글자와 버튼이 잘렸다.
//
//   유닛(sticky-header-offset.spec.ts)은 "상수를 다시 박지 않았나"만 본다.
//   실제로 0px 로 붙는지, 모바일에서 화면 끝까지 차는지는 렌더해야 알 수 있다.

const SUB_HEADER = '.gangi-sub-header';

/** 헤더 하단과 서브헤더 상단의 간격(px). 0 이어야 한다. */
async function stickyGap(page: import('@playwright/test').Page) {
  return page.evaluate((sel) => {
    const header = ['.mega-nav-root', '.app-top-header']
      .map((s) => document.querySelector<HTMLElement>(s))
      .find((el) => el && el.offsetHeight > 0);
    const sub = document.querySelector(sel);
    if (!header || !sub) return null;
    return sub.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
  }, SUB_HEADER);
}

test.describe('스티키 서브헤더', () => {
  for (const [label, width, height] of [
    ['모바일', 390, 800],
    ['태블릿', 768, 900],
    ['PC', 1280, 900],
  ] as const) {
    test(`${label}에서 스크롤해도 상단 메뉴에 가려지지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/pricing');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator(SUB_HEADER)).toBeVisible();

      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(400);

      const gap = await stickyGap(page);
      expect(gap).not.toBeNull();
      // 헤더 높이는 소수(64.19 / 68.67 / 77.47px)라 반올림 오차 1px 만 허용한다.
      // 음수 = 헤더 밑으로 파고들어 잘리는 상태(이 버그), 큰 양수 = 배경이 비치는 틈.
      expect(Math.abs(gap!)).toBeLessThan(1);
    });
  }

  test('모바일에선 좌우 여백 없이 화면 끝까지 찬다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/pricing');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator(SUB_HEADER)).toBeVisible();

    const box = await page.locator(SUB_HEADER).boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(Math.round(box!.width)).toBe(viewport.width);

    // 풀블리드가 가로 넘침을 만들면 모바일 터치 스크롤이 죽는다(mobile-touch-scroll.spec.ts 참고).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
