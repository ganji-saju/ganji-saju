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

test('createPaymentOrder: order.amount = 전달된 스냅샷 amount(카탈로그 price 아님)', async () => {
  const capture: { payload?: Record<string, unknown> } = {};
  const service = fakeService(capture);
  const pkg = getPackage('taste_today_detail')!;
  await createPaymentOrder(
    {
      userId: 'u1',
      pkg,
      amount: 12345, // 카탈로그 9900 과 다른 스냅샷.
      acceptedKinds: [],
      recordedPolicyVersionIds: [],
    },
    service
  );
  assert.equal(capture.payload?.amount, 12345);
  assert.equal(capture.payload?.package_id, 'taste_today_detail');
});
