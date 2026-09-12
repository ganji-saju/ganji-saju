// 할인쿠폰 PR4 — 승인 직전 재검증(설계 §5-3 · 가드 테스트 §13-10 "만료된 쿠폰의 옛 prepared 주문이 승인 거부").
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CouponRow } from '@/lib/coupons/discount-coupon';
import { checkCouponOrderBeforeApproval, couponOrderRejectMessage, couponOrderVerdict } from './coupon-order-guard';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = new Date('2026-09-12T12:00:00Z');
const row = (over: Partial<CouponRow> = {}): CouponRow => ({
  code: 'ganji100001',
  batch: 'flyer-1',
  bound_user_id: 'u1',
  bound_at: '2026-09-10T00:00:00Z',
  bound_percent: 10,
  bound_max_discount_won: null,
  expires_at: '2027-12-31T14:59:59Z',
  disabled_at: null,
  released_at: null,
  coupon_tiers: { percent: 10, max_discount_won: null, disabled_at: null },
  ...over,
});
const order = { userId: 'u1', couponCode: 'ganji100001' };

test('couponOrderVerdict — 살아 있고 이 주문 주인에게 귀속된 쿠폰만 승인', () => {
  assert.equal(couponOrderVerdict(order, row(), NOW), null);
  assert.equal(couponOrderVerdict({ userId: 'u1', couponCode: null }, null, NOW), null, '쿠폰 없는 주문은 건드리지 않는다(일반 결제 회귀 0)');
  assert.equal(couponOrderVerdict(order, row({ expires_at: '2026-09-01T00:00:00Z' }), NOW), 'coupon_expired', '만료된 쿠폰의 옛 주문(§13-10)');
  assert.equal(couponOrderVerdict(order, row({ disabled_at: '2026-09-11T00:00:00Z' }), NOW), 'coupon_disabled', '배치 회수');
  assert.equal(couponOrderVerdict(order, row({ released_at: '2026-09-11T00:00:00Z' }), NOW), 'coupon_disabled', '새 쿠폰으로 옮긴 옛 쿠폰(080)');
  assert.equal(couponOrderVerdict(order, row({ coupon_tiers: { percent: 10, max_discount_won: null, disabled_at: 'x' } }), NOW), 'coupon_disabled', '등급 회수');
  assert.equal(couponOrderVerdict(order, row({ bound_user_id: 'u2' }), NOW), 'coupon_not_bound', '24h 회수로 남에게 넘어간 쿠폰');
  assert.equal(couponOrderVerdict(order, null, NOW), 'coupon_missing');
});

function fakeService(result: { data: unknown; error: { message: string } | null }) {
  let queries = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            queries += 1;
            return result;
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, queries: () => queries };
}

test('checkCouponOrderBeforeApproval — 승인 전 할인 주문만 조회하고, 조회 실패는 거부(실패-닫힘)', async () => {
  const ok = fakeService({ data: row(), error: null });
  assert.equal(await checkCouponOrderBeforeApproval({ ...order, status: 'prepared' }, { service: ok.client, now: NOW }), null);
  assert.equal(ok.queries(), 1);

  const skip = fakeService({ data: null, error: { message: 'x' } });
  for (const status of ['confirmed', 'fulfilling', 'fulfilled'] as const) {
    assert.equal(await checkCouponOrderBeforeApproval({ ...order, status }, { service: skip.client, now: NOW }), null, `${status}: 돈이 이미 움직였다 — 막으면 지급이 안 된다`);
  }
  assert.equal(await checkCouponOrderBeforeApproval({ userId: 'u1', couponCode: null, status: 'prepared' }, { service: skip.client, now: NOW }), null);
  assert.equal(skip.queries(), 0, '쿠폰 없는 주문·승인된 주문은 조회조차 하지 않는다');

  const down = fakeService({ data: null, error: { message: 'timeout' } });
  assert.equal(await checkCouponOrderBeforeApproval({ ...order, status: 'in_progress' }, { service: down.client, now: NOW }), 'coupon_lookup_failed');

  const expired = fakeService({ data: row({ expires_at: '2026-09-01T00:00:00Z' }), error: null });
  assert.equal(await checkCouponOrderBeforeApproval({ ...order, status: 'prepared' }, { service: expired.client, now: NOW }), 'coupon_expired');
});

test('거부 안내는 "결제된 금액 없음"을 말한다(사용자가 이중 청구를 걱정하지 않게)', () => {
  for (const reason of ['coupon_lookup_failed', 'coupon_expired', 'coupon_not_bound'] as const) {
    assert.ok(couponOrderRejectMessage(reason).includes('결제된 금액은 없습니다'));
  }
});

// 호출 위치 불변식: PG 승인 호출보다 **먼저**, 결과를 무시하지 않고.
test('토스 confirm · 나이스페이 return 은 PG 승인 전에 쿠폰 가드를 돌리고 거부면 멈춘다', () => {
  const root = path.resolve(__dirname, '../../app/api/payments');
  const cases: Array<[string, string[]]> = [
    ['confirm/route.ts', ['attachPaymentKeyToOrder({ order', 'confirmPayment(paymentKey']],
    ['nicepay/return/route.ts', ['approveNicepayPayment(tid']],
  ];
  for (const [file, laterCalls] of cases) {
    const src = fs.readFileSync(path.join(root, file), 'utf8');
    const guardAt = src.indexOf('await checkCouponOrderBeforeApproval(order)');
    assert.ok(guardAt > 0, `${file}: 쿠폰 가드 호출이 없다`);
    for (const call of laterCalls) {
      const at = src.indexOf(call);
      assert.ok(at > guardAt, `${file}: ${call} 가 가드보다 앞에 있다`);
    }
    assert.ok(/if \(couponReject\) \{[\s\S]{0,600}?return /.test(src), `${file}: 가드 결과를 무시한다`);
  }
});
