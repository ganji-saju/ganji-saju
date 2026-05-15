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

test('buildLifetimeReport chapterTitle uses 10 카피 패턴 (PR 3, 2026-05-15)', () => {
  // PR 3: chapterTitle 이 이전의 generic placeholder ("…10년의 결을 정리합니다") 가
  // 아니라 10 패턴 중 1개로 선택되어야 함.
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildLifetimeReport(birthInput, data, 2026, {
    relationshipStatus: 'dating',
    occupation: 'self-employed',
    currentConcern: 'business',
  });
  const cycles = report.majorLuckTimeline.cycles.filter((c) => c.ganzi !== '대운 미산정');
  const titles = cycles.map((c) => c.chapterTitle ?? '');

  // 1) generic placeholder 사라졌어야 함.
  assert.ok(
    titles.every((title) => !title.includes('10년의 결을 정리합니다')),
    `generic placeholder 남아 있으면 안 됨: ${titles.join(' / ')}`
  );

  // 2) 모든 chapterTitle 은 빈 문자열이 아님.
  assert.ok(titles.every((title) => title.length > 0));

  // 3) 10 패턴 중 1개의 marker 가 최소 2건 등장 (감탄/경고/시그널/공감/위기/희망/변환/반전/비밀/질문).
  const allTitles = titles.join('\n');
  const patternMarkers = [
    /역대급 전성기|드디어 운이|10년 중 가장 빛나/,
    /터지기 일보 직전|받쳐주는 흐름|회복과 정리/,
    /암흑기 주의보|보존이 핵심|결정 보류/,
    /비책|운명을 내 편|루틴/,
    /완벽주의|짊어지려|마음의 무게/,
    /가까운 관계|표현과 거리감|관계의 온도/,
    /수익 극대화|결실|성과로 변환/,
    /화려한 무대 뒤|위험이 커지는|과속을 경계/,
    /대격변|새 챕터가 열|분기점/,
    /걸어도 될까|후회할|다음 한 수/,
  ];
  const matchedPatterns = patternMarkers.filter((re) => re.test(allTitles)).length;
  assert.ok(
    matchedPatterns >= 2,
    `최소 2개 이상의 패턴 marker 가 등장해야 함 (matched=${matchedPatterns}): ${titles.join(' / ')}`
  );
});
