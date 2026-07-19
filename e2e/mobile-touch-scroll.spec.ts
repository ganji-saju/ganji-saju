import { test, expect, devices } from '@playwright/test';

// 2026-07-19 — 모바일 터치 스크롤 회귀 차단.
//
// 실증 버그: 폰에서 사이트 접속 직후 스크롤이 안 됨(회사폰 6대 전부 재현).
//   근본 원인 = `@media (max-width:767px) { html, body { overflow-x: hidden } }`.
//   overflow-x 를 지정하면 CSS 규칙상 반대 축(overflow-y)이 visible → **auto** 로 강제되어
//   html 과 body 가 **둘 다 스크롤 컨테이너**가 된다. 이 상태에서 터치 팬이 어느 쪽에도
//   전달되지 않아 화면이 얼어붙는다(프로그램적 window.scrollTo 는 정상 동작 → 진단이 어렵다).
//   데스크톱은 미디어쿼리 밖이라 멀쩡했고, 그래서 오래 발견되지 않았다.
//
// 이 스펙은 **실제 터치 이벤트**(CDP Input.dispatchTouchEvent)로 스와이프한다.
//   mouse wheel 이나 window.scrollTo 로는 이 버그가 재현되지 않으므로 반드시 터치여야 한다.

const MOBILE = devices['Galaxy S9+'];

test.use({ ...MOBILE, hasTouch: true, isMobile: true });

/** 화면 중앙에서 위로 스와이프하고 최종 scrollY 를 돌려준다. */
async function swipeUp(page: import('@playwright/test').Page, startY: number, distance: number) {
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(page.viewportSize()!.width / 2);
  const endY = startY - distance;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
  for (let i = 1; i <= 12; i += 1) {
    const y = Math.round(startY + (endY - startY) * (i / 12));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
  return page.evaluate(() => Math.round(window.scrollY));
}

test.describe('모바일 터치 스크롤', () => {
  test('홈에서 손가락 스와이프로 스크롤된다', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1200);

    // 동의 배너가 떠 있으면 닫는다(배너 자체는 body 포털이라 스크롤과 무관하지만
    // 터치 지점이 배너에 가리면 테스트가 무의미해진다).
    const agree = page.getByRole('button', { name: '동의' });
    if (await agree.count()) {
      await agree.first().click();
      await page.waitForTimeout(400);
    }

    // 페이지가 실제로 스크롤 가능한 길이인지 먼저 확인(전제 검증).
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    expect(scrollable, '홈이 스크롤 가능한 높이여야 테스트가 의미 있다').toBeGreaterThan(400);

    const y = await swipeUp(page, Math.round(page.viewportSize()!.height * 0.7), 220);
    expect(y, '터치 스와이프 후 페이지가 스크롤되어야 한다').toBeGreaterThan(100);
  });

  test('html·body 가 동시에 세로 스크롤 컨테이너가 되지 않는다', async ({ page }) => {
    // 위 증상의 구조적 원인을 직접 고정한다. 터치 테스트보다 실패 원인이 명확해
    // 회귀 시 진단 시간을 줄인다.
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const overflow = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflowY,
      body: getComputedStyle(document.body).overflowY,
    }));

    const isContainer = (v: string) => v === 'auto' || v === 'scroll';
    expect(
      isContainer(overflow.html) && isContainer(overflow.body),
      `html(${overflow.html})·body(${overflow.body}) 가 둘 다 스크롤 컨테이너면 모바일 터치 스크롤이 죽는다`
    ).toBe(false);
  });
});
