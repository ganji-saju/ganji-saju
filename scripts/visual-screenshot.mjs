#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_ROUTES = [
  '/',
  '/saju/new',
  '/saju/personality',
  '/compatibility',
  '/compatibility/personality',
  '/today-fortune',
  '/tarot/daily',
  '/zodiac',
  '/star-sign',
  '/dialogue',
  '/my',
  '/pricing',
  '/membership',
  '/credits',
];

const DEFAULT_BREAKPOINTS = [
  { label: '360x800', width: 360, height: 800 },
  { label: '390x844', width: 390, height: 844 },
  { label: '430x932', width: 430, height: 932 },
  { label: '768x1024', width: 768, height: 1024 },
  { label: '1024x768', width: 1024, height: 768 },
  { label: '1280x900', width: 1280, height: 900 },
  { label: '1440x1000', width: 1440, height: 1000 },
];

const CHROME_CANDIDATES = [
  process.env.VISUAL_QA_CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean);

function parseArgs(argv) {
  const args = {};

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...valueParts] = arg.slice(2).split('=');
    args[key] = valueParts.length > 0 ? valueParts.join('=') : 'true';
  }

  return args;
}

function parseRoutes(value) {
  if (!value) return DEFAULT_ROUTES;
  return value
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith('/') ? route : `/${route}`));
}

function parseBreakpoints(value) {
  if (!value) return DEFAULT_BREAKPOINTS;

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(\d+)x(\d+)$/);
      if (!match) throw new Error(`Invalid breakpoint "${item}". Use WIDTHxHEIGHT, e.g. 390x844.`);

      return {
        label: item,
        width: Number(match[1]),
        height: Number(match[2]),
      };
    });
}

function normalizeBaseUrl(value) {
  const baseUrl = value || process.env.VISUAL_QA_BASE_URL || process.env.PREVIEW_URL || 'http://localhost:3000';
  return baseUrl.replace(/\/+$/, '');
}

function routeToSlug(route) {
  if (route === '/') return 'home';
  return route
    .replace(/^\//, '')
    .replace(/[/?#=&:]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toUrl(baseUrl, route) {
  if (/^https?:\/\//.test(route)) return route;
  return `${baseUrl}${route}`;
}

async function assertBaseUrlReachable(baseUrl) {
  try {
    const response = await fetch(baseUrl, { method: 'HEAD' });
    if (response.status >= 500) {
      throw new Error(`Base URL returned ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `Cannot reach ${baseUrl}. Start the app first, e.g. npm run dev, or pass --base-url=https://preview.example. ${error.message}`
    );
  }
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

async function commandExists(command) {
  if (command.includes('/')) return existsSync(command);

  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    if (await commandExists(candidate)) return candidate;
  }

  return null;
}

async function captureWithPlaywright({ playwright, baseUrl, routes, breakpoints, outDir }) {
  const browser = await playwright.chromium.launch();
  const results = [];

  try {
    for (const route of routes) {
      for (const breakpoint of breakpoints) {
        const page = await browser.newPage({
          viewport: { width: breakpoint.width, height: breakpoint.height },
          deviceScaleFactor: 1,
        });
        const url = toUrl(baseUrl, route);
        const routeDir = join(outDir, routeToSlug(route));
        const screenshotPath = join(routeDir, `${breakpoint.label}.png`);

        try {
          await mkdir(routeDir, { recursive: true });
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
          await page.screenshot({ path: screenshotPath, fullPage: true });

          results.push({
            route,
            url,
            breakpoint: breakpoint.label,
            status: response?.status() ?? null,
            ok: !response || response.status() < 500,
            screenshotPath,
            mode: 'playwright-full-page',
          });
        } catch (error) {
          results.push({
            route,
            url,
            breakpoint: breakpoint.label,
            status: null,
            ok: false,
            error: error.message,
            screenshotPath,
            mode: 'playwright-full-page',
          });
        } finally {
          await page.close().catch(() => {});
        }
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

async function captureWithChromeCli({ chromePath, baseUrl, routes, breakpoints, outDir }) {
  const results = [];

  for (const route of routes) {
    for (const breakpoint of breakpoints) {
      const url = toUrl(baseUrl, route);
      const routeDir = join(outDir, routeToSlug(route));
      const screenshotPath = join(routeDir, `${breakpoint.label}.png`);

      try {
        await mkdir(routeDir, { recursive: true });
        await execFileAsync(
          chromePath,
          [
            '--headless=new',
            '--disable-gpu',
            '--hide-scrollbars',
            '--no-first-run',
            '--no-default-browser-check',
            '--run-all-compositor-stages-before-draw',
            '--virtual-time-budget=4000',
            `--window-size=${breakpoint.width},${breakpoint.height}`,
            `--screenshot=${screenshotPath}`,
            url,
          ],
          { timeout: 60_000, maxBuffer: 1024 * 1024 * 4 }
        );

        results.push({
          route,
          url,
          breakpoint: breakpoint.label,
          status: null,
          ok: true,
          screenshotPath,
          mode: 'chrome-headless-viewport',
        });
      } catch (error) {
        results.push({
          route,
          url,
          breakpoint: breakpoint.label,
          status: null,
          ok: false,
          error: error.stderr || error.message,
          screenshotPath,
          mode: 'chrome-headless-viewport',
        });
      }
    }
  }

  return results;
}

function buildMarkdownSummary({ baseUrl, outDir, results, provider }) {
  const failed = results.filter((result) => !result.ok);
  const routeCount = new Set(results.map((result) => result.route)).size;
  const breakpointCount = new Set(results.map((result) => result.breakpoint)).size;

  return [
    '# Visual QA Screenshot Summary',
    '',
    `- Base URL: ${baseUrl}`,
    `- Provider: ${provider}`,
    `- Routes: ${routeCount}`,
    `- Breakpoints: ${breakpointCount}`,
    `- Screenshots: ${outDir}`,
    `- Failed captures: ${failed.length}`,
    '',
    '| Route | Breakpoint | Result | Screenshot |',
    '|---|---|---|---|',
    ...results.map((result) => {
      const status = result.ok ? 'pass' : `fail: ${String(result.error ?? 'unknown').replace(/\n/g, ' ')}`;
      return `| ${result.route} | ${result.breakpoint} | ${status} | ${result.screenshotPath ?? ''} |`;
    }),
    '',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args['base-url']);
  const routes = parseRoutes(args.routes);
  const breakpoints = parseBreakpoints(args.breakpoints);
  const outDir = resolve(args.out || 'artifacts/screenshots');
  const summaryJsonPath = join(outDir, 'visual-qa-summary.json');
  const summaryMarkdownPath = join(outDir, 'visual-qa-summary.md');

  await assertBaseUrlReachable(baseUrl);
  await mkdir(outDir, { recursive: true });

  const playwright = await loadPlaywright();
  const provider = playwright ? 'playwright-full-page' : 'chrome-headless-viewport';
  let results;

  if (playwright) {
    results = await captureWithPlaywright({ playwright, baseUrl, routes, breakpoints, outDir });
  } else {
    const chromePath = await findChrome();
    if (!chromePath) {
      throw new Error(
        'Playwright is not installed and no Chrome/Chromium executable was found. Install devDependency playwright for full-page screenshots, or set VISUAL_QA_CHROME_PATH.'
      );
    }
    results = await captureWithChromeCli({ chromePath, baseUrl, routes, breakpoints, outDir });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    provider,
    outDir,
    routeCount: routes.length,
    breakpointCount: breakpoints.length,
    total: results.length,
    failed: results.filter((result) => !result.ok),
    results,
  };

  await writeFile(summaryJsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(summaryMarkdownPath, buildMarkdownSummary({ baseUrl, outDir, results, provider }));

  const failedCount = summary.failed.length;
  console.log(`Visual QA screenshots complete: ${summary.total - failedCount}/${summary.total} passed`);
  console.log(`Provider: ${provider}`);
  console.log(`Output: ${outDir}`);
  console.log(`Summary: ${summaryMarkdownPath}`);

  if (provider === 'chrome-headless-viewport') {
    console.log('Note: Chrome CLI fallback captures viewport screenshots. Install playwright as a devDependency for fullPage screenshots.');
  }

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
