// @ts-check
// Audit spec: screenshots + axe-core a11y for 10 public routes × 4 viewports
// Run: npx playwright test audit-reports/playwright/audit.spec.mjs --reporter=list

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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
  { name: 'mobile-360',   width: 360, height: 800,  isMobile: true,  deviceScaleFactor: 2 },
  { name: 'mobile-390',   width: 390, height: 844,  isMobile: true,  deviceScaleFactor: 2 },
  { name: 'tablet-768',   width: 768, height: 1024, isMobile: false, deviceScaleFactor: 1 },
  { name: 'desktop-1280', width: 1280, height: 800, isMobile: false, deviceScaleFactor: 1 },
];

const a11ySummary = [];
const a11yByRoute = {};

const screenshotDir = path.resolve('audit-reports/screenshots');
const a11yJsonPath  = path.resolve('audit-reports/2026-05-13-a11y.json');

test.beforeAll(async () => {
  await fs.mkdir(screenshotDir, { recursive: true });
});

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route.name} @ ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        isMobile: viewport.isMobile,
        hasTouch: viewport.isMobile,
        userAgent: viewport.isMobile
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
          : undefined,
      });
      const page = await context.newPage();

      const startTime = Date.now();
      const response = await page.goto(`${BASE}${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      const loadMs = Date.now() - startTime;

      const status = response?.status() ?? 0;
      const finalUrl = page.url();

      // Wait for any late-mounting content
      await page.waitForTimeout(800);

      const screenshotPath = path.join(
        screenshotDir,
        `2026-05-13-${route.name}-${viewport.name}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // axe-core: run once per route (use mobile-360 sample)
      if (viewport.name === 'mobile-360') {
        try {
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();

          const summary = {
            route: route.name,
            path: route.path,
            url: finalUrl,
            status,
            loadMs,
            viewport: viewport.name,
            violations: results.violations.map(v => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              helpUrl: v.helpUrl,
              nodeCount: v.nodes.length,
              tags: v.tags,
            })),
            counts: {
              total: results.violations.length,
              critical: results.violations.filter(v => v.impact === 'critical').length,
              serious:  results.violations.filter(v => v.impact === 'serious').length,
              moderate: results.violations.filter(v => v.impact === 'moderate').length,
              minor:    results.violations.filter(v => v.impact === 'minor').length,
            },
            passesCount: results.passes.length,
          };
          a11ySummary.push(summary);
          a11yByRoute[route.name] = summary;
        } catch (err) {
          a11ySummary.push({
            route: route.name,
            path: route.path,
            status,
            loadMs,
            error: String(err?.message ?? err),
          });
        }
      }

      await context.close();
    });
  }
}

test.afterAll(async () => {
  await fs.writeFile(
    a11yJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        base: BASE,
        summary: a11ySummary,
        byRoute: a11yByRoute,
      },
      null,
      2
    ),
    'utf-8'
  );
});
