import assert from 'node:assert/strict';
import { Lunar, Solar } from 'lunar-typescript';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { SajuLifetimeReport } from '@/domain/saju/report/lifetime-types';
import type { ReadingRecord } from './readings';
import type { BirthInput } from './types';
import { getBirthLocationPreset } from './birth-location';
import { buildLifetimePdfTimeline } from './lifetime-pdf-timeline';
import { ganziToKorean } from './terminology';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const INPUT: BirthInput = { year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' };
const REPORT = { patternAndYongsin: { supportSymbols: [] } } as unknown as SajuLifetimeReport;

function readingFor(input: BirthInput = INPUT): ReadingRecord {
  // The pure PDF builder needs only input + engine output; no DB or account data.
  return { input, sajuData: calculateSajuDataV1(input, { calculatedAt: '2026-06-15T12:00:00.000Z' }) } as ReadingRecord;
}

function withoutYearLabels(text: string, ganzi: string[]): string {
  // A new year number, pillar name or ten-god label alone is not new advice.
  for (const value of ganzi) text = text.replaceAll(ganziToKorean(value), '').replaceAll(value, '');
  return text
    .replace(/\d+(?:\s*(?:년\s*차|년|세))?/g, '')
    .replace(/비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인/g, '')
    .replace(/[목화토금수](?=\s*(?:기운|일간|천간|지지))/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

test('lifetime PDF timeline covers each calendar age 0 through 100 exactly once with full narratives', () => {
  const timeline = buildLifetimePdfTimeline(readingFor(), REPORT, 2026);
  assert.equal(timeline.years.length, 101);
  assert.deepEqual(timeline.years.map((row) => row.age), Array.from({ length: 101 }, (_, i) => i));
  assert.deepEqual(timeline.years.map((row) => row.year), Array.from({ length: 101 }, (_, i) => 1982 + i));
  assert.equal(timeline.years.filter((row) => row.isCurrent).length, 1);
  assert.equal(timeline.years.find((row) => row.isCurrent)?.age, 44);
  for (const row of timeline.years) {
    assert.equal(row.ganzi, Solar.fromYmd(row.year, 6, 15).getLunar().getEightChar().getYear());
    for (const field of ['overview', 'learningCareer', 'relationships', 'resources', 'wellbeing', 'action'] as const) {
      assert.ok(row[field].length >= 65, `${row.year} ${field} should contain a useful explanation`);
      assert.doesNotMatch(row[field], /[\u3400-\u9fff]/, 'body copy uses Korean terminology');
    }
    assert.doesNotMatch(row.majorLuckLabel, /대운 미산정/, 'known gender has no unexplained gaps');
  }
  assert.match(timeline.notes.join(' '), /만 나이와 다를/);
  assert.match(timeline.notes.join(' '), /입춘 전/);
});

test('lifetime PDF cycle boundaries agree with the engine while converting nominal ages to calendar ages', () => {
  for (const gender of ['male', 'female'] as const) {
    const reading = readingFor({ ...INPUT, gender });
    const timeline = buildLifetimePdfTimeline(reading, REPORT, 2026);
    const engineBirthYear = reading.sajuData.input.birthTimeCorrection?.adjustedBirth.year ?? reading.sajuData.input.birth.year;
    for (const engineCycle of reading.sajuData.majorLuck ?? []) {
      if (engineCycle.startAge === null || engineCycle.endAge === null) continue;
      const cycle = timeline.cycles.find((item) => item.index === engineCycle.index);
      assert.ok(cycle);
      assert.equal(cycle.ganzi, engineCycle.ganzi);
      assert.equal(cycle.startYear, engineBirthYear + engineCycle.startAge - 1);
      assert.equal(cycle.endYear, engineBirthYear + engineCycle.endAge - 1);
      assert.equal(cycle.startAge, cycle.startYear - reading.input.year);
      assert.equal(cycle.endAge, cycle.endYear - reading.input.year);
      const first = timeline.years.find((row) => row.year === cycle.startYear);
      if (first) {
        assert.match(first.phase, /대운 진입/);
        assert.ok(first.majorLuckLabel.includes(String(cycle.startYear)));
      }
    }
    for (let i = 1; i < timeline.cycles.length; i++) {
      assert.equal(timeline.cycles[i].startYear, timeline.cycles[i - 1].endYear + 1);
    }
    const first = timeline.cycles[0];
    for (const row of timeline.years.filter((row) => row.year < first.startYear)) {
      assert.match(row.majorLuckLabel, /첫 대운 시작 전/);
    }
    assert.ok(timeline.cycles.at(-1)!.endYear >= reading.input.year + 100);
  }
});

test('lifetime PDF preserves longitude correction across New Year and both night-Zi rules', () => {
  const location = getBirthLocationPreset('seoul');
  assert.ok(location);
  for (const jasiMethod of ['split', 'unified'] as const) {
    const reading = readingFor({ year: 2000, month: 1, day: 1, hour: 0, minute: 10, gender: 'male', birthLocation: location, solarTimeMode: 'longitude', jasiMethod });
    assert.equal(reading.sajuData.input.birthTimeCorrection?.adjustedBirth.year, 1999);
    const result = buildLifetimePdfTimeline(reading, REPORT, 2026);
    const engineCycle = reading.sajuData.majorLuck![0];
    assert.equal(result.cycles[0].startYear, 1999 + engineCycle.startAge! - 1);
    assert.equal(result.cycles[0].startAge, result.cycles[0].startYear - 2000);
    assert.equal(result.cycles[0].ganzi, engineCycle.ganzi);
    assert.equal(result.years[0].year, 2000, 'original solar birth year owns the visible age scale');
  }
});

test('lifetime PDF handles unknown birth time and missing gender without inventing a major cycle', () => {
  const unknownTime = readingFor({ ...INPUT, hour: undefined, minute: undefined, unknownTime: true });
  const estimated = buildLifetimePdfTimeline(unknownTime, REPORT, 2026);
  assert.equal(estimated.years.length, 101);
  assert.ok(estimated.cycles.length >= 10);
  assert.match(estimated.notes.join(' '), /정오.*추정/);
  const missingGender = readingFor({ ...INPUT, gender: undefined });
  const incomplete = buildLifetimePdfTimeline(missingGender, REPORT, 2026);
  assert.equal(incomplete.cycles.length, 0);
  assert.equal(incomplete.years.length, 101);
  assert.ok(incomplete.years.every((row) => row.majorLuckLabel.includes('대운 미산정')));
  assert.match(incomplete.notes.join(' '), /성별 정보가 없어/);
  assert.ok(incomplete.years.every((row) => !row.phase.includes('대운 진입')));
});

test('lifetime PDF supports the oldest and newest allowed birth years through calendar year 2200', () => {
  for (const year of [1900, 2000, 2100]) {
    const reading = readingFor({ year, month: 3, day: 1, hour: 12, minute: 0, gender: 'female' });
    const result = buildLifetimePdfTimeline(reading, REPORT, 2026);
    assert.equal(result.years[0].year, year);
    assert.equal(result.years.at(-1)!.year, year + 100);
    assert.equal(result.years.at(-1)!.age, 100);
    assert.ok(result.years.every((row) => row.ganzi.length === 2));
    assert.ok(result.cycles.at(-1)!.endYear >= year + 100);
  }
});

test('lifetime PDF uses already-normalized solar input for leap lunar dates and accepts leap-day births', () => {
  const normalized = Lunar.fromYmd(2023, -2, 1).getSolar();
  const inputs: BirthInput[] = [
    { year: normalized.getYear(), month: normalized.getMonth(), day: normalized.getDay(), gender: 'female', unknownTime: true },
    { year: 2000, month: 2, day: 29, hour: 23, minute: 30, gender: 'male', jasiMethod: 'split' },
  ];
  for (const input of inputs) {
    const reading = readingFor(input);
    const before = JSON.stringify(reading.input);
    const result = buildLifetimePdfTimeline(reading, REPORT, 2026);
    assert.equal(result.years[0].year, input.year);
    assert.equal(result.years.at(-1)!.year, input.year + 100);
    assert.equal(JSON.stringify(reading.input), before, 'PDF does not convert the normalized date a second time');
    assert.equal(result.cycles[0].ganzi, reading.sajuData.majorLuck![0].ganzi);
  }
});

test('lifetime PDF copy is age appropriate and does not project current adult status onto childhood or old age', () => {
  const reading = readingFor();
  const reportWithUnsafeAdultCopy = {
    ...REPORT,
    majorLuckTimeline: { cycles: [{ hook: '자영업자인 당신은 결혼해서 지금 사업을 늘릴 시기', closingNote: '과거도 다가오면 반드시 투자하세요' }] },
  } as unknown as SajuLifetimeReport;
  const result = buildLifetimePdfTimeline(reading, reportWithUnsafeAdultCopy, 2026);
  for (const row of result.years.filter((item) => item.age <= 12)) {
    assert.doesNotMatch(JSON.stringify(row), /결혼|연애|투자|이직|은퇴|사업|직장인/);
  }
  assert.match(result.years[0].action, /보호자/);
  assert.match(result.years[100].learningCareer, /본인의 관심/);
  const copy = JSON.stringify(result);
  assert.doesNotMatch(copy, /다가오면|자영업자인|반드시|확실히|사고가|수명이/);
  assert.ok(result.cycles.every((cycle) => cycle.transition.before && cycle.transition.entry && cycle.transition.after));
  assert.ok(new Set(result.cycles.map((cycle) => cycle.title)).size >= 10);
});

test('lifetime PDF annual interpretation depends on the actual year, natal day master and major cycle, not a random score', () => {
  const reading = readingFor();
  const a = buildLifetimePdfTimeline(reading, REPORT, 2026);
  const b = buildLifetimePdfTimeline(reading, REPORT, 2027);
  assert.deepEqual(a.years.map(({ isCurrent, ...rest }) => rest), b.years.map(({ isCurrent, ...rest }) => rest));
  assert.deepEqual(a.cycles.map(({ isCurrent, ...rest }) => rest), b.cycles.map(({ isCurrent, ...rest }) => rest));
  assert.equal(new Set(a.years.slice(0, 60).map((row) => row.ganzi)).size, 60);
  assert.equal(new Set(a.years.slice(0, 10).map((row) => row.theme)).size, 10);
  assert.notEqual(a.years[44].overview, a.years[45].overview);
  assert.notEqual(a.years[0].learningCareer, a.years[60].learningCareer, 'same ganzi in a new life stage needs different advice');
  assert.ok(a.years[44].overview.includes('대운'));
  assert.equal(Object.hasOwn(a.years[44], 'score'), false);
  const different = buildLifetimePdfTimeline(readingFor({ ...INPUT, day: 30 }), REPORT, 2026);
  assert.equal(a.years[44].ganzi, different.years[44].ganzi, 'the calendar year is the same');
  assert.notEqual(a.years[44].overview, different.years[44].overview, 'different day master changes the same annual pillar interpretation');
});

test('lifetime PDF does not mutate input report or reading data', () => {
  const reading = readingFor();
  const before = JSON.stringify(reading);
  const reportBefore = JSON.stringify(REPORT);
  buildLifetimePdfTimeline(reading, REPORT, 2026);
  assert.equal(JSON.stringify(reading), before);
  assert.equal(JSON.stringify(REPORT), reportBefore);
});

test('lifetime PDF changes practical advice beyond year labels for recurring stems and neighboring same-element branches', () => {
  const timeline = buildLifetimePdfTimeline(readingFor(), REPORT, 2026);
  const ganzi = [...timeline.years, ...timeline.cycles].map((row) => row.ganzi);
  // 2018/2028 share the same stem and adult life stage; 2004/2005 have metal branches.
  for (const [leftYear, rightYear] of [[2018, 2028], [2004, 2005]]) {
    const left = timeline.years.find((row) => row.year === leftYear)!;
    const right = timeline.years.find((row) => row.year === rightYear)!;
    for (const field of ['learningCareer', 'resources', 'wellbeing', 'action'] as const) {
      assert.notEqual(
        withoutYearLabels(left[field], ganzi),
        withoutYearLabels(right[field], ganzi),
        `${leftYear}/${rightYear} ${field} needs a different explanation, not renamed headings`,
      );
    }
  }
});

test('lifetime PDF retains simultaneous natal clash, harmony and repetition instead of stopping at the first match', () => {
  const reading = readingFor();
  // Rule regression fixture, not a claimed real birth chart: 子 meets 午, 丑 and 子.
  reading.sajuData.pillars = {
    ...reading.sajuData.pillars,
    year: { ...reading.sajuData.pillars.year, branch: '午' },
    month: { ...reading.sajuData.pillars.month, branch: '丑' },
    day: { ...reading.sajuData.pillars.day, branch: '子' },
    hour: null,
  };
  const annual = buildLifetimePdfTimeline(reading, REPORT, 2026).years.find((row) => row.year === 2020)!;
  assert.equal(annual.ganzi[1], '子');
  for (const slot of ['태어난 해', '태어난 달', '태어난 날']) assert.ok(annual.relationships.includes(slot), slot);
  assert.match(annual.relationships, /충/);
  assert.match(annual.relationships, /육합/);
  assert.match(annual.relationships, /반복|겹/);
});

test('lifetime PDF ignores a stale hour pillar when the birth time is unknown', () => {
  const reading = readingFor({ ...INPUT, hour: undefined, minute: undefined, unknownTime: true });
  const expected = buildLifetimePdfTimeline(reading, REPORT, 2026);
  assert.equal(reading.sajuData.input.hourKnown, false);
  // Old snapshots can retain an estimated hour pillar; it is not known birth evidence.
  reading.sajuData.pillars.hour = readingFor().sajuData.pillars.hour;
  const actual = buildLifetimePdfTimeline(reading, REPORT, 2026);
  assert.deepEqual(actual, expected, 'unknown-time advice must not use an estimated hour pillar');
  assert.ok(actual.years.every((row) => !row.relationships.includes('태어난 시간')));
});

test('lifetime PDF major-cycle entry, adaptation and completion change the practical priority', () => {
  const timeline = buildLifetimePdfTimeline(readingFor(), REPORT, 2026);
  const reverse = buildLifetimePdfTimeline(readingFor({ ...INPUT, gender: 'female' }), REPORT, 2026);
  const cycle = timeline.cycles.find((row) => row.startAge >= 35 && row.endAge <= 54)!;
  assert.ok(cycle, 'fixture contains a full cycle inside one adult life stage');
  const entry = timeline.years.find((row) => row.year === cycle.startYear)!;
  const adapting = timeline.years.find((row) => row.year === cycle.startYear + 1)!;
  const completion = timeline.years.find((row) => row.year === cycle.endYear)!;
  const ganzi = [...timeline.years, ...timeline.cycles, ...reverse.cycles].map((row) => row.ganzi);
  assert.equal(new Set([entry, adapting, completion].map((row) => withoutYearLabels(row.action, ganzi))).size, 3);
  for (const annual of [entry, adapting, completion]) {
    const reversedAnnual = reverse.years.find((row) => row.year === annual.year)!;
    // Same natal pillars, age and annual pillar; only major-cycle direction changes.
    assert.equal(annual.ganzi, reversedAnnual.ganzi);
    assert.notEqual(
      withoutYearLabels(annual.action, ganzi),
      withoutYearLabels(reversedAnnual.action, ganzi),
      `${annual.year} practical advice must use its major cycle, not only the annual ten god`,
    );
  }
  assert.match(entry.action, /작은|작게|시도|시험/);
  assert.match(adapting.action, /지난|첫|시도|확인|조정/);
  assert.match(completion.action, /마무리|인계|남길|정리|다음/);
});
