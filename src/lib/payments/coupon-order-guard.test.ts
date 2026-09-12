// PG 승인 직전 관문 — 쿠폰 PR4(설계 §5-3 · 가드 테스트 §13-10) + 닫힌 주문 승인 차단 + 거부 시 상태 무변경(2026-09-12 리뷰).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CouponRow } from '@/lib/coupons/discount-coupon';
import { approvalBlockHttpStatus, approvalBlockMessage, checkBeforePgApproval, couponOrderVerdict } from './coupon-order-guard';

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

test('couponOrderVerdict — 살아 있고 이 주문 주인에게 귀속된 쿠폰만 통과', () => {
  assert.equal(couponOrderVerdict(order, row(), NOW), null);
  assert.equal(couponOrderVerdict({ userId: 'u1', couponCode: null }, null, NOW), null, '쿠폰 없는 주문은 건드리지 않는다');
  assert.equal(couponOrderVerdict(order, row({ expires_at: '2026-09-01T00:00:00Z' }), NOW), 'coupon_expired', '만료된 쿠폰의 옛 주문(§13-10)');
  assert.equal(couponOrderVerdict(order, row({ disabled_at: 'x' }), NOW), 'coupon_disabled', '배치 회수');
  assert.equal(couponOrderVerdict(order, row({ released_at: 'x' }), NOW), 'coupon_disabled', '새 쿠폰으로 옮긴 옛 쿠폰(080)');
  assert.equal(couponOrderVerdict(order, row({ coupon_tiers: { percent: 10, max_discount_won: null, disabled_at: 'x' } }), NOW), 'coupon_disabled', '등급 회수');
  assert.equal(couponOrderVerdict(order, row({ coupon_tiers: null }), NOW), 'coupon_disabled', '등급 행 없음(요율 모름)');
  assert.equal(couponOrderVerdict(order, row({ bound_user_id: 'u2' }), NOW), 'coupon_not_bound', '24h 회수로 남에게 넘어감');
  assert.equal(couponOrderVerdict(order, row({ bound_user_id: null }), NOW), 'coupon_not_bound', '귀속 풀림');
  assert.equal(couponOrderVerdict(order, null, NOW), 'coupon_missing');
});

/** 가짜 서비스 — 테이블·조건이 맞을 때만 결과를 준다(코드를 잘못 넣는 변형도 걸리게). */
function fakeService(result: { data: unknown; error: { message: string } | null }) {
  let queries = 0;
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string, value: unknown) => ({
          maybeSingle: async () => {
            queries += 1;
            assert.equal(table, 'discount_coupons');
            assert.deepEqual([column, value], ['code', order.couponCode]);
            return result;
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, queries: () => queries };
}
const fresh = { approvalMayHaveBeenRequested: false, now: NOW };

test('닫힌 주문(canceled·expired·refunded)은 쿠폰과 무관하게 승인하지 않는다 — 원장이 확정을 못 받는다', async () => {
  const svc = fakeService({ data: row(), error: null });
  for (const status of ['canceled', 'expired', 'refunded'] as const) {
    assert.equal(await checkBeforePgApproval({ ...order, status }, { ...fresh, service: svc.client }), 'order_closed', status);
    assert.equal(await checkBeforePgApproval({ userId: 'u1', couponCode: null, status }, { ...fresh, service: svc.client }), 'order_closed', `${status}(쿠폰 없음)`);
    assert.equal(await checkBeforePgApproval({ ...order, status }, { ...fresh, approvalMayHaveBeenRequested: true, service: svc.client }), 'order_closed');
  }
  assert.equal(svc.queries(), 0);
});

test('쿠폰 검사 — 승인 요청 전 할인 주문만(재진입·실패 후 재시도 포함), 돈이 움직였거나 요청이 나갔을 수 있으면 건너뜀', async () => {
  for (const status of ['prepared', 'in_progress', 'payment_failed'] as const) {
    const dead = fakeService({ data: row({ expires_at: '2026-09-01T00:00:00Z' }), error: null });
    assert.equal(await checkBeforePgApproval({ ...order, status }, { ...fresh, service: dead.client }), 'coupon_expired', `${status}: 다시 들어와도 매번 검사`);
  }
  const skip = fakeService({ data: null, error: { message: 'x' } });
  for (const status of ['confirmed', 'fulfilling', 'fulfilled', 'fulfillment_failed'] as const) {
    assert.equal(await checkBeforePgApproval({ ...order, status }, { ...fresh, service: skip.client }), null, `${status}: 막으면 지급만 끊긴다`);
  }
  assert.equal(await checkBeforePgApproval({ ...order, status: 'in_progress' }, { ...fresh, approvalMayHaveBeenRequested: true, service: skip.client }), null, '결제 키가 붙은 뒤(승인 요청이 나갔을 수 있음)');
  assert.equal(await checkBeforePgApproval({ userId: 'u1', couponCode: null, status: 'prepared' }, { ...fresh, service: skip.client }), null, '일반 결제 회귀 0');
  assert.equal(skip.queries(), 0);

  const down = fakeService({ data: null, error: { message: 'timeout' } });
  assert.equal(await checkBeforePgApproval({ ...order, status: 'prepared' }, { ...fresh, service: down.client }), 'coupon_lookup_failed', '실패-닫힘');
  const ok = fakeService({ data: row(), error: null });
  assert.equal(await checkBeforePgApproval({ ...order, status: 'prepared' }, { ...fresh, service: ok.client }), null);
});

test('안내·응답 — 전부 "청구된 금액은 없습니다", 일시 장애만 503', () => {
  for (const block of ['order_closed', 'coupon_lookup_failed', 'coupon_expired', 'coupon_not_bound'] as const) {
    assert.ok(approvalBlockMessage(block).includes('청구된 금액은 없습니다'), block);
  }
  assert.equal(approvalBlockHttpStatus('coupon_lookup_failed'), 503);
  assert.equal(approvalBlockHttpStatus('coupon_expired'), 409);
});

// 호출 위치 불변식 — PG 승인 호출(confirmPayment·approveNicepayPayment)이 있는 **모든** 파일이 그 앞에서 관문을 돌리고,
//   막히면 주문 상태를 바꾸지 않고 멈춘다. 새 승인 경로가 생기면 여기서 걸린다(정산 경로 누락을 리뷰가 잡았다).
test('PG 승인 호출이 있는 모든 파일은 그보다 먼저 관문을 돌리고, 막히면 상태를 바꾸지 않는다', () => {
  const src = path.resolve(__dirname, '../..');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name) ? [full] : [];
    });
  const callers = walk(src).filter((f) => /\b(confirmPayment|approveNicepayPayment)\(/.test(fs.readFileSync(f, 'utf8').replace(/export async function \w+\(/g, '')));
  assert.deepEqual(
    callers.map((f) => path.relative(src, f)).sort(),
    ['app/api/payments/confirm/route.ts', 'app/api/payments/nicepay/return/route.ts', 'lib/payments/reconciliation.ts'],
    '승인 호출부 목록이 바뀌었다 — 새 경로에도 관문을 넣고 이 목록을 고쳐라'
  );
  for (const file of callers) {
    const text = fs.readFileSync(file, 'utf8');
    const gateAt = text.indexOf('await checkBeforePgApproval(');
    assert.ok(gateAt > 0, `${file}: 관문 호출이 없다`);
    // import 줄엔 괄호가 없으니 첫 등장 = 첫 호출. 결제 키 연결도 관문 뒤여야 한다(키가 붙으면 쿠폰 검사를 건너뛴다).
    for (const call of ['confirmPayment(', 'approveNicepayPayment(', 'attachPaymentKeyToOrder({']) {
      const at = text.indexOf(call);
      if (at >= 0) assert.ok(at > gateAt, `${file}: ${call} 가 관문보다 앞에 있다`);
    }
    // 라우트는 "결제 키가 붙었으면 승인 요청이 나갔을 수 있다", 정산은 토스 IN_PROGRESS(승인 전)에서만 false 로 부른다.
    const expected = file.endsWith('reconciliation.ts')
      ? /status === 'IN_PROGRESS'\) \{\s*const approvalBlock = await checkBeforePgApproval\(input\.order, \{ approvalMayHaveBeenRequested: false \}\)/
      : /checkBeforePgApproval\(order, \{ approvalMayHaveBeenRequested: Boolean\(order\.paymentKey\) \}\)/;
    assert.ok(expected.test(text), `${file}: 승인 요청 여부를 잘못 넘긴다`);
    const blockBody = text.slice(gateAt, text.indexOf('return', text.indexOf('if (approvalBlock)', gateAt)));
    assert.ok(text.includes('if (approvalBlock)'), `${file}: 관문 결과를 무시한다`);
    assert.ok(!/markPaymentOrder\w*\(/.test(blockBody), `${file}: 막힐 때 주문 상태를 바꾼다(재진입 시 검사를 건너뛰는 원인)`);
  }
});
