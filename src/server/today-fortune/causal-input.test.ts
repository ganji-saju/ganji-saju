import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { getTodayPillarSnapshot } from '@/server/today-fortune/build-today-fortune';
import { detectTodaySinsals, buildCausalInput } from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';
import { buildFreshTodaySajuData } from './fresh-saju-data';
import { buildSajuOriginForIljin, buildTodayFortuneFreeResult, buildTodayFortunePremiumResult } from './build-today-fortune';

declare const test: (name: string, fn: () => void) => void;

const birth: BirthInput = { year: 1982, month: 1, day: 29, hour: 8, minute: 0, gender: 'male' };

test('causal-input: 1982-01-29 남 진시 → 편관·삼합수·용신화 파생', () => {
  const data = calculateSajuDataV1(birth);
  const todayPillar = getTodayPillarSnapshot(data, { now: new Date('2026-08-02T03:00:00Z') });
  const sinsals = detectTodaySinsals(data, todayPillar.stem, todayPillar.branch);
  const input = buildCausalInput(data, todayPillar, sinsals);
  assert.ok(input, 'CausalInput null');
  assert.equal(input!.dayMaster, '壬');
  assert.equal(input!.iljinTenGod, '편관'); // 壬 대비 오늘 천간 戊
  assert.equal(input!.yongsin, '화');
  assert.ok(input!.topRelation && input!.topRelation.element === '수'); // 申子辰 삼합
});

test('causal-input: 시간 미입력(일진 없음) → null', () => {
  const noTime: BirthInput = { year: 1982, month: 1, day: 29, gender: 'male', unknownTime: true };
  const data = calculateSajuDataV1(noTime);
  const input = buildCausalInput(data, { stem: null, branch: null } as never, []);
  assert.equal(input, null);
});

test('causal-input: detectTodaySinsals 는 오늘 천간/지지 없어도 원국 신살을 탐지한다', () => {
  const data = calculateSajuDataV1(birth); // 원국에 귀문관살 등 존재
  const hits = detectTodaySinsals(data, '', '');
  assert.ok(hits.length > 0, '오늘 일진 없이도 원국 신살은 나와야 함(원 인라인 블록 동등)');
  assert.ok(hits.every((h) => !h.positions.includes('iljin')), '일진 미제공 시 iljin 포지션 없어야');
});


test('causal-input: 생시 미상 snapshot에 남은 시주로 합을 완성하지 않는다', () => {
  const data = calculateSajuDataV1(birth);
  data.input.hourKnown = false;
  const input = buildCausalInput(data, { stem: '戊', branch: '申' }, []);
  assert.ok(input);
  assert.equal(input.topRelation?.complete, false);
  assert.equal(input.topRelation?.element, null);
  assert.ok(!input.topRelation?.natalBranches.includes('辰'));
});

test('causal-input: 저장된 과거 연월운 대신 풀이 날짜의 연월운을 사용한다', () => {
  const now = new Date('2026-09-18T03:00:00Z');
  const stored = buildFreshTodaySajuData(birth, { now: '2025-02-15T03:00:00Z' });
  const fresh = buildFreshTodaySajuData(birth, { now });
  const oldResult = buildTodayFortunePremiumResult(birth, stored, 'general', null, null, { now });
  const newResult = buildTodayFortunePremiumResult(birth, fresh, 'general', null, null, { now });
  assert.equal(oldResult.dateKey, newResult.dateKey);
  assert.equal(oldResult.causalNarrative?.body, newResult.causalNarrative?.body);
  assert.equal(buildCausalInput(stored, { stem: '乙', branch: '未' }, [])?.saewoonTenGod, null);
});

test('causal-input: 생시 미상 잔여 시주는 신살과 오늘 점수의 근거에도 사용하지 않는다', () => {
  const noTime = { ...birth, unknownTime: true, hour: undefined, minute: undefined };
  const clean = buildFreshTodaySajuData(noTime, { now: '2026-09-18T03:00:00Z' });
  const stale = structuredClone(clean);
  stale.pillars.hour = calculateSajuDataV1(birth).pillars.hour;
  assert.deepEqual(detectTodaySinsals(clean, '乙', '未'), detectTodaySinsals(stale, '乙', '未'));
  assert.deepEqual(buildSajuOriginForIljin(clean, '화', '금'), buildSajuOriginForIljin(stale, '화', '금'));
  const options = { concernId: 'general' as const, sourceSessionId: 'unknown', calendarType: 'solar' as const, timeRule: 'standard' as const, now: new Date('2026-09-18T03:00:00Z') };
  const expected = buildTodayFortuneFreeResult(noTime, clean, options);
  const actual = buildTodayFortuneFreeResult(noTime, stale, options);
  assert.equal(actual.sajuChart?.pillars.hour, null);
  assert.deepEqual(actual.iljinScore, expected.iljinScore);
  assert.equal(actual.oneLine.body, expected.oneLine.body);
});
