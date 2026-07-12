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

test('Galaxy Meta in-app browser can vertically scroll from the home banner', async ({ page }) => {
  await page.goto('/?fbclid=e2e-meta', { waitUntil: 'domcontentloaded' });
  const carousel = page.locator('[aria-roledescription="carousel"]');
  const box = await carousel.boundingBox();
  expect(box).not.toBeNull();

  await swipe(
    page,
    { x: box!.x + box!.width / 2, y: box!.y + box!.height * 0.8 },
    { x: box!.x + box!.width / 2, y: -250 }
  );

  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(20);
});

test('home banner still changes slides with a horizontal swipe', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const carousel = page.locator('[aria-roledescription="carousel"]');
  const box = await carousel.boundingBox();
  expect(box).not.toBeNull();

  await swipe(
    page,
    { x: box!.x + box!.width * 0.85, y: box!.y + box!.height / 2 },
    { x: box!.x + box!.width * 0.15, y: box!.y + box!.height / 2 }
  );

  await expect(carousel).toHaveAttribute('aria-label', /추천 운세 배너 [2-5]\/5/);
});
