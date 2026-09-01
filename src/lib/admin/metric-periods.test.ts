// 2026-09-01 회귀 가드 — 달력 기간(일·주(월~일)·월·분기·년) 경계.
import assert from 'node:assert/strict';
import {
  adminPeriodChoices,
  kstExclusiveEndIso,
  mondayKeyOf,
  resolveAdminPeriod,
  shiftAdminPeriod,
} from './metric-periods';

declare const test: (name: string, fn: () => void) => void;

// 2026-09-01(화) 12:00 KST = 03:00 UTC.
const NOW = new Date('2026-09-01T03:00:00Z');

test('기본값은 오늘 하루 — 월 기준으로 열리던 불편의 핵심', () => {
  const p = resolveAdminPeriod(undefined, undefined, NOW);
  assert.equal(p.unit, 'day');
  assert.equal(p.startKey, '2026-09-01');
  assert.equal(p.endKey, '2026-09-01');
  assert.equal(p.days, 1);
});

test('일: 임의 날짜 선택', () => {
  const p = resolveAdminPeriod('day', '2026-08-15', NOW);
  assert.equal(p.startKey, '2026-08-15');
  assert.equal(p.days, 1);
  assert.equal(p.label, '2026년 8월 15일(토)');
});

test('주: 월요일~일요일 (사용자 예시 8/31~9/6)', () => {
  const p = resolveAdminPeriod('week', '2026-09-01', NOW); // 화요일을 주면 그 주로 정규화
  assert.equal(p.anchor, '2026-08-31');
  assert.equal(p.startKey, '2026-08-31');
  assert.equal(p.label, '8월 31일~9월 6일');
  // 진행 중인 주는 오늘까지만 집계한다(미래 축 금지).
  assert.equal(p.endKey, '2026-09-01');
  assert.equal(p.days, 2);
  assert.equal(mondayKeyOf('2026-09-06'), '2026-08-31', '일요일도 같은 주');
});

test('월: 달력 월 경계 (지난 달은 말일까지)', () => {
  const feb = resolveAdminPeriod('month', '2024-02', NOW);
  assert.equal(feb.startKey, '2024-02-01');
  assert.equal(feb.endKey, '2024-02-29', '윤년 말일');
  assert.equal(feb.days, 29);
  const dec = resolveAdminPeriod('month', '2025-12', NOW);
  assert.equal(dec.endKey, '2025-12-31', '12월은 연도가 넘어간다');
});

test('분기: 1~3 / 4~6 / 7~9 / 10~12', () => {
  const q2 = resolveAdminPeriod('quarter', '2026-Q2', NOW);
  assert.equal(q2.startKey, '2026-04-01');
  assert.equal(q2.endKey, '2026-06-30');
  assert.equal(q2.label, '2026년 2분기(4~6월)');
  const q4 = resolveAdminPeriod('quarter', '2025-Q4', NOW);
  assert.deepEqual([q4.startKey, q4.endKey], ['2025-10-01', '2025-12-31']);
  assert.equal(resolveAdminPeriod('quarter', undefined, NOW).anchor, '2026-Q3', '오늘(9월)은 3분기');
});

test('년: 연도 단위, 진행 중인 해는 오늘까지', () => {
  const y = resolveAdminPeriod('year', '2026', NOW);
  assert.equal(y.startKey, '2026-01-01');
  assert.equal(y.endKey, '2026-09-01');
  const past = resolveAdminPeriod('year', '2025', NOW);
  assert.equal(past.days, 365);
});

test('이전/다음 이동 — 미래 기간은 null 이라 버튼이 사라진다', () => {
  const day = resolveAdminPeriod('day', '2026-09-01', NOW);
  assert.equal(shiftAdminPeriod(day, -1, NOW), '2026-08-31');
  assert.equal(shiftAdminPeriod(day, 1, NOW), null);
  const jan = resolveAdminPeriod('month', '2026-01', NOW);
  assert.equal(shiftAdminPeriod(jan, -1, NOW), '2025-12');
  const q1 = resolveAdminPeriod('quarter', '2026-Q1', NOW);
  assert.equal(shiftAdminPeriod(q1, -1, NOW), '2025-Q4');
  assert.equal(shiftAdminPeriod(resolveAdminPeriod('year', '2026', NOW), 1, NOW), null);
});

test('쿼리 상한은 그 날 23:59:59 를 포함하는 다음날 KST 자정', () => {
  assert.equal(kstExclusiveEndIso('2026-09-01'), '2026-09-01T15:00:00.000Z');
});

test('선택 목록은 최신부터, 잘못된 anchor 는 현재 기간으로', () => {
  const months = adminPeriodChoices('month', NOW);
  assert.equal(months[0]?.value, '2026-09');
  assert.equal(months[1]?.value, '2026-08');
  assert.equal(months.length, 24);
  assert.equal(adminPeriodChoices('quarter', NOW)[0]?.value, '2026-Q3');
  assert.equal(adminPeriodChoices('year', NOW)[0]?.label, '2026년');
  assert.equal(resolveAdminPeriod('month', 'garbage', NOW).anchor, '2026-09');
  assert.equal(resolveAdminPeriod('bogus', 'x', NOW).unit, 'day');
});
