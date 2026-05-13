// @ts-check
// Phase 4 — 5-persona × 10-route entitlement matrix
// Runs against http://localhost:3100 (local dev with TEST Supabase)
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3100';
const PASS = 'AuditP@ss2026!Strong';

// premium reading id seeded in /tmp/ganji-audit-2026-05-13/.env.audit
let PREMIUM_READING_ID = '';
try {
  const env = await fs.readFile('/tmp/ganji-audit-2026-05-13/.env.audit', 'utf-8');
  PREMIUM_READING_ID = env.match(/PREMIUM_READING_ID=(.+)/)?.[1]?.trim() ?? '';
} catch {}

const PERSONAS = [
  { name: 'guest',   email: null },
  { name: 'fresh',   email: 'audit-fresh-20260513@example.com' },
  { name: 'credit',  email: 'audit-credit-20260513@example.com' },
  { name: 'plus',    email: 'audit-plus-20260513@example.com' },
  { name: 'premium', email: 'audit-premium-20260513@example.com' },
];

const ROUTES = [
  { key: 'home',             url: '/' },
  { key: 'free',             url: '/free' },
  { key: 'pricing',          url: '/pricing' },
  { key: 'saju-new',         url: '/saju/new' },
  { key: 'credits',          url: '/credits' },
  { key: 'dialogue',         url: '/dialogue' },
  { key: 'my-results',       url: '/my/results' },
  { key: 'my-billing',       url: '/my/billing' },
  { key: 'membership-co',    url: '/membership/checkout?product=today-detail' },
  { key: 'today-detail',     url: `/saju/${PREMIUM_READING_ID}/today-detail` },
];

const matrix = []; // {persona, route, status, finalPath, signals: {...}}

async function loginPersona(page, email) {
  if (!email) return;
  await page.goto(`${BASE}/login?next=%2F`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASS);
  await page.locator('#login-password').press('Enter');
  // Wait for URL to leave /login (signInWithPassword does client-side redirect)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
}

for (const persona of PERSONAS) {
  test.describe(`persona:${persona.name}`, () => {
    test.describe.configure({ mode: 'serial' });
    test(`login (${persona.name})`, async ({ page, context }) => {
      if (!persona.email) {
        // guest: just go home
        const r = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
        matrix.push({ persona: persona.name, route: '_login', status: r?.status() ?? 0, finalPath: new URL(page.url()).pathname, signals: { login: 'guest-skip' } });
        return;
      }
      await loginPersona(page, persona.email);
      const finalPath = new URL(page.url()).pathname;
      const ok = finalPath !== '/login';
      matrix.push({ persona: persona.name, route: '_login', status: 200, finalPath, signals: { login: ok ? 'success' : 'failed' } });
      // Save storageState for following route tests
      const storagePath = `/tmp/ganji-audit-2026-05-13/state-${persona.name}.json`;
      await context.storageState({ path: storagePath });
    });

    for (const route of ROUTES) {
      test(`${persona.name} @ ${route.key}`, async ({ browser }) => {
        const storagePath = persona.email
          ? `/tmp/ganji-audit-2026-05-13/state-${persona.name}.json`
          : undefined;
        const ctx = await browser.newContext({ storageState: storagePath });
        const page = await ctx.newPage();
        const response = await page.goto(`${BASE}${route.url}`, { waitUntil: 'networkidle', timeout: 15000 });
        const status = response?.status() ?? 0;
        const finalUrl = new URL(page.url());
        const finalPath = finalUrl.pathname + finalUrl.search;

        // Detect lock card / login redirect / content area
        const html = (await page.content()).toLowerCase();
        const signals = {
          hasLockCard: /결제 후 열립니다|550원 결제하고|결제하고 열기|today-detail-lock/.test(html),
          hasLoginRedirect: finalUrl.pathname === '/login',
          hasMembershipCheckoutLogin: html.includes('로그인이 필요') || html.includes('login_required'),
          hasErrorOrEmpty: html.includes('error') && html.length < 5000,
          contentBytes: html.length,
        };

        matrix.push({
          persona: persona.name,
          route: route.key,
          url: route.url,
          status,
          finalPath,
          signals,
        });

        await ctx.close();
      });
    }
  });
}

// open-redirect probe
test('open-redirect probe: /login?next=https://attacker.example', async ({ page }) => {
  const externalTarget = 'https://attacker.example/';
  await page.goto(`${BASE}/login?next=${encodeURIComponent(externalTarget)}`, { waitUntil: 'networkidle' });
  await page.locator('#login-email').fill('audit-fresh-20260513@example.com');
  await page.locator('#login-password').fill(PASS);
  await page.locator('#login-password').press('Enter');
  await page.waitForLoadState('networkidle', { timeout: 15000 });
  const finalUrl = new URL(page.url());
  const externalLeaked = finalUrl.origin !== new URL(BASE).origin;
  matrix.push({
    persona: '_test',
    route: 'open-redirect',
    url: '/login?next=' + externalTarget,
    status: 200,
    finalPath: page.url(),
    signals: {
      externalLeaked,
      finalOrigin: finalUrl.origin,
    },
  });
});

test.afterAll(async () => {
  await fs.writeFile(
    path.resolve('audit-reports/2026-05-13-entitlement-matrix.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, premiumReadingId: PREMIUM_READING_ID, matrix }, null, 2),
    'utf-8'
  );
});
