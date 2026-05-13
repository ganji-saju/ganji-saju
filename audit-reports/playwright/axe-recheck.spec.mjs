// @ts-check
// P1-6 axe-core re-check on local dev (after token replacement)
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3100';
const ROUTES = [
  '/', '/free', '/pricing', '/saju/new', '/credits',
  '/dialogue', '/tarot/daily', '/zodiac', '/today-fortune', '/membership',
];

const summary = [];

for (const url of ROUTES) {
  test(`axe ${url}`, async ({ page }) => {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(700);
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])
      .analyze();
    const colorContrast = r.violations.find(v => v.id === 'color-contrast');
    summary.push({
      url,
      counts: {
        critical: r.violations.filter(v => v.impact === 'critical').length,
        serious:  r.violations.filter(v => v.impact === 'serious').length,
        moderate: r.violations.filter(v => v.impact === 'moderate').length,
        minor:    r.violations.filter(v => v.impact === 'minor').length,
      },
      colorContrastNodes: colorContrast?.nodes.length ?? 0,
      otherRules: r.violations
        .filter(v => v.id !== 'color-contrast')
        .map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
    });
  });
}

test.afterAll(async () => {
  await fs.writeFile(
    path.resolve('audit-reports/2026-05-13-a11y-after-p1-6.json'),
    JSON.stringify(summary, null, 2)
  );
});
