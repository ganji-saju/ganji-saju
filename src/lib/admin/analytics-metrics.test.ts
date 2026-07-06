import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDailyMetrics } from './analytics-metrics';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 최소 fake — .from().select().gte().lte().order() 체인을 await 하면 {data,error} 반환.
function fakeService(rows: unknown[]): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.gte = () => chain;
  chain.lte = () => chain;
  chain.order = () => Promise.resolve({ data: rows, error: null });
  return { from: () => chain } as unknown as SupabaseClient;
}

const NOW = new Date('2026-07-07T05:00:00Z'); // KST 07-07 14:00 → 축 07-05..07-07

test('getDailyMetrics: 결측일 gap-fill + 전환율 파생(0 분모 null) + 유입 집계', async () => {
  const service = fakeService([
    {
      date_key: '2026-07-06',
      visitors: 10,
      page_views: 20,
      new_signups: 2,
      paid_orders: 1,
      revenue_won: 9900,
      prepare_attempts: 4,
      checkout_starts: 3,
      confirm_success: 2,
      inflow_referrers: [
        { host: 'google.com', visitors: 6 },
        { host: 'naver.com', visitors: 3 },
      ],
      inflow_utm: [{ source: 'naver', medium: 'cpc', campaign: 'promo', visitors: 2 }],
      refreshed_at: '2026-07-07T05:00:00Z',
    },
    {
      date_key: '2026-07-07',
      visitors: 5,
      page_views: 8,
      new_signups: 1,
      paid_orders: 0,
      revenue_won: 0,
      prepare_attempts: 0,
      checkout_starts: 0,
      confirm_success: 0,
      inflow_referrers: [{ host: 'google.com', visitors: 2 }],
      inflow_utm: [],
      refreshed_at: '2026-07-07T06:00:00Z',
    },
  ]);

  const snap = await getDailyMetrics(service, 3, NOW);

  // 축 + gap-fill
  assert.deepEqual(snap.daily.map((d) => d.date), ['2026-07-05', '2026-07-06', '2026-07-07']);
  assert.equal(snap.daily[0]!.visitors, 0); // 07-05 결측 → 0
  assert.equal(snap.daily[0]!.visitorToPaidRate, null); // 0 방문 → null
  assert.equal(snap.daily[0]!.checkoutConversionRate, null);

  // 07-06 전환율
  assert.ok(Math.abs(snap.daily[1]!.visitorToPaidRate! - 0.1) < 1e-9);
  assert.equal(snap.daily[1]!.checkoutConversionRate, 0.5);

  // 07-07: 방문 있으나 결제 0 → 0(‌null 아님), prepare 0 → 전환 null
  assert.equal(snap.daily[2]!.visitorToPaidRate, 0);
  assert.equal(snap.daily[2]!.checkoutConversionRate, null);

  // 합계 + 파생
  assert.equal(snap.totals.visitors, 15);
  assert.equal(snap.totals.paidOrders, 1);
  assert.ok(Math.abs(snap.totals.visitorToPaidRate! - 1 / 15) < 1e-9);
  assert.equal(snap.totals.checkoutConversionRate, 0.5);

  // 유입 집계(윈도우 합산)
  assert.deepEqual(snap.topReferrers[0], { key: 'google.com', label: 'google.com', visitors: 8 });
  assert.deepEqual(snap.topReferrers[1], { key: 'naver.com', label: 'naver.com', visitors: 3 });
  assert.equal(snap.topUtm[0]!.label, 'naver / cpc / promo');
  assert.equal(snap.topUtm[0]!.visitors, 2);

  // 신선도 = 최신
  assert.equal(snap.refreshedAt, '2026-07-07T06:00:00Z');
  assert.equal(snap.hasData, true);
});

test('getDailyMetrics: 데이터 없으면 hasData=false, 그래도 축은 채워짐', async () => {
  const snap = await getDailyMetrics(fakeService([]), 30, NOW);
  assert.equal(snap.daily.length, 30);
  assert.equal(snap.hasData, false);
  assert.equal(snap.totals.visitors, 0);
  assert.equal(snap.refreshedAt, null);
  assert.deepEqual(snap.topReferrers, []);
});

test('getDailyMetrics: windowDays 범위 클램프(1..365)', async () => {
  const big = await getDailyMetrics(fakeService([]), 9999, NOW);
  assert.equal(big.windowDays, 365);
  assert.equal(big.daily.length, 365);
  const small = await getDailyMetrics(fakeService([]), 0, NOW);
  assert.equal(small.windowDays, 30); // 0 → 기본 30
});
