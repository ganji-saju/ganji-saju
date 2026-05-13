// @ts-check
// Capture 60 screenshots: 10 routes × 6 viewports
// Run: npx playwright test --config=audit-reports/playwright/screenshot.config.mjs

import { test } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://www.xn--s39at50bo6fmwa.kr';

const ROUTES = [
  { name: 'home',          path: '/' },
  { name: 'free',          path: '/free' },
  { name: 'pricing',       path: '/pricing' },
  { name: 'saju-new',      path: '/saju/new' },
  { name: 'credits',       path: '/credits' },
  { name: 'dialogue',      path: '/dialogue' },
  { name: 'tarot-daily',   path: '/tarot/daily' },
  { name: 'zodiac',        path: '/zodiac' },
  { name: 'today-fortune', path: '/today-fortune' },
  { name: 'membership',    path: '/membership' },
];

const VIEWPORTS = [
  { name: '360x740',   w: 360,  h: 740,  isMobile: true,  dpr: 2 },
  { name: '390x844',   w: 390,  h: 844,  isMobile: true,  dpr: 2 },
  { name: '430x932',   w: 430,  h: 932,  isMobile: true,  dpr: 2 },
  { name: '768x1024',  w: 768,  h: 1024, isMobile: false, dpr: 1 },
  { name: '1024x768',  w: 1024, h: 768,  isMobile: false, dpr: 1 },
  { name: '1440x1100', w: 1440, h: 1100, isMobile: false, dpr: 1 },
];

const dir = path.resolve('audit-reports/screenshots');

test.beforeAll(async () => {
  await fs.mkdir(dir, { recursive: true });
});

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    test(`${route.name} @ ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: vp.dpr,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        userAgent: vp.isMobile
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
          : undefined,
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(700);
      await page.screenshot({
        path: path.join(dir, `${route.name}-${vp.name}.png`),
        fullPage: true,
      });
      await ctx.close();
    });
  }
}
