// @ts-check
// P1-6 잔여 36 nodes 상세 조사 — /tarot/daily, /zodiac, /today-fortune
import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3100';
const ROUTES = ['/tarot/daily', '/zodiac', '/today-fortune'];

const detailed = [];

for (const url of ROUTES) {
  test(`axe-detail ${url}`, async ({ page }) => {
    await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    const r = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const cc = r.violations.find(v => v.id === 'color-contrast');
    if (!cc) {
      detailed.push({ url, nodeCount: 0 });
      return;
    }

    const nodes = cc.nodes.map(n => ({
      target: n.target,
      html: (n.html || '').slice(0, 250),
      failureSummary: (n.failureSummary || '').slice(0, 400),
      // Extract foreground/background from the failure summary
      data: n.any?.[0]?.data ?? null,
    }));

    detailed.push({
      url,
      nodeCount: nodes.length,
      nodes,
    });
  });
}

test.afterAll(async () => {
  await fs.writeFile(
    path.resolve('audit-reports/2026-05-13-a11y-residual-detail.json'),
    JSON.stringify(detailed, null, 2)
  );
});
