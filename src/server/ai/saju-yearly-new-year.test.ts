import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildYearlyReport } from '@/domain/saju/report';
import type { BirthInput } from '@/lib/saju/types';
import {
  buildFallbackNewYearExtras,
  createYearlyInterpretationPrompt,
  parseNewYearExtrasText,
} from './saju-yearly-interpretation';
import type { ReadingRecord } from '@/lib/saju/readings';

declare const test: (name: string, fn: () => void) => void;

// 2026-09-26 — 2027 신년운세 부가 필드(가족·학업·분기·기대/조심). 신년운세·평생 구매자에게만 나간다(티어는 route).
const birthInput: BirthInput = { year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' };
const sajuData = normalizeToSajuDataV1(birthInput, null);
const report = buildYearlyReport(birthInput, sajuData, 2027);
const fallback = buildFallbackNewYearExtras(report);

test('new-year 폴백: 분기 4개가 1~12월을 3개씩 덮고 비지 않는다', () => {
  assert.deepEqual(fallback.quarterlyFlows.map((q) => q.months), [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]]);
  assert.ok(fallback.quarterlyFlows.every((q) => q.summary.length > 10));
});

test('new-year 폴백: 가족·학업 본문이 있고 기대/조심은 3개 이상에 월·분야가 붙는다', () => {
  assert.ok(fallback.categories.family.length > 20);
  assert.ok(fallback.categories.study.length > 20);
  for (const list of [fallback.expectations, fallback.cautions]) {
    assert.ok(list.length >= 3, JSON.stringify(list));
    assert.ok(list.every((h) => h.month >= 1 && h.month <= 12 && h.category && h.text.length > 5));
  }
});

test('new-year 폴백 문구에 단정·공포 표현이 없다', () => {
  assert.doesNotMatch(JSON.stringify(fallback), /반드시|무조건|100%|큰 병|사고가 난다/);
});

test('new-year 파서: 월 없는 기대 항목·분기 누락 응답은 폴백', () => {
  const bad = JSON.stringify({
    categories: { family: '가족 문단입니다.', study: '학업 문단입니다.' },
    quarterlyFlows: [{ quarter: 1, summary: '1분기' }],
    expectations: [{ category: 'wealth', text: '월이 없다' }],
    cautions: [],
  });
  const r = parseNewYearExtrasText(bad, fallback);
  assert.equal(r.ok, false);
  assert.deepEqual(r.extras, fallback);
});

test('new-year 파서: 정상 응답을 받아들이고 분기 월을 채운다', () => {
  const good = {
    categories: { family: '가족 문단입니다.', study: '학업 문단입니다.' },
    quarterlyFlows: [1, 2, 3, 4].map((q) => ({ quarter: q, summary: `${q}분기 요약입니다.`, focusCategory: 'wealth' })),
    expectations: [3, 5, 9].map((m) => ({ month: m, category: 'family', text: `${m}월 기대할 일` })),
    cautions: [2, 7, 11].map((m) => ({ month: m, category: 'health', text: `${m}월 조심할 일` })),
  };
  const r = parseNewYearExtrasText(JSON.stringify(good), fallback);
  assert.equal(r.ok, true);
  assert.deepEqual(r.extras.quarterlyFlows[1].months, [4, 5, 6]);
  assert.equal(r.extras.expectations[0].category, 'family');
});

test('new-year 프롬프트: 부가 필드만 요구하고 월·분야를 강제한다', () => {
  const record = { input: birthInput, sajuData, grounding: { personalizationContext: null, factJson: null, evidenceJson: null }, kasiComparison: null } as unknown as ReadingRecord;
  const prompt = createYearlyInterpretationPrompt(record, report, 'female', 'newyear');
  assert.match(prompt.instructions, /quarterlyFlows/);
  assert.match(prompt.instructions, /month\(1~12\)/);
  assert.doesNotMatch(prompt.instructions, /"monthlyFlows":\[\{"month":1,"summary"/);
});

test('new-year 파서: 분기는 멀쩡해도 월 없는 기대 항목만 오면 폴백(월·분야 필수)', () => {
  const almost = JSON.stringify({
    categories: { family: '가족 문단입니다.', study: '학업 문단입니다.' },
    quarterlyFlows: [1, 2, 3, 4].map((q) => ({ quarter: q, summary: `${q}분기 요약입니다.` })),
    expectations: [{ category: 'wealth', text: '월이 없다' }, { month: 13, category: 'wealth', text: '범위 밖' }, { month: 3, category: 'luck', text: '없는 분야' }],
    cautions: [2, 7, 11].map((m) => ({ month: m, category: 'health', text: `${m}월 조심할 일` })),
  });
  assert.equal(parseNewYearExtrasText(almost, fallback).ok, false);
});

// 2026-09-26 리뷰 — LLM 부가 문구에 단정·공포 표현이 있으면 폴백(버전 미기록 → 다음 열람에 재시도).
test('new-year 파서: 단정·공포 표현이 들어간 응답은 폴백, 평범한 "조심" 은 통과', () => {
  const base = {
    categories: { family: '가족 문단입니다.', study: '학업 문단입니다.' },
    quarterlyFlows: [1, 2, 3, 4].map((q) => ({ quarter: q, summary: `${q}분기 요약입니다.` })),
    expectations: [3, 5, 9].map((m) => ({ month: m, category: 'wealth', text: `${m}월 기대할 일` })),
    cautions: [2, 7, 11].map((m) => ({ month: m, category: 'health', text: `${m}월에는 수면 리듬을 조심하세요` })),
  };
  assert.equal(parseNewYearExtrasText(JSON.stringify(base), fallback).ok, true);
  for (const bad of ['반드시 이혼하게 됩니다', '무조건 합격합니다', '100% 돈이 들어옵니다', '큰 병이 찾아옵니다']) {
    const withBad = { ...base, cautions: [{ month: 4, category: 'health', text: bad }, ...base.cautions] };
    assert.equal(parseNewYearExtrasText(JSON.stringify(withBad), fallback).ok, false, bad);
  }
});
