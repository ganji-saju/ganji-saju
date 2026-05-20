// 2026-05-20 V2-5 PR Z — 사주 narrative deterministic 본문 톤 audit (LLM 미호출, 비용 0).
//
// 검증 대상:
//   - SajuNarrative.body (build-narrative.ts) 의 한자 / 호명 / 술어 빈도 / 자극 표현 / 결 빈도
//   - LifetimeReport 의 9 챕터 summary (build-lifetime-report.ts) 동일 룰
//
// 사용: node scripts/audit-narrative-tone.mjs
// 결과: stdout + audit-reports/2026-05-20-narrative-tone-audit.md

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const ts = require('typescript');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'src');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveWithProjectAliases(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolveFilename.call(
      this,
      path.join(sourceRoot, request.slice(2)),
      parent,
      isMain,
      options
    );
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions['.ts'] = function loadTypeScriptModule(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { calculateSajuDataV1 } = require('../src/domain/saju/engine/saju-data-v1.ts');
const { buildLifetimeReport } = require('../src/domain/saju/report/index.ts');
const { buildSajuNarrative } = require('../src/domain/saju/report/build-narrative.ts');
const { buildSajuPersonalizationContext } = require('../src/domain/saju/report/personalization-context.ts');
const { validateChapterBody } = require('../src/lib/saju/chapter-validator.ts');
// PR Y (#296) 의 plain-translate.ts 는 별도 branch — audit 은 MYEONGRI_KEY_TERMS hard-coded.

const CASES = [
  { id: 'A', birth: { year: 1996, month: 6, day: 1, hour: 6, minute: 30, gender: 'male' }, name: '검증A' },
  { id: 'B', birth: { year: 1990, month: 3, day: 15, hour: 14, minute: 0, gender: 'female' }, name: '검증B' },
  { id: 'C', birth: { year: 1985, month: 7, day: 22, hour: 10, minute: 30, gender: 'male' }, name: '검증C' },
];

const HANJA_PATTERN = /[一-鿿]/g;
const FORBIDDEN_STIMULI = /대박|비책|암흑기|텅장|꿀팁|반드시|절대|확실히|역대급|평생 후회|폭발할|망설일 시간/g;
const GYEOL_PATTERN =
  /결(?:(?:이|가|을|를|은|는|의|에|와|과|도|만|로|라|들|에서|에는|에도|에만|이라|이라는|이다|입니다)(?=[\s.,!?。、]|$|[^가-힣])|(?=[\s.,!?。、]|$|[^가-힣]))/gu;

function countMyeongriTerms(body, terms) {
  let count = 0;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![가-힣])${escaped}(?![가-힣])`, 'gu');
    const matches = body.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}

const MYEONGRI_KEY_TERMS = [
  '신강', '신약', '중화',
  '대운', '세운', '월운', '일진',
  '정관격', '편관격', '정재격', '편재격', '식신격', '상관격', '정인격', '편인격', '비견격', '건록격',
  '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
  '양인살', '역마살', '도화살', '화개살', '백호살', '괴강살',
  '원진',
];

function auditBody(body, name) {
  const hanja = (body.match(HANJA_PATTERN) ?? []).length;
  const nameHits = (body.match(new RegExp(`${name}님?`, 'g')) ?? []).length;
  const stimuli = (body.match(FORBIDDEN_STIMULI) ?? []).length;
  const gyeol = (body.match(GYEOL_PATTERN) ?? []).length;
  const myeongri = countMyeongriTerms(body, MYEONGRI_KEY_TERMS);
  const sentences = body.split(/(?<=[.?!])\s+|\n+/u).map((s) => s.trim()).filter(Boolean);
  const longSentence = sentences.find((s) => s.replace(/[.?!]+$/u, '').length > 65);
  const validation = validateChapterBody(body, {
    skipRules: ['sentence-length', 'gyeol-frequency', 'vague-comfort', 'myeongri-jargon-repetition'],
  });
  return {
    length: body.length,
    sentenceCount: sentences.length,
    hanja,
    nameHits,
    stimuli,
    gyeol,
    myeongri,
    longSentence: longSentence?.slice(0, 60) ?? null,
    validatorPassed: validation.passed,
    validatorFailures: validation.failures.map((f) => f.rule),
  };
}

function auditCase(testCase) {
  const sajuData = calculateSajuDataV1(testCase.birth);
  const personalization = buildSajuPersonalizationContext(sajuData);
  const narrative = buildSajuNarrative(sajuData, personalization, { userName: testCase.name });
  const lifetime = buildLifetimeReport(testCase.birth, sajuData, 2026);

  const sections = {
    narrative: narrative.body,
    coreIdentity: lifetime.coreIdentity.summary,
    strengthBalance: lifetime.strengthBalance.summary,
    patternAndYongsin: lifetime.patternAndYongsin.summary,
    relationshipPattern: lifetime.relationshipPattern.summary,
    wealthStyle: lifetime.wealthStyle.summary,
    careerDirection: lifetime.careerDirection.summary,
    healthRhythm: lifetime.healthRhythm.summary,
    lifetimeStrategy: lifetime.lifetimeStrategy.summary,
  };

  const auditMap = {};
  for (const [key, body] of Object.entries(sections)) {
    auditMap[key] = auditBody(body, testCase.name);
  }
  return { caseId: testCase.id, auditMap, narrative, lifetime };
}

function main() {
  const results = CASES.map(auditCase);

  const lines = [
    '# 사주 narrative deterministic 톤 audit (2026-05-20)',
    '',
    '**대상**: SajuNarrative.body + LifetimeReport 9챕터 summary (LLM 미적용 / fallback 본문).',
    '**검증 룰**: 한자 0건 / 호명 0~1회 / 자극 표현 0건 / "결" 5회 이내 / 명리 술어 1회 max / 문장 65자 이내.',
    '',
  ];

  for (const r of results) {
    lines.push(`## 케이스 ${r.caseId}`, '');
    lines.push('| 영역 | 길이 | 문장 | 한자 | 호명 | 자극 | "결" | 술어 | >65자 | 4룰 통과 |');
    lines.push('|------|-----|-----|-----|------|------|-----|-----|------|---------|');
    for (const [key, audit] of Object.entries(r.auditMap)) {
      const longMark = audit.longSentence ? '⚠️' : '✅';
      const passMark = audit.validatorPassed ? '✅' : `❌(${audit.validatorFailures.join(',')})`;
      lines.push(
        `| ${key} | ${audit.length} | ${audit.sentenceCount} | ${audit.hanja} | ${audit.nameHits} | ${audit.stimuli} | ${audit.gyeol} | ${audit.myeongri} | ${longMark} | ${passMark} |`
      );
    }
    lines.push('');
  }

  // 케이스별 미흡 영역 종합
  lines.push('## 미흡 영역 종합 (한자/술어/장문 > 권장 기준)', '');
  for (const r of results) {
    for (const [key, audit] of Object.entries(r.auditMap)) {
      const issues = [];
      if (audit.hanja > 0) issues.push(`한자 ${audit.hanja}건`);
      if (audit.nameHits > 1) issues.push(`호명 ${audit.nameHits}회`);
      if (audit.stimuli > 0) issues.push(`자극 ${audit.stimuli}건`);
      if (audit.gyeol > 5) issues.push(`"결" ${audit.gyeol}회`);
      if (audit.myeongri > 2) issues.push(`술어 ${audit.myeongri}개`);
      if (audit.longSentence) issues.push(`장문(>65자)`);
      if (issues.length > 0) {
        lines.push(`- 케이스 ${r.caseId} · ${key} — ${issues.join(' / ')}`);
      }
    }
  }

  // 본문 인용
  lines.push('', '## 본문 인용 (케이스 A)', '');
  const a = results[0];
  for (const [key, body] of Object.entries({
    narrative: a.narrative.body,
    coreIdentity: a.lifetime.coreIdentity.summary,
    strengthBalance: a.lifetime.strengthBalance.summary,
    patternAndYongsin: a.lifetime.patternAndYongsin.summary,
    wealthStyle: a.lifetime.wealthStyle.summary,
    careerDirection: a.lifetime.careerDirection.summary,
    healthRhythm: a.lifetime.healthRhythm.summary,
    lifetimeStrategy: a.lifetime.lifetimeStrategy.summary,
  })) {
    lines.push(`### ${key}`);
    lines.push(body);
    lines.push('');
  }

  const output = lines.join('\n');
  console.log(output);

  const outPath = path.join(projectRoot, 'audit-reports/2026-05-20-narrative-tone-audit.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output, 'utf-8');
  console.log(`\n결과 저장: ${outPath}`);
}

main();
