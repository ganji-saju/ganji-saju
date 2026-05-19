import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildYearlyReport, YEARLY_CATEGORY_ORDER } from '@/domain/saju/report';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const birthInput: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  minute: 45,
  gender: 'male',
};

test('buildYearlyReport creates a yearly report with monthly evidence ready for long-form interpretation', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildYearlyReport(birthInput, data, 2026);

  assert.equal(report.year, 2026);
  assert.match(report.yearLabel, /2026년/);
  assert.equal(report.computation.detailLevel, 'monthly-evidence');
  assert.equal(report.computation.monthlyPrecision, 'monthly-ganji');
  assert.equal(report.monthlyFlows.length, 12);
  assert.deepEqual(report.categoryOrder, YEARLY_CATEGORY_ORDER);
  assert.deepEqual(Object.keys(report.categories), YEARLY_CATEGORY_ORDER);
  assert.ok(report.overview.summary.length > 0);
  assert.ok(report.coreKeywords.length >= 3);
  assert.ok(report.firstHalf.relatedMonths.every((month) => month >= 1 && month <= 6));
  assert.ok(report.secondHalf.relatedMonths.every((month) => month >= 7 && month <= 12));
  assert.ok(report.goodPeriods.length > 0);
  assert.ok(report.cautionPeriods.length > 0);
  assert.ok(report.oneLineSummary.length > 0);
  assert.ok(report.evidenceCards.length >= 6);
  assert.ok(report.referenceReports.today.summary.length > 0);
  assert.ok(report.referenceReports.career.score !== null);
});

test('buildYearlyReport fills all 12 months with actual monthly ganji evidence', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildYearlyReport(birthInput, data, 2026);

  assert.deepEqual(
    report.monthlyFlows.map((flow) => flow.month),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  );
  assert.ok(
    report.monthlyFlows.every((flow) => {
      return (
        typeof flow.monthlyGanji === 'string' &&
        flow.monthlyGanji.length > 0 &&
        flow.focusQuestion.length > 0 &&
        flow.summary.length > 0 &&
        flow.opportunity.length > 0 &&
        flow.caution.length > 0 &&
        flow.action.length > 0 &&
        flow.opportunity !== flow.caution &&
        flow.relatedAreas.length >= 2 &&
        flow.basis.some((line) => line.includes('월운:')) &&
        flow.basis.some((line) => line.includes('세운:'))
      );
    })
  );
});

test('buildYearlyReport keeps monthly momentum varied enough for a useful yearly calendar', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildYearlyReport(birthInput, data, 2026);
  const momentumKinds = new Set(report.monthlyFlows.map((flow) => flow.momentum));

  assert.ok(
    momentumKinds.size >= 2,
    'monthly flows should not collapse into one repeated average tone'
  );
  assert.ok(
    report.monthlyFlows.some((flow) => flow.momentum === 'rise'),
    'yearly report should expose at least one month worth pushing'
  );
  assert.ok(
    report.monthlyFlows.some((flow) => flow.momentum === 'caution'),
    'yearly report should expose at least one month worth checking twice'
  );
});

test('buildYearlyReport keeps yearly category opportunity and action distinct for core cards', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildYearlyReport(birthInput, data, 2026);

  for (const key of ['work', 'wealth', 'love', 'relationship'] as const) {
    assert.notEqual(
      report.categories[key].opportunity,
      report.categories[key].action,
      `${key} yearly card should not reuse the same text for opportunity and action`
    );
    assert.ok(
      report.categories[key].summary.length <= 108,
      `${key} yearly summary should stay compact enough for the premium cards`
    );
    assert.ok(
      report.categories[key].action.length <= 96,
      `${key} yearly action should stay compact enough for the premium cards`
    );
  }
});

test('buildYearlyReport actually respects the requested target year', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report2026 = buildYearlyReport(birthInput, data, 2026);
  const report2027 = buildYearlyReport(birthInput, data, 2027);

  assert.notEqual(report2026.year, report2027.year);
  assert.notEqual(report2026.yearLabel, report2027.yearLabel);
  assert.notEqual(
    report2026.referenceReports.today.summary,
    '',
    '2026 report summary should not be empty'
  );
  assert.notEqual(
    report2027.referenceReports.today.summary,
    '',
    '2027 report summary should not be empty'
  );
  assert.notDeepEqual(
    report2026.monthlyFlows.map((flow) => flow.monthlyGanji),
    report2027.monthlyFlows.map((flow) => flow.monthlyGanji),
    'monthly ganji evidence should reflect the requested target year'
  );
});

test('buildYearlyReport marks Peak / Pitfall on 12 monthly flows (PR 5, 2026-05-15)', () => {
  // PR 5: 1년 12개월 중 1개의 peak (첫 rise) + 1개의 pitfall (첫 caution) 마킹.
  // 사주아이 reference 의 Peak/Pitfall 시각 강조용.
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildYearlyReport(birthInput, data, 2026);

  assert.equal(report.monthlyFlows.length, 12);

  const peaks = report.monthlyFlows.filter((flow) => flow.peakKind === 'peak');
  const pitfalls = report.monthlyFlows.filter((flow) => flow.peakKind === 'pitfall');

  // 1) peak 0 또는 1개 (momentum 'rise' 가 없는 사주는 0).
  assert.ok(peaks.length <= 1, `peak 는 최대 1개. got=${peaks.length}`);
  // 2) pitfall 0 또는 1개.
  assert.ok(pitfalls.length <= 1, `pitfall 은 최대 1개. got=${pitfalls.length}`);

  // 3) peak/pitfall 이 있다면 해당 month 의 momentum 와 일치.
  for (const peak of peaks) {
    assert.equal(peak.momentum, 'rise', `peak month 는 momentum=rise 여야 함 (month=${peak.month})`);
  }
  for (const pitfall of pitfalls) {
    assert.equal(
      pitfall.momentum,
      'caution',
      `pitfall month 는 momentum=caution 여야 함 (month=${pitfall.month})`
    );
  }

  // 4) 다른 month 는 peakKind === null (undefined 가 아님 — markPeakAndPitfall 이 명시적으로 null 초기화).
  for (const flow of report.monthlyFlows) {
    if (flow.peakKind === 'peak' || flow.peakKind === 'pitfall') continue;
    assert.equal(flow.peakKind, null, `month=${flow.month} 의 peakKind 는 null 이어야 함`);
  }
});

// 2026-05-19 P0 bugfix invariants (B03, B04)
test('B03/B04 fix: yearly report 본문에 영어 단어·종결문 비문·"내 내" 누적 0건', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildYearlyReport(birthInput, data, 2026);

  // 본문 텍스트 한 묶음으로 모음 — categories.move.summary 안에 'timing' 있던 자리 포함.
  const collected: string[] = [report.oneLineSummary];
  for (const key of YEARLY_CATEGORY_ORDER) {
    const section = report.categories[key];
    collected.push(section.headline, section.summary, section.opportunity, section.caution, section.action);
  }
  const allText = collected.filter(Boolean).join(' ');

  // B03: 본문에 영어 단어 0건 (한자/숫자/percent 는 다른 invariant 에서 다룸)
  const englishWords = allText.match(/\b[a-zA-Z]{2,}\b/g);
  assert.equal(
    englishWords,
    null,
    `yearly 본문에 영어 단어 노출: ${englishWords?.join(', ')}`
  );

  // B04: createOneLineSummary 의 종결문 비문 패턴 0건
  const grammarBugPatterns = [
    /세요과/, /세요를/, /세요와/,
    /[다]과\b/, /[다]를\b/, /[다]와\b/,    // '챙기다과', '필요하다를' 등
    /니다과/, /니다를/, /니다와/,
    /어요과/, /어요를/, /어요와/,
    /해요과/, /해요를/, /해요와/,
  ];
  for (const pattern of grammarBugPatterns) {
    assert.ok(
      !pattern.test(allText),
      `yearly 본문 종결문 비문 패턴 매치: ${pattern} — 발췌 "${allText.match(pattern)?.[0]}"`
    );
  }

  // B01 회귀: "내 내" 같은 누적 치환 0건
  assert.ok(
    !/내\s내/.test(allText),
    `yearly 본문에 "내 내" 누적 치환 발생`
  );
});
