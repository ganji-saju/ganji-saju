// 2026-05-15 PR — 02_십성_12운성_신살_판정함수.md §3.15 통합 신살 탐지 검증.

import assert from 'node:assert/strict';
import { detectComprehensiveSinsals } from './sinsal-comprehensive';

declare const test: (name: string, fn: () => void) => void;

test('detectComprehensiveSinsals - 천을귀인 (壬 일간 + 巳 또는 卯 지지) 탐지', () => {
  const hits = detectComprehensiveSinsals({
    dayMaster: '壬',
    yearBranch: '酉',
    monthBranch: '丑',
    dayBranch: '子',
    hourBranch: '辰',
    dayGanziIndex: 48, // 壬子 = 48 (甲子 0 기준)
  });
  // 壬의 천을귀인은 卯·巳. 위 사주에는 없음 → 천을귀인 미발동.
  const tianyi = hits.find((h) => h.name === '천을귀인');
  assert.equal(tianyi, undefined);

  // 일진에 巳 들어오면 천을귀인 발동.
  const withIljin = detectComprehensiveSinsals(
    {
      dayMaster: '壬',
      yearBranch: '酉',
      monthBranch: '丑',
      dayBranch: '子',
      hourBranch: '辰',
      dayGanziIndex: 48,
    },
    { iljin: { stem: '癸', branch: '巳' } }
  );
  const tianyi2 = withIljin.find((h) => h.name === '천을귀인');
  assert.ok(tianyi2, '巳 일진에서 천을귀인 발동되어야 함');
  assert.deepEqual(tianyi2!.positions, ['iljin']);
  assert.equal(tianyi2!.category, '길신');
});

test('detectComprehensiveSinsals - 백호살 (壬戌 일주) 탐지', () => {
  const hits = detectComprehensiveSinsals({
    dayMaster: '壬',
    yearBranch: '寅',
    monthBranch: '巳',
    dayBranch: '戌',
    hourBranch: '亥',
    dayGanziIndex: 58, // 壬戌
  });
  const baekho = hits.find((h) => h.name === '백호살');
  assert.ok(baekho, '壬戌 일주는 백호살 발동');
  assert.deepEqual(baekho!.positions, ['day']);
  assert.equal(baekho!.scoreHint, -12);
});

test('detectComprehensiveSinsals - 양인살 (壬 일간 + 子 지지)', () => {
  const hits = detectComprehensiveSinsals({
    dayMaster: '壬',
    yearBranch: '酉',
    monthBranch: '丑',
    dayBranch: '子',
    hourBranch: '辰',
    dayGanziIndex: 48,
  });
  // 壬의 양인은 子. 일지가 子이므로 양인살 발동.
  const yangin = hits.find((h) => h.name === '양인살');
  assert.ok(yangin, '壬 일간 + 子 일지 = 양인살');
  assert.ok(yangin!.positions.includes('day'));
});

test('detectComprehensiveSinsals - 공망살 (壬子 일주는 甲辰旬, 寅卯 공망)', () => {
  // 壬子 ganzi 인덱스 = 48. 48/10 = 4 → 甲辰旬. 공망 = 寅卯.
  const hits = detectComprehensiveSinsals({
    dayMaster: '壬',
    yearBranch: '寅', // 공망 발동!
    monthBranch: '丑',
    dayBranch: '子',
    hourBranch: '卯', // 공망 또!
    dayGanziIndex: 48,
  });
  const gongmang = hits.find((h) => h.name === '공망살');
  assert.ok(gongmang, '甲辰旬 일주 + 사주에 寅·卯 → 공망살');
  assert.ok(gongmang!.positions.includes('year') && gongmang!.positions.includes('hour'));
});

test('detectComprehensiveSinsals - 원진살 (子-未 쌍)', () => {
  const hits = detectComprehensiveSinsals({
    dayMaster: '壬',
    yearBranch: '未',
    monthBranch: '丑',
    dayBranch: '子', // 子-未 원진
    hourBranch: '辰',
    dayGanziIndex: 48,
  });
  const wonjin = hits.find((h) => h.name === '원진살');
  assert.ok(wonjin, '사주 내 子-未 원진 쌍');
  assert.ok(wonjin!.positions.includes('year') && wonjin!.positions.includes('day'));
});

test('detectComprehensiveSinsals - 도화살 (寅午戌 三合 → 卯 도화)', () => {
  // 연지가 午이면 寅午戌 그룹, 도화 = 卯.
  const hits = detectComprehensiveSinsals(
    {
      dayMaster: '丙',
      yearBranch: '午',
      monthBranch: '巳',
      dayBranch: '寅',
      hourBranch: '酉',
      dayGanziIndex: 2,
    },
    { iljin: { stem: '乙', branch: '卯' } }
  );
  const dohwa = hits.find((h) => h.name === '도화살');
  assert.ok(dohwa, '寅午戌 三合 그룹 + 卯 일진 = 도화살');
  assert.ok(dohwa!.positions.includes('iljin'));
});

test('detectComprehensiveSinsals - 삼재 (申子辰 띠 + 寅卯辰 해)', () => {
  // 연지 子 (쥐띠) → 삼재 들어오는 해는 寅卯辰.
  const hits = detectComprehensiveSinsals(
    {
      dayMaster: '壬',
      yearBranch: '子',
      monthBranch: '丑',
      dayBranch: '子',
      hourBranch: '辰',
      dayGanziIndex: 48,
    },
    { currentYearBranch: '寅' }
  );
  const samjae = hits.find((h) => h.name?.startsWith('삼재'));
  assert.ok(samjae, '子띠 + 寅년 = 들삼재');
  assert.ok(samjae!.name.includes('들삼재'));
});

test('detectComprehensiveSinsals - 모든 신살이 SinsalHit 형식 (category 유효)', () => {
  const hits = detectComprehensiveSinsals(
    {
      dayMaster: '甲',
      yearBranch: '寅',
      monthBranch: '卯',
      dayBranch: '辰',
      hourBranch: '巳',
      dayGanziIndex: 40, // 甲辰
    },
    { iljin: { stem: '己', branch: '丑' }, currentYearBranch: '午' }
  );
  for (const h of hits) {
    assert.ok(['길신', '흉신', '양날의검'].includes(h.category), `category 유효 아님: ${h.category}`);
    assert.ok(Array.isArray(h.positions));
    assert.ok(typeof h.scoreHint === 'number');
    assert.ok(typeof h.hint === 'string' && h.hint.length > 0);
  }
});
