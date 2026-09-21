import assert from 'node:assert/strict';
import { loadSajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { BirthInput } from '@/lib/saju/types';
import { buildLifetimeCoreReadings } from './lifetime-core-readings';

declare const test: (name: string, fn: () => void) => void;

const inputs: BirthInput[] = [
  { year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' },
  { year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: 'female' },
];
const dataFor = (input: BirthInput) => loadSajuDataV2(input, null, { now: '2026-09-18T00:00:00Z' });

test('lifetime core answers use different natal combinations rather than daily action copy', () => {
  const reports = inputs.map((input) => buildLifetimeCoreReadings(input, dataFor(input), 2026, null));
  assert.match(reports[0].wealthStyle.earningStyle, /식상은 확인되지만 재성/);
  assert.match(reports[1].wealthStyle.earningStyle, /식상과 재성이 함께/);
  assert.notEqual(reports[0].careerDirection.fitStructure, reports[1].careerDirection.fitStructure);
  assert.notEqual(reports[0].wealthStyle.keepingStyle, reports[1].wealthStyle.keepingStyle);
  for (const report of reports) {
    assert.doesNotMatch(JSON.stringify(report), /[\u3400-\u9fff]|오늘은|이번 달|무조건|반드시/);
    for (const section of Object.values(report)) {
      const details = Object.entries(section).filter(([key]) => !['headline', 'summary', 'basis'].includes(key));
      assert.equal(details.length, 4);
      for (const [key, body] of details) assert.ok(typeof body === 'string' && body.length >= 100, `${key} must answer its question`);
    }
  }
});

test('lifetime core answers stay natal across daily luck changes and do not mutate engine data', () => {
  const data = dataFor(inputs[0]);
  const snapshot = structuredClone(data);
  const expected = buildLifetimeCoreReadings(inputs[0], data, 2026, null);
  const differentLuck = { ...data, currentLuck: null, majorLuck: [] };
  assert.deepEqual(buildLifetimeCoreReadings(inputs[0], differentLuck, 2027, null), expected);
  assert.deepEqual(data, snapshot);
  const weaker = { ...data, strength: { ...data.strength!, level: '신약' as const } };
  assert.notEqual(buildLifetimeCoreReadings(inputs[0], weaker, 2026, null).careerDirection.independenceStyle, expected.careerDirection.independenceStyle);
  const tentative = { ...data, pattern: { ...data.pattern!, confidence: '낮음' as const } };
  assert.match(buildLifetimeCoreReadings(inputs[0], tentative, 2026, null).careerDirection.fitStructure, /격국의 참고 후보/);
});

test('lifetime core does not turn missing time or situation into a spouse or occupation', () => {
  const input = { ...inputs[0], hour: undefined, minute: undefined, unknownTime: true };
  const data = dataFor(input);
  const core = buildLifetimeCoreReadings(input, data, 2026, null);
  assert.match(core.relationshipPattern.longevityGuide, /관계 상태가 입력되지 않았/);
  assert.match(core.relationshipPattern.basis.join(' '), /태어난 시간을 몰라/);
  const ghostHour = { ...data, pillars: { ...data.pillars, hour: dataFor(inputs[1]).pillars.hour } };
  assert.deepEqual(buildLifetimeCoreReadings(input, ghostHour, 2026, null), core, 'Unknown hour cannot affect natal branch relations');
  const withContext = buildLifetimeCoreReadings(input, data, 2026, { occupation: 'employee', relationshipStatus: 'married' });
  assert.match(withContext.wealthStyle.operatingStyle, /현재 직장 생활/);
  assert.match(withContext.relationshipPattern.longevityGuide, /현재 기혼 관계/);
});

test('lifetime core uses child examples even if an adult situation was supplied', () => {
  for (const year of [2024, 2020, 2010]) {
    const input: BirthInput = { year, month: 2, day: 15, unknownTime: true };
    const core = buildLifetimeCoreReadings(input, dataFor(input), 2026, { occupation: 'self-employed', relationshipStatus: 'married' });
    assert.match(core.wealthStyle.earningStyle, /놀이|용돈/);
    assert.match(core.relationshipPattern.longevityGuide, /보호자/);
    assert.doesNotMatch(JSON.stringify(core), /현재 기혼|현재 자영업|매수|배우자|급여|연애 중/);
  }
});
