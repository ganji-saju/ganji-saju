import { expect, test, type Page, type TestInfo } from '@playwright/test';

const SYSTEM_GUIDE_STORAGE_KEY = 'ganji-saju:system-guide:v1';
const SYSTEM_GUIDE_INIT_MARKER = 'e2e:system-guide:init:v1';
const KAKAO_GALAXY_S25_UA =
  'Mozilla/5.0 (Linux; Android 15; SM-S931N) AppleWebKit/537.36 Mobile Safari/537.36 KAKAOTALK';

function isAuthGuideProject(testInfo: TestInfo) {
  return testInfo.project.name === 'chromium-auth-guide';
}

async function openGuideManually(page: Page) {
  await page.goto('/guide');
  await page.getByRole('button', { name: '처음부터 안내 보기' }).click();
  return expectCurrentStepDialog(page);
}

async function expectCurrentStepDialog(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute('aria-labelledby', 'system-guide-title');
  const currentStepTitle = dialog.locator('#system-guide-title');
  await expect(currentStepTitle).toHaveCount(1);
  await expect(currentStepTitle).toBeVisible();
  await expect(currentStepTitle).toHaveAttribute('id', 'system-guide-title');
  expect(await currentStepTitle.evaluate((element) => element.tagName)).toBe('H2');
  return dialog;
}

async function swipeUpInside(page: Page, target: ReturnType<Page['locator']>) {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const fromY = box!.y + box!.height * 0.8;
  const toY = box!.y + box!.height * 0.2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y: fromY }],
  });
  for (let step = 1; step <= 8; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: fromY + ((toY - fromY) * step) / 8 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('public system guide', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(isAuthGuideProject(testInfo), '인증 project는 자동 실행 시나리오만 검증');
  });

  test('guide page opens the six-step walkthrough manually', async ({ page }) => {
    await page.goto('/guide');
    await expect(page.getByRole('heading', { name: '사용방법' })).toBeVisible();
    await page.getByRole('button', { name: '처음부터 안내 보기' }).click();
    await expectCurrentStepDialog(page);
  });

  test('desktop walkthrough keeps its natural height without mobile clipping', async ({ page }) => {
    const dialog = await openGuideManually(page);
    const article = dialog.locator('article');
    await expect(dialog).toBeVisible();
    const dimensions = await article.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.clientHeight).toBeGreaterThan(384);
    expect(dimensions.scrollHeight).toBe(dimensions.clientHeight);
  });

  test('mobile menu links to the guide page', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click();
    const menu = page.getByRole('dialog', { name: '전체 메뉴' });
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: '사용방법' }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole('heading', { name: '사용방법' })).toBeVisible();
  });
});

test.describe('Galaxy S25 Kakao in-app browser', () => {
  test.use({
    viewport: { width: 360, height: 780 },
    hasTouch: true,
    isMobile: true,
    userAgent: KAKAO_GALAXY_S25_UA,
  });

  test.beforeEach(async ({}, testInfo) => {
    test.skip(isAuthGuideProject(testInfo), '인증 project는 자동 실행 시나리오만 검증');
  });

  test('walkthrough remains usable, scrollable, and persistent across reload', async ({ page }) => {
    const dialog = await openGuideManually(page);
    await expect(dialog).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(360);
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(780);

    const article = dialog.locator('article');
    for (let step = 1; step < 6; step += 1) {
      await dialog.getByRole('button', { name: '다음' }).click();
      await expect(dialog).toContainText(`${step + 1} / 6`);
    }
    for (let step = 5; step > 0; step -= 1) {
      await dialog.getByRole('button', { name: '이전' }).click();
      await expect(dialog).toContainText(`${step} / 6`);
    }

    const dimensions = await article.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(dimensions.scrollHeight).toBeGreaterThanOrEqual(dimensions.clientHeight);
    await swipeUpInside(page, article);
    await expect.poll(() => article.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '처음부터 안내 보기' }).click();
    await expectCurrentStepDialog(page);
  });
});

test.describe('authenticated system guide', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!isAuthGuideProject(testInfo), '인증 전용 project에서만 실행');
    test.skip(
      !process.env.E2E_TEST_USER_EMAIL || !process.env.E2E_TEST_USER_PASSWORD,
      'E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD 미설정 — 인증 안내 spec skip',
    );
    await page.addInitScript(
      ({ storageKey, markerKey }) => {
        if (sessionStorage.getItem(markerKey)) return;
        localStorage.removeItem(storageKey);
        sessionStorage.setItem(markerKey, '1');
      },
      { storageKey: SYSTEM_GUIDE_STORAGE_KEY, markerKey: SYSTEM_GUIDE_INIT_MARKER },
    );
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (!isAuthGuideProject(testInfo)) return;
    await page.evaluate(
      ({ storageKey, markerKey }) => {
        localStorage.removeItem(storageKey);
        sessionStorage.removeItem(markerKey);
      },
      { storageKey: SYSTEM_GUIDE_STORAGE_KEY, markerKey: SYSTEM_GUIDE_INIT_MARKER },
    ).catch(() => {});
  });

  test('first authenticated visit auto-opens once and dismissal persists', async ({ page }) => {
    await page.goto('/guide');
    const dialog = await expectCurrentStepDialog(page);
    await dialog.getByRole('button', { name: '닫기', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), SYSTEM_GUIDE_STORAGE_KEY))
      .toContain('dismissed');
    await page.reload();
    await expect(dialog).toHaveCount(0);
  });
});
