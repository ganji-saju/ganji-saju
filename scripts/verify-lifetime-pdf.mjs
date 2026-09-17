/** Offline PDF regression: synthetic people only; no database, login, or paid AI calls. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, parent, isMain, options);
};
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
      compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    module._compile(output.outputText, filename);
  };
}
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('@playwright/test');
const { loadSajuDataV2 } = require('../src/domain/saju/engine/saju-data-v2-upgrade');
const { buildLifetimeReport, buildSajuReport, buildSajuInterpretationGrounding } = require('../src/domain/saju/report');
const { buildFallbackLifetimeInterpretation } = require('../src/server/ai/saju-lifetime-interpretation');
const { ReportDocument } = require('../src/components/report/report-document');
const { buildPdfModel } = require('../src/lib/saju/pdf-report-model');
const outputDir = path.join(root, '.codex-run/pdf-verification');
fs.mkdirSync(outputDir, { recursive: true });
const font = fs.readFileSync(path.join(root, 'src/app/fonts/PretendardVariable.woff2')).toString('base64');
const css = ['tokens.css', 'responsive-print.css'].map((file) => fs.readFileSync(path.join(root, 'src/app/styles', file), 'utf8')).join('\n');
const fixtures = [
  { name: '김하늘 · 샘플', year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: 'male' },
  { name: '어린이 · 생시 모름 샘플', year: 2020, month: 2, day: 29, gender: 'female', unknownTime: true },
  { name: '긴 본문 · 샘플', year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' },
];
const browser = await chromium.launch({ headless: true });
const summaries = [];
try {
  for (const [index, input] of fixtures.entries()) {
    const sajuData = loadSajuDataV2(input, null, { now: '2026-09-17T03:00:00.000Z' });
    const grounding = buildSajuInterpretationGrounding(input, sajuData, buildSajuReport(input, sajuData, 'today'));
    const reading = { id: `pdf-fixture-${index}`, userId: null, input, sajuData, grounding, metadata: { displayName: input.name } };
    const report = buildLifetimeReport(input, sajuData, 2026);
    const interpretation = buildFallbackLifetimeInterpretation(report);
    if (index === 2) {
      for (const key of Object.keys(interpretation.sections)) interpretation.sections[key] = '기존 풀이가 길어져도 생략 없이 이어지는 페이지에 보존되어야 합니다. '.repeat(40);
      interpretation.opening = '전체 본문의 분량이 늘어나는 경우에도 페이지 넘김과 한글 표시를 확인합니다. '.repeat(25);
    }
    const data = buildPdfModel(reading, report, `SAMPLE-${index + 1}`, 2026, interpretation);
    const article = renderToStaticMarkup(React.createElement(ReportDocument, { data, issuedAt: '2026.09.17', showRecommendations: false }));
    // Real admin ancestor structure exercises the print isolation selectors too.
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
      @font-face{font-family:ReportPretendard;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
      *{box-sizing:border-box}body{margin:0} :root{--font-body:ReportPretendard,sans-serif}
      ${css}
      </style></head><body><div class="analytics-consent-banner">COOKIE_CONSENT_SHOULD_NOT_PRINT 동의 · 거부</div><div class="admin-shell"><aside>ADMIN_NAV_SHOULD_NOT_PRINT</aside><div><div>ADMIN_TABS_SHOULD_NOT_PRINT</div><main class="external-report-workspace"><header>ADMIN_HEADER_SHOULD_NOT_PRINT</header><div class="external-report-controls">ADMIN_FORM_SHOULD_NOT_PRINT</div><div class="external-report-preview">${article}</div></main></div></div></body></html>`;
    fs.writeFileSync(path.join(outputDir, `sample-${index + 1}.html`), html);
    const page = await browser.newPage({ viewport: { width: index === 1 ? 390 : 1000, height: 1300 } });
    await page.setContent(html, { waitUntil: 'load' });
    assert.ok(await page.locator('.analytics-consent-banner').isVisible(), 'Consent banner must remain visible on screen');
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    assert.ok((await page.locator('.rp-subject-title').textContent()).includes(input.name), 'Buyer name missing from the cover');
    const metrics = await page.evaluate(() => ({
      pages: [...document.querySelectorAll('.report-page')].map((element) => ({ number: Number(element.getAttribute('data-page')), height: element.getBoundingClientRect().height, width: element.getBoundingClientRect().width, text: element.textContent.length })),
      years: [...document.querySelectorAll('[data-year]')].map((el) => Number(el.getAttribute('data-year'))),
      controlsHidden: [...document.querySelectorAll('.external-report-controls,.external-report-workspace > header,.admin-shell > aside')].every((el) => getComputedStyle(el).display === 'none'),
      horizontalOverflow: [...document.querySelectorAll('.report-page')].some((el) => el.scrollWidth > el.clientWidth + 1),
      consentHidden: getComputedStyle(document.querySelector('.analytics-consent-banner')).display === 'none',
      watermarks: [...document.querySelectorAll('.report-page')].map((el) => {
        const style = getComputedStyle(el, '::after');
        return { content: style.content, opacity: style.opacity, top: parseFloat(style.top), width: parseFloat(style.width), pageWidth: el.getBoundingClientRect().width, zIndex: Number(style.zIndex) };
      }),
    }));
    assert.deepEqual(metrics.years, Array.from({ length: 101 }, (_, age) => input.year + age));
    assert.ok(metrics.pages.length >= 30);
    assert.deepEqual(metrics.pages.map((item) => item.number), Array.from({ length: metrics.pages.length }, (_, i) => i + 1));
    assert.ok(metrics.controlsHidden, 'Admin controls leaked into print');
    assert.ok(metrics.consentHidden, 'Cookie consent banner leaked into print');
    for (const watermark of metrics.watermarks) {
      assert.ok(watermark.content.includes('간지사주'), 'A report page has no brand watermark');
      assert.equal(watermark.opacity, '0.1', 'Watermark must use 10% opacity');
      assert.ok(Math.abs(watermark.top - 297 / 25.4 * 96 / 2) < 1, 'Watermark is not at the A4 vertical center');
      assert.ok(Math.abs(watermark.width - watermark.pageWidth) < 1 && watermark.zIndex > 1, 'Watermark must span the page above opaque cards');
    }
    assert.equal(metrics.horizontalOverflow, false, 'Report overflows horizontally');
    const tooTall = metrics.pages.filter((item) => item.height > 1122.6); // A4 at Chromium 96dpi.
    assert.deepEqual(tooTall, [], `A report sheet exceeds A4: ${JSON.stringify(tooTall)}`);
    const pdfPath = path.join(outputDir, `sample-${index + 1}.pdf`);
    const pdfBytes = await page.pdf({ path: pdfPath, format: 'A4', printBackground: index !== 1, preferCSSPageSize: true });
    // Chromium/Skia writes page dictionaries outside compressed streams.
    const physicalPages = (pdfBytes.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    assert.equal(physicalPages, metrics.pages.length, 'Physical PDF pagination differs from the printed contents');
    if (index === 0) {
      for (const [name, selector] of [['cover', '[data-page="1"]'], ['guide', '[data-page="7"]'], ['cycle', '.rp-cycle-page'], ['annual', '.rp-annual-page']]) {
        await page.locator(selector).first().screenshot({ path: path.join(outputDir, `${name}.png`) });
      }
    }
    summaries.push({ fixture: index + 1, pages: physicalPages, maxHeightPx: Math.max(...metrics.pages.map((item) => item.height)), pdfPath });
    await page.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(outputDir, 'verification.json'), JSON.stringify(summaries, null, 2));
console.log(JSON.stringify(summaries, null, 2));
