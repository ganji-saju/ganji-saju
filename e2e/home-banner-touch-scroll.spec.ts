import { expect, test, type Page } from '@playwright/test';

const META_GALAXY_UA =
  'Mozilla/5.0 (Linux; Android 15; SM-S931N; wv) AppleWebKit/537.36 ' +
  'Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A]';

async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let step = 1; step <= 8; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / 8,
          y: from.y + ((to.y - from.y) * step) / 8,
        },
      ],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
}

test.use({
  viewport: { width: 412, height: 780 },
  isMobile: true,
  hasTouch: true,
  userAgent: META_GALAXY_UA,
});

// 병렬 실행 경합 대응은 아래 '가로 스와이프' 테스트 주석 참조(같은 원인).
//   세로 스크롤도 캐러셀 위에서 시작하므로 하이드레이션 전 스와이프가 무효가 될 수 있다.
test('Galaxy Meta in-app browser can vertically scroll from the home banner', async ({ page }) => {
  await page.goto('/?fbclid=e2e-meta', { waitUntil: 'domcontentloaded' });
  const carousel = page.locator('[aria-roledescription="carousel"]');
  await expect(carousel).toBeVisible();

  await expect(async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await carousel.boundingBox();
    expect(box).not.toBeNull();
    await swipe(
      page,
      { x: box!.x + box!.width / 2, y: box!.y + box!.height * 0.8 },
      { x: box!.x + box!.width / 2, y: -250 }
    );
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(20);
  }).toPass({ timeout: 20_000 });
});

// 2026-07-19 — 병렬 실행에서만 산발적으로 실패하던 것을 수정(직렬 5/5 통과).
//   캐러셀의 스와이프는 React 가 붙이는 pointer 핸들러로 동작하는데, goto 가
//   `domcontentloaded` 까지만 기다려 **하이드레이션 전에 스와이프**하면 아무 일도 안 난다.
//   직렬에서는 하이드레이션이 빨라 우연히 통과했다(= 제품 버그 아님, 테스트 경합).
//   해결: 슬라이드가 실제로 넘어갈 때까지 스와이프를 재시도(toPass).
test('home banner still changes slides with a horizontal swipe', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const carousel = page.locator('[aria-roledescription="carousel"]');
  await expect(carousel).toBeVisible();

  await expect(async () => {
    const box = await carousel.boundingBox();
    expect(box).not.toBeNull();
    await swipe(
      page,
      { x: box!.x + box!.width * 0.85, y: box!.y + box!.height / 2 },
      { x: box!.x + box!.width * 0.15, y: box!.y + box!.height / 2 }
    );
    await expect(carousel).toHaveAttribute('aria-label', /추천 운세 배너 [2-5]\/5/, {
      timeout: 1500,
    });
  }).toPass({ timeout: 20_000 });
});
