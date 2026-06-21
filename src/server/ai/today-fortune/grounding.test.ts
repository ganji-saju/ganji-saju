import assert from 'node:assert/strict';
import { buildTodayFortuneGrounding } from './grounding';
import { buildTodayFortuneFreeResult } from '@/server/today-fortune/build-today-fortune';
import { buildFreshTodaySajuData } from '@/server/today-fortune/fresh-saju-data';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';

declare const test: (name: string, fn: () => void) => void;

/** 고정 입력 — 테스트마다 동일한 결과 보장. */
function makeArgs() {
  const draft = {
    calendarType: 'solar' as const,
    timeRule: 'standard' as const,
    year: '1988',
    month: '3',
    day: '15',
    hour: '10',
    minute: '30',
    unknownBirthTime: false,
    gender: 'female',
    birthLocationCode: 'custom',
    birthLocationLabel: '서울특별시',
    birthLatitude: '37.5665',
    birthLongitude: '126.9780',
    name: '홍길동',
  };
  const parsed = resolveUnifiedBirthInput(draft, { requireGender: false });
  if (!parsed.ok) throw new Error(`test birth input invalid: ${parsed.error}`);

  const input = parsed.input;
  const FIXED_NOW = new Date('2026-05-27T03:00:00Z');
  const sajuData = buildFreshTodaySajuData(input, { now: FIXED_NOW });
  const result = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'grounding-test',
    calendarType: 'solar',
    timeRule: 'standard',
    now: FIXED_NOW,
  });

  const caseSummaries = ['오늘 좋은 흐름이 발동됩니다', '주의가 필요한 흐름입니다'];
  const situation = '취업 준비 중입니다';

  return { result, sajuData, caseSummaries, situation };
}

test('grounding 은 결정론적이다(같은 입력 → 같은 출력)', () => {
  const args = makeArgs();
  assert.deepEqual(buildTodayFortuneGrounding(args), buildTodayFortuneGrounding(args));
});

test('weakElement 는 "X 기운" 형태(naming-policy)', () => {
  const g = buildTodayFortuneGrounding(makeArgs());
  assert.match(g.weakElement, /기운$/);
});

test('strongElement 는 "X 기운" 형태(naming-policy)', () => {
  const g = buildTodayFortuneGrounding(makeArgs());
  assert.match(g.strongElement, /기운$/);
});

test('todayGanzi 는 한글 음(한자 없음)', () => {
  const g = buildTodayFortuneGrounding(makeArgs());
  // 한자 범위 U+4E00–U+9FFF
  assert.doesNotMatch(g.todayGanzi, /[一-鿿]/);
  // 2자 이상의 한글
  assert.match(g.todayGanzi, /^[가-힣]{2,}$/);
});

test('topAreas 는 score 내림차순 최대 3개', () => {
  const g = buildTodayFortuneGrounding(makeArgs());
  assert.ok(g.topAreas.length > 0 && g.topAreas.length <= 3);
  for (let i = 1; i < g.topAreas.length; i++) {
    assert.ok(
      g.topAreas[i - 1]!.score >= g.topAreas[i]!.score,
      'topAreas 는 score 내림차순이어야 합니다'
    );
  }
});

test('triggeredCaseSummaries 는 전달된 caseSummaries 와 동일', () => {
  const args = makeArgs();
  const g = buildTodayFortuneGrounding(args);
  assert.deepEqual(g.triggeredCaseSummaries, args.caseSummaries);
});

test('concernLabel 과 situation 이 올바르게 전달됨', () => {
  const args = makeArgs();
  const g = buildTodayFortuneGrounding(args);
  assert.equal(g.concernLabel, args.result.concernLabel);
  assert.equal(g.situation, args.situation);
});

test('iljinScore 와 iljinGrade 가 result 와 일치', () => {
  const args = makeArgs();
  const g = buildTodayFortuneGrounding(args);
  assert.equal(g.iljinScore, args.result.iljinScore?.totalScore ?? null);
  assert.equal(g.iljinGrade, args.result.iljinScore?.grade ?? null);
});

test('name 이 result.userName 또는 빈 문자열에서 옴', () => {
  const args = makeArgs();
  const g = buildTodayFortuneGrounding(args);
  assert.equal(g.name, args.result.userName ?? '');
});
