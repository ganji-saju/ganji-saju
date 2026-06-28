// 멤버십 혜택 기간키(KST) 회귀 가드.
import assert from 'node:assert/strict';
import { dailyPeriodKey, monthlyPeriodKey, MEMBER_BENEFITS } from './member-benefits';

declare const test: (name: string, fn: () => void) => void;

test('기간키: KST 일 단위(UTC 자정 직후도 한국 날짜로)', () => {
  // 2026-06-28 15:30 UTC = 2026-06-29 00:30 KST → 한국 날짜 06-29.
  assert.equal(dailyPeriodKey(new Date('2026-06-28T15:30:00Z')), '2026-06-29');
  // 2026-06-28 14:00 UTC = 2026-06-28 23:00 KST → 06-28.
  assert.equal(dailyPeriodKey(new Date('2026-06-28T14:00:00Z')), '2026-06-28');
});

test('기간키: KST 월 단위(월말 UTC 늦은 밤은 다음 달 KST)', () => {
  // 2026-06-30 15:30 UTC = 2026-07-01 00:30 KST → 07.
  assert.equal(monthlyPeriodKey(new Date('2026-06-30T15:30:00Z')), '2026-07');
  assert.equal(monthlyPeriodKey(new Date('2026-06-15T03:00:00Z')), '2026-06');
});

test('혜택 설정: 대화 일 5건 · 궁합 월 3회', () => {
  assert.equal(MEMBER_BENEFITS.dialogueDaily.limit, 5);
  assert.equal(MEMBER_BENEFITS.dialogueDaily.period, 'day');
  assert.equal(MEMBER_BENEFITS.compatMonthly.limit, 3);
  assert.equal(MEMBER_BENEFITS.compatMonthly.period, 'month');
});
