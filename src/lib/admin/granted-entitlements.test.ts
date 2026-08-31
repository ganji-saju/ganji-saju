import assert from 'node:assert/strict';
import { isAdminGrantedEntitlement } from './granted-entitlements';

// 2026-08-31 — 회수 대상 판정 가드. 결제분이 여기 걸리면 PG 취소 없이 이용권만 사라진다.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('결제 흔적(order_id 또는 payment_key)이 있으면 수동 부여가 아니다', () => {
  assert.equal(isAdminGrantedEntitlement({ order_id: 'ord_1', payment_key: 'pk_1' }), false);
  // 묶음 구성품 — amount 는 null 이지만 order_id 가 있다(결제분).
  assert.equal(isAdminGrantedEntitlement({ order_id: 'ord_2', payment_key: null }), false);
  // 취소 통보 등으로 payment_key 만 남은 행도 결제분이다.
  assert.equal(isAdminGrantedEntitlement({ order_id: null, payment_key: 'pk_3' }), false);
});

test('order_id·payment_key 둘 다 없어야 수동 부여다', () => {
  assert.equal(isAdminGrantedEntitlement({ order_id: null, payment_key: null }), true);
});
