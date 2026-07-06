import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildFortuneCalendarMonth } from '@/domain/saju/report';
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

test('buildFortuneCalendarMonth returns a complete month grid with tone counts', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildFortuneCalendarMonth(birthInput, data, 2026, 5);

  assert.equal(report.year, 2026);
  assert.equal(report.month, 5);
  assert.equal(report.monthLabel, '2026년 5월');
  assert.equal(report.totalDays, 31);
  assert.equal(report.days.length, 31);
  assert.ok(report.weeks.length >= 4);
  assert.equal(
    report.summary.toneCounts.decision +
      report.summary.toneCounts.good +
      report.summary.toneCounts.average +
      report.summary.toneCounts.caution,
    31
  );
  assert.ok(report.summary.decisionDays.length > 0);
  assert.ok(report.summary.goodDays.length > 0);
  assert.ok(report.summary.bestDays.length > 0);
  assert.ok(report.summary.cautionDays.length > 0);
  assert.equal(
    report.summary.bestDays.filter((day) => report.summary.cautionDays.includes(day)).length,
    0
  );
  assert.equal(
    report.summary.decisionDays.filter((day) => report.summary.cautionDays.includes(day)).length,
    0
  );
});

// 2026-07-07 — 달력 일자 메시지의 "[이름] 님" 이 '선생님 님' 으로 새던 버그 회귀 가드.
//   빌더는 input.name 을 존중하므로, 라우트가 표시 이름을 보강한 input 을 넘겨야 한다
//   (fortune-calendar route 에서 resolveNamedReadingInput 적용).
test('buildFortuneCalendarMonth: input.name 이 있으면 일자 메시지 이름 치환, 없으면 선생님 fallback', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const allDayText = (report: ReturnType<typeof buildFortuneCalendarMonth>) =>
    report.days.flatMap((d) => [d.summary, ...(d.dayMessages ?? [])]).join(' ');

  const withoutName = allDayText(buildFortuneCalendarMonth(birthInput, data, 2026, 5));
  const withName = allDayText(
    buildFortuneCalendarMonth({ ...birthInput, name: '김영민' }, data, 2026, 5)
  );

  // 이름 없는 입력 → [이름] 이 '선생님' fallback 으로 치환됨(경로가 실재함을 증명).
  assert.ok(withoutName.includes('선생님'), '이름 없으면 선생님 fallback 이 나와야(경로 존재 증명)');
  // 이름 보강 → 선생님 fallback 사라지고 실제 이름 치환.
  assert.ok(!withName.includes('선생님'), '이름 지정 시 선생님 fallback 이 남으면 안 됨');
  assert.ok(withName.includes('김영민'), '이름 지정 시 일자 메시지에 이름이 치환돼야');
});

test('buildFortuneCalendarMonth annotates each day with score, tone, and action hint', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildFortuneCalendarMonth(birthInput, data, 2026, 2);
  const firstDay = report.days[0];

  assert.ok(firstDay);
  assert.match(firstDay!.isoDate, /^2026-02-\d{2}$/);
  assert.ok(firstDay!.score >= 0);
  assert.ok(['decision', 'good', 'average', 'caution'].includes(firstDay!.tone));
  assert.ok(firstDay!.summary.length > 0);
  assert.ok(firstDay!.actionHint.length > 0);
});
