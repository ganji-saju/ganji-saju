import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildLifetimeReport } from '@/domain/saju/report';
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

test('buildLifetimeReport creates a lifetime-first structure with yearly appendix', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);

  assert.equal(report.targetYear, 2026);
  assert.equal(report.pillars.day, data.pillars.day.ganzi);
  assert.ok(report.cover.oneLineSummary.length > 0);
  assert.ok(report.cover.keywords.length >= 4);
  assert.ok(report.coreIdentity.summary.length > 0);
  assert.ok(report.strengthBalance.balanceGuide.length >= 1);
  assert.ok(report.patternAndYongsin.supportSymbols.length >= 1);
  assert.ok(report.relationshipPattern.summary.length > 0);
  assert.ok(report.wealthStyle.summary.length > 0);
  assert.ok(report.careerDirection.summary.length > 0);
  assert.ok(report.healthRhythm.habitPoints.length >= 1);
  assert.ok(report.majorLuckTimeline.cycles.length >= 1);
  assert.equal(report.lifetimeStrategy.rememberRules.length, 5);
  assert.equal(report.yearlyAppendix.year, 2026);
  assert.ok(report.yearlyAppendix.goodPeriods.length >= 1);
  assert.ok(report.yearlyAppendix.ctaAnchor === '#yearly-report');
});

test('buildLifetimeReport marks a current major-luck cycle when available', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);

  assert.ok(
    report.majorLuckTimeline.cycles.some((cycle) => cycle.isCurrent) ||
      report.majorLuckTimeline.cycles[0]?.ganzi === '대운 미산정'
  );
});

test('buildLifetimeReport gives major-luck cycles distinct readings by ganzi', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026);
  const cycles = report.majorLuckTimeline.cycles.filter((cycle) => cycle.ganzi !== '대운 미산정');

  assert.ok(cycles.length >= 4);
  assert.ok(new Set(cycles.map((cycle) => cycle.phase)).size >= 3);
  assert.ok(new Set(cycles.map((cycle) => cycle.task)).size >= 4);
  assert.doesNotMatch(
    cycles.map((cycle) => cycle.task).join('\n'),
    /정리와 재배치, 역할 조정, 관계 정돈을 미루지 않는 것/
  );
});
