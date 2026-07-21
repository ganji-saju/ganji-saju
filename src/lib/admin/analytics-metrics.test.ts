import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assessDailyMetricsFreshness, getDailyMetrics } from './analytics-metrics';

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
  // 2026-07-20 — self-referral 제외 가드. 우리 도메인은 유입이 아니라 **내부 이동**이라
  //   "어디서 왔나" 목록에 뜨면 판단을 흐린다. canonical·별칭(www·퓨니코드) 모두 제외 대상.
  assert.ok(
    !snap.topReferrers.some((r) => /ganjisaju\.kr$|xn--s39at50bo6fmwa\.kr$/.test(r.key)),
    '자기 도메인이 유입 상위에 남아 있다(self-referral)'
  );
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

test('assessDailyMetricsFreshness: 오늘 행이 없으면 자동 롤업 대상', () => {
  const result = assessDailyMetricsFreshness(
    [{ date_key: '2026-07-06', refreshed_at: '2026-07-06T18:00:00.000Z' }],
    new Date('2026-07-07T05:00:00Z')
  );

  assert.equal(result.todayKey, '2026-07-07');
  assert.equal(result.shouldRefresh, true);
  assert.equal(result.reason, 'missing_today');
  assert.equal(result.refreshedAt, null);
});

test('assessDailyMetricsFreshness: 오늘 행이 있어도 KST 자정 전 갱신이면 stale', () => {
  const result = assessDailyMetricsFreshness(
    [{ date_key: '2026-07-07', refreshed_at: '2026-07-06T14:59:59.000Z' }],
    new Date('2026-07-07T05:00:00Z')
  );

  assert.equal(result.shouldRefresh, true);
  assert.equal(result.reason, 'stale_today');
});

test('assessDailyMetricsFreshness: 오늘 행이 6시간 이내 갱신이면 fresh', () => {
  const result = assessDailyMetricsFreshness(
    [{ date_key: '2026-07-07', refreshed_at: '2026-07-07T04:00:00.000Z' }],
    new Date('2026-07-07T05:00:00Z')
  );

  assert.equal(result.shouldRefresh, false);
  assert.equal(result.reason, 'fresh');
});

test('assessDailyMetricsFreshness: 오늘 행이 6시간 넘게 오래되면 stale', () => {
  const result = assessDailyMetricsFreshness(
    [{ date_key: '2026-07-07', refreshed_at: '2026-07-07T00:00:00.000Z' }],
    new Date('2026-07-07T07:00:01Z')
  );

  assert.equal(result.shouldRefresh, true);
  assert.equal(result.reason, 'stale_today');
});

// 2026-07-20 — self-referral 제외를 픽스처로 직접 확인.
//   '(direct)'(referrer 없음)는 **남겨야 한다** — 링크 없이 직접 들어온 실제 유입 신호다.
test('getDailyMetrics: 자기 도메인은 유입에서 빼고 (direct) 는 남긴다', async () => {
  const snap = await getDailyMetrics(
    fakeService([
      {
        date_key: '2026-07-07',
        visitors: 10,
        page_views: 20,
        new_signups: 0,
        paid_orders: 0,
        revenue_won: 0,
        prepare_attempts: 0,
        checkout_starts: 0,
        confirm_success: 0,
        inflow_referrers: [
          { host: 'ganjisaju.kr', visitors: 5 },
          { host: 'www.ganjisaju.kr', visitors: 2 },
          { host: 'xn--s39at50bo6fmwa.kr', visitors: 1 },
          { host: '(direct)', visitors: 4 },
          { host: 'link.inpock.co.kr', visitors: 9 },
        ],
        inflow_utm: [],
        refreshed_at: null,
      },
    ]),
    30,
    NOW
  );
  const keys = snap.topReferrers.map((r) => r.key);
  assert.deepEqual(keys, ['link.inpock.co.kr', '(direct)'], `실제: ${keys.join(', ')}`);
});

// 2026-07-21 — 🔴 환불 반영 가드. 사용자 제보: "환불했는데 관리자 매출에 그대로 잡힌다".
//   원인: metrics_daily 는 refunded_won 을 별도 컬럼에 정확히 기록하는데(롤업 OK),
//   조회(getDailyMetrics)가 revenue_won 만 읽고 refunded_won 을 무시했다. 화면이 그 revenue_won 을
//   그렸으니 환불이 안 보였다. 순매출 = 매출 − 환불 이 화면 기준이어야 한다.
test('getDailyMetrics: 환불이 순매출에서 차감된다', async () => {
  const snap = await getDailyMetrics(
    fakeService([
      {
        date_key: '2026-07-06',
        visitors: 3,
        page_views: 5,
        new_signups: 0,
        paid_orders: 1,
        revenue_won: 9900,
        refunded_orders: 1,
        refunded_won: 9900, // 판 날 환불까지 발생 → net 0
        prepare_attempts: 0,
        checkout_starts: 0,
        confirm_success: 0,
        inflow_referrers: [],
        inflow_utm: [],
        refreshed_at: null,
      },
      {
        date_key: '2026-07-07',
        visitors: 2,
        page_views: 4,
        new_signups: 0,
        paid_orders: 1,
        revenue_won: 3300,
        refunded_orders: 0,
        refunded_won: 0,
        prepare_attempts: 0,
        checkout_starts: 0,
        confirm_success: 0,
        inflow_referrers: [],
        inflow_utm: [],
        refreshed_at: null,
      },
    ]),
    30,
    NOW
  );
  const d6 = snap.daily.find((d) => d.date === '2026-07-06')!;
  assert.equal(d6.revenueWon, 9900);
  assert.equal(d6.refundedWon, 9900);
  assert.equal(d6.netRevenueWon, 0, '환불 전액이면 그날 순매출은 0');

  // 합계: 매출 13,200 − 환불 9,900 = 순매출 3,300
  assert.equal(snap.totals.revenueWon, 13200);
  assert.equal(snap.totals.refundedWon, 9900);
  assert.equal(snap.totals.netRevenueWon, 3300, '순매출은 매출에서 환불을 뺀 값이어야 한다');
});

test('getDailyMetrics: 환불 컬럼 결측이면 0 으로 안전 처리', async () => {
  // 롤업 이전 데이터 등 refunded_* 가 없어도 순매출 = 매출이 된다(터지지 않음).
  const snap = await getDailyMetrics(
    fakeService([
      {
        date_key: '2026-07-06',
        visitors: 1,
        page_views: 1,
        new_signups: 0,
        paid_orders: 1,
        revenue_won: 3300,
        prepare_attempts: 0,
        checkout_starts: 0,
        confirm_success: 0,
        inflow_referrers: [],
        inflow_utm: [],
        refreshed_at: null,
      },
    ]),
    30,
    NOW
  );
  const d = snap.daily.find((x) => x.date === '2026-07-06')!;
  assert.equal(d.refundedWon, 0);
  assert.equal(d.netRevenueWon, 3300);
});
