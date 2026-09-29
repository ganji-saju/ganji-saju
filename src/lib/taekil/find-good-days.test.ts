import assert from 'node:assert/strict';
import { findGoodDays } from './find-good-days';
import { calculateSipsung } from '@/lib/today-fortune/iljin-rules';
import type { Stem } from '@/lib/today-fortune/iljin-rules';

declare const test: (name: string, fn: () => void) => void;

test('택일 설명은 해당 날짜의 십성과 양쪽 신살 근거를 빠뜨리지 않는다', () => {
  const results = findGoodDays({
    saju: { dayMaster: '甲', dayMasterElement: '목', yearStem: '庚', yearBranch: '午', monthStem: '丙', monthBranch: '寅', dayBranch: '子', hourStem: null, hourBranch: null, elementPercentages: { 목: 30, 화: 20, 토: 10, 금: 20, 수: 20 }, strengthLabel: '중화', yongsinElement: null, kishinElement: null },
    dayGanziIndex: 0, startDate: new Date(2027, 0, 1), daysToScan: 30, topK: 30, purpose: 'contract',
  });
  assert.equal(results.length, 30);
  for (const day of results) {
    assert.ok(day.reasonHint.includes(calculateSipsung('甲', day.iljinGanzi[0] as Stem)));
    for (const name of [...day.positiveSinsals, ...day.negativeSinsals]) assert.ok(day.reasonHint.includes(name));
    assert.match(day.reasonHint, /후보 날짜를 비교/);
    assert.doesNotMatch(day.reasonHint, /에 길운|에 무난/);
  }
});
