// 코인 "만료 보정" 회귀 가드 — 마이페이지 코인 표시(dashboard.credits.total)가
//   만료 안 된 결제 코인만 더하는지 검증. sumNonExpiredLots 가 표시 잔액의 보정 핵심.
import assert from 'node:assert/strict';
import { sumNonExpiredLots, type CreditLotRow } from './lot-balance';

declare const test: (name: string, fn: () => void) => void;

const NOW = new Date('2026-06-28T00:00:00.000Z');
const future = (days: number) =>
  new Date(NOW.getTime() + days * 86_400_000).toISOString();
const past = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

test('만료 보정: 미래 만료 lot 만 합산, 과거 만료는 제외', () => {
  const lots: CreditLotRow[] = [
    { amount_remaining: 10, expires_at: future(30) }, // 유효
    { amount_remaining: 5, expires_at: future(1) }, // 유효
    { amount_remaining: 100, expires_at: past(1) }, // 만료 → 제외
  ];
  assert.equal(sumNonExpiredLots(lots, NOW), 15);
});

test('만료 보정: expires_at === now 는 만료로 제외(경계)', () => {
  const lots: CreditLotRow[] = [
    { amount_remaining: 7, expires_at: NOW.toISOString() },
  ];
  assert.equal(sumNonExpiredLots(lots, NOW), 0);
});

test('만료 보정: expires_at null/파싱불가 lot 은 제외(만료일 불명)', () => {
  const lots: CreditLotRow[] = [
    { amount_remaining: 9, expires_at: null },
    { amount_remaining: 9, expires_at: 'not-a-date' },
    { amount_remaining: 4, expires_at: future(10) },
  ];
  assert.equal(sumNonExpiredLots(lots, NOW), 4);
});

test('만료 보정: amount_remaining null 은 0 으로 취급', () => {
  const lots: CreditLotRow[] = [
    { amount_remaining: null, expires_at: future(5) },
    { amount_remaining: 6, expires_at: future(5) },
  ];
  assert.equal(sumNonExpiredLots(lots, NOW), 6);
});

test('만료 보정: lot 0건이면 0', () => {
  assert.equal(sumNonExpiredLots([], NOW), 0);
});

test('만료 보정: 전부 만료면 0 (잔액 과대표시 방지)', () => {
  const lots: CreditLotRow[] = [
    { amount_remaining: 50, expires_at: past(1) },
    { amount_remaining: 30, expires_at: past(100) },
  ];
  assert.equal(sumNonExpiredLots(lots, NOW), 0);
});

test('만료 보정: 여러 유효 lot 합산(분할 충전)', () => {
  const lots: CreditLotRow[] = [
    { amount_remaining: 15, expires_at: future(365) },
    { amount_remaining: 15, expires_at: future(200) },
    { amount_remaining: 3, expires_at: future(1) },
  ];
  assert.equal(sumNonExpiredLots(lots, NOW), 33);
});
