import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { getTodayPillarSnapshot } from '@/server/today-fortune/build-today-fortune';
import { detectTodaySinsals, buildCausalInput } from '@/server/today-fortune/build-today-fortune';
import type { BirthInput } from '@/lib/saju/types';

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
