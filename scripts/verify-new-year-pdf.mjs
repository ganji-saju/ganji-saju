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
const { buildLifetimeReport, buildYearlyReport, buildSajuReport, buildSajuInterpretationGrounding } = require('../src/domain/saju/report');
const { buildFallbackYearlyInterpretation, buildFallbackNewYearExtras } = require('../src/server/ai/saju-yearly-interpretation');
const { NewYearReportDocument } = require('../src/components/report/new-year-report-document');
const { buildPdfModel } = require('../src/lib/saju/pdf-report-model');
/** Offline 2027 신년운세 PDF 회귀(2026-09-27): 가짜 인물·폴백 풀이만 — DB·로그인·유료 AI 호출 없음. */
const outputDir = path.join(root, '.codex-run/new-year-pdf');
fs.mkdirSync(outputDir, { recursive: true });
const font = fs.readFileSync(path.join(root, 'src/app/fonts/PretendardVariable.woff2')).toString('base64');
const css = ['tokens.css', 'responsive-print.css'].map((file) => fs.readFileSync(path.join(root, 'src/app/styles', file), 'utf8')).join('\n');
const fixtures = [
  { name: '김하늘 · 샘플', year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: 'male' },
  { name: '생시 모름 샘플', year: 1985, month: 11, day: 3, gender: 'female', unknownTime: true },
];
const browser = await chromium.launch({ headless: true });
const summaries = [];
try {
  for (const [index, input] of fixtures.entries()) {
    const sajuData = loadSajuDataV2(input, null, { now: '2026-09-27T03:00:00.000Z' });
    const grounding = buildSajuInterpretationGrounding(input, sajuData, buildSajuReport(input, sajuData, 'today'));
    const reading = { id: `ny-fixture-${index}`, userId: null, input, sajuData, grounding, metadata: { displayName: input.name } };
    const report = buildYearlyReport(input, sajuData, 2027);
    const interpretation = { ...buildFallbackYearlyInterpretation(report), newYear: buildFallbackNewYearExtras(report) };
    if (index === 1) {
      // 길어진 AI 풀이도 A4 를 넘치지 않고 다음 쪽으로 흘러야 한다.
      interpretation.opening = '한 해의 흐름을 길게 풀어 쓴 문장입니다. '.repeat(60);
      for (const key of Object.keys(interpretation.categories)) interpretation.categories[key] = '분야 풀이가 길어진 경우를 가정한 문장입니다. '.repeat(25);
    }
    const data = buildPdfModel(reading, buildLifetimeReport(input, sajuData, 2027), `GS-NY27-${index}`, 2027);
    const article = renderToStaticMarkup(React.createElement(NewYearReportDocument, { data, report, interpretation, issuedAt: '2026.09.27', year: 2027 }));
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
      @font-face{font-family:ReportPretendard;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
      *{box-sizing:border-box}body{margin:0} :root{--font-body:ReportPretendard,sans-serif}
      ${css}
      </style></head><body><div class="pdf-report-page-wrap">${article}</div></body></html>`;
    fs.writeFileSync(path.join(outputDir, `sample-${index + 1}.html`), html);
    const page = await browser.newPage({ viewport: { width: 1000, height: 1300 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => ({
      pages: [...document.querySelectorAll('.report-page')].map((el) => ({ number: Number(el.getAttribute('data-page')), height: el.getBoundingClientRect().height })),
      hanjaInBody: [...document.querySelectorAll('.rp-deep-sec, .rp-summary p, .rp-card p')].some((el) => /丁未/.test(el.textContent)),
      horizontalOverflow: [...document.querySelectorAll('.report-page')].some((el) => el.scrollWidth > el.clientWidth + 1),
    }));
    assert.deepEqual(metrics.pages.map((p) => p.number), Array.from({ length: metrics.pages.length }, (_, i) => i + 1), 'page numbers must be sequential');
    const tooTall = metrics.pages.filter((p) => p.height > 1122.6);
    assert.deepEqual(tooTall, [], `A new-year sheet exceeds A4: ${JSON.stringify(tooTall)}`);
    assert.equal(metrics.horizontalOverflow, false, 'overflows horizontally');
    assert.equal(metrics.hanjaInBody, false, 'year ganji hanja left in body copy');
    const pdfBytes = await page.pdf({ path: path.join(outputDir, `sample-${index + 1}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
    const physicalPages = (pdfBytes.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;
    assert.equal(physicalPages, metrics.pages.length, 'physical PDF pages differ from report pages');
    if (index === 0) {
      for (const p of metrics.pages) await page.locator(`[data-page="${p.number}"]`).screenshot({ path: path.join(outputDir, `page-${p.number}.png`) });
    }
    summaries.push({ fixture: index + 1, pages: physicalPages, heights: metrics.pages.map((p) => Math.round(p.height)) });
    await page.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(summaries, null, 2));
