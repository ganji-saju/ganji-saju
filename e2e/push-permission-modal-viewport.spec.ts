import { expect, test } from '@playwright/test';

test('push permission modal stays inside the mobile viewport after reading scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.addInitScript(() => {
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default' },
    });
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      nativeSetTimeout(handler, timeout && timeout >= 20_000 ? 1_000 : timeout, ...args)) as typeof setTimeout;
  });
  await page.goto('/today-fortune/result?sourceSessionId=e2e&concern=general', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.body.style.minHeight = '2400px';
    window.scrollTo(0, 900);
  });

  const dialog = page.getByRole('dialog', { name: '매일 잠깐, 한 줄로 나만 받기' });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(500);
  const card = dialog.locator('article');
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);

  const portalParent = await dialog.evaluate((element) => element.parentElement?.tagName);
  expect(portalParent).toBe('BODY');
});
