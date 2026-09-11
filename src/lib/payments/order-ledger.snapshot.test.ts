import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPaymentOrder } from './order-ledger';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// insert(payload).select().single() 체인을 캡처하는 fake.
function fakeService(capture: { payload?: Record<string, unknown> }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.insert = (payload: Record<string, unknown>) => {
    capture.payload = payload;
    return chain;
  };
  chain.select = () => chain;
  chain.single = () =>
    Promise.resolve({ data: { order_id: 'o1', ...capture.payload }, error: null });
  return { from: () => chain } as unknown as SupabaseClient;
}

test('createPaymentOrder: 쿠폰 없으면 order.amount = 전달된 정가(카탈로그 price 아님)', async () => {
  const capture: { payload?: Record<string, unknown> } = {};
  const service = fakeService(capture);
  const pkg = getPackage('taste_today_detail')!;
  await createPaymentOrder(
    {
      userId: 'u1',
      pkg,
      listAmount: 12345, // 카탈로그 9900 과 다른 스냅샷.
      coupon: null,
      acceptedKinds: [],
      recordedPolicyVersionIds: [],
    },
    service
  );
  assert.equal(capture.payload?.amount, 12345, '할인 없으면 정가 그대로 청구');
  assert.equal(capture.payload?.list_amount, 12345);
  assert.equal(capture.payload?.discount_won, 0);
  assert.equal(capture.payload?.coupon_code, null);
  assert.equal(capture.payload?.package_id, 'taste_today_detail');
});

// 🔴 할인이 금액이 되는 유일한 지점이 이 함수 안이라는 것을 고정한다.
//   호출부가 할인을 계산해 넘기는 구조로 되돌아가면 경로마다 어긋난다.
test('createPaymentOrder: 쿠폰이 있으면 함수 안에서 할인해 amount 에 실청구액을 넣는다', async () => {
  const capture: { payload?: Record<string, unknown> } = {};
  const service = fakeService(capture);
  const pkg = getPackage('taste_today_detail')!;
  await createPaymentOrder(
    {
      userId: 'u1',
      pkg,
      listAmount: 3300,
      coupon: { code: 'ganji300001', percent: 30 },
      acceptedKinds: [],
      recordedPolicyVersionIds: [],
    },
    service
  );
  assert.equal(capture.payload?.amount, 2310, '3,300 × 30% = 990 할인 → 2,310 청구');
  assert.equal(capture.payload?.list_amount, 3300);
  assert.equal(capture.payload?.discount_won, 990);
  assert.equal(capture.payload?.coupon_code, 'ganji300001');
  assert.equal(capture.payload?.coupon_percent, 30);
});

test('createPaymentOrder: 상한 50% 는 호출부가 뭘 넘기든 이 함수가 자른다', async () => {
  const capture: { payload?: Record<string, unknown> } = {};
  const service = fakeService(capture);
  const pkg = getPackage('taste_today_detail')!;
  await createPaymentOrder(
    {
      userId: 'u1',
      pkg,
      listAmount: 3300,
      coupon: { code: 'ganji500001', percent: 90 }, // DB 직수정·버그로 90 이 들어와도
      acceptedKinds: [],
      recordedPolicyVersionIds: [],
    },
    service
  );
  assert.equal(capture.payload?.amount, 1650, '50% 로 clamp 되어야 한다');
  assert.equal(capture.payload?.coupon_percent, 50);
});
