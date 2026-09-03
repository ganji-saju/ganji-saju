import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentFunnelStage } from '@/lib/payments/funnel-log';
import { buildPaymentFunnelSnapshot } from './payment-funnel-stats';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 최소 fake — .from().select().gte().lt().order().range(from,to) 체인.
// buildPaymentFunnelSnapshot 은 range 페이지네이션이라 rows(<1000) 는 첫 페이지에서 한 번에
// 반환하고 break 한다. 두 번째 페이지 이후는 빈 배열.
//
// 2026-08-27 — 테이블 별로 다른 체인을 준다. 예전엔 어느 테이블이든 같은 객체를 돌려줬는데,
//   환불액 합산(getRefundBreakdown → payment_orders)이 붙으면서 .eq/.lt/.limit 이 없어
//   TypeError 로 스냅샷 전체가 죽었다. 실제 클라이언트는 테이블마다 같은 빌더를 주므로
//   fake 도 '없는 메서드는 없다'가 아니라 '쿼리가 성립한다'를 흉내내야 한다.
function fakeFunnelService(rows: unknown[], refundRows: unknown[] = []): SupabaseClient {
  const funnel: Record<string, unknown> = {};
  funnel.select = () => funnel;
  funnel.gte = () => funnel;
  // 2026-09-01 — 기간 상한(.lt). 달력 기간 선택이 붙으면서 축 밖 행을 잘라낸다.
  funnel.lt = () => funnel;
  funnel.order = () => funnel;
  funnel.range = (from: number) =>
    Promise.resolve({ data: from === 0 ? rows : [], error: null });

  // payment_orders — 환불 집계(.eq.gte.lt.order.limit) + entry_source 역추적(.in).
  const orders: Record<string, unknown> = {};
  orders.select = () => orders;
  orders.eq = () => orders;
  orders.gte = () => orders;
  orders.lt = () => orders;
  orders.order = () => orders;
  orders.limit = () => Promise.resolve({ data: refundRows, error: null });
  orders.in = () => Promise.resolve({ data: [], error: null });

  return {
    from: (table: string) => (table === 'payment_orders' ? orders : funnel),
  } as unknown as SupabaseClient;
}

// stage 를 n 개 만든다. created_at 은 totals 집계에 무관(날짜는 dayMap 만 사용)하므로 고정값.
function events(
  spec: Array<{
    stage: PaymentFunnelStage;
    n: number;
    packageId?: string;
    reason?: string;
    amount?: number;
  }>
) {
  const rows: Array<{
    stage: string;
    package_id: string | null;
    reason: string | null;
    created_at: string;
    amount: number | null;
  }> = [];
  const iso = '2026-07-15T00:00:00.000Z';
  for (const { stage, n, packageId, reason, amount } of spec) {
    for (let i = 0; i < n; i += 1) {
      rows.push({
        stage,
        package_id: packageId ?? null,
        reason: reason ?? null,
        created_at: iso,
        amount: amount ?? null,
      });
    }
  }
  return rows;
}

// 🔴 회귀 가드 — 사용자 제보(2026-07-21): "결제 전환율이 시도 0건인데 0.0% 로 표시".
//   분모(prepare_attempt / confirm_attempt) 가 0 이면 전환율은 정의되지 않음 → null(화면 '—').
//   0 으로 강등하면 무트래픽 구간이 '전환 0%' 처럼 보여 판단을 흐린다.
//   대조군 analytics-metrics.ts 의 rate() 계약과 동일하게 맞춘다.
test('buildPaymentFunnelSnapshot: 시도 0건이면 전환율은 null(0.0% 아님)', async () => {
  const snap = await buildPaymentFunnelSnapshot(fakeFunnelService([]), { windowDays: 7 });
  assert.equal(snap.totals.overallConversionRate, null);
  assert.equal(snap.totals.confirmSuccessRate, null);
  assert.equal(snap.totals.prepareBlockRate, null);
  assert.equal(snap.totals.confirmFailRate, null);
  assert.deepEqual(snap.byPackage, []);
});

test('buildPaymentFunnelSnapshot: 정상 분모면 비율을 정확히 계산', async () => {
  const snap = await buildPaymentFunnelSnapshot(
    fakeFunnelService(
      events([
        { stage: 'prepare_attempt', n: 4, packageId: 'p1' },
        { stage: 'prepare_blocked', n: 1, reason: 'unauthenticated' },
        { stage: 'confirm_attempt', n: 3 },
        { stage: 'confirm_success', n: 2, packageId: 'p1' },
        { stage: 'confirm_failed', n: 1, reason: 'card_declined' },
      ])
    ),
    { windowDays: 7 }
  );
  assert.equal(snap.totals.overallConversionRate, 0.5); // 2/4
  assert.ok(Math.abs(snap.totals.confirmSuccessRate! - 2 / 3) < 1e-9);
  assert.equal(snap.totals.prepareBlockRate, 0.25); // 1/4
  assert.ok(Math.abs(snap.totals.confirmFailRate! - 1 / 3) < 1e-9);
  const p1 = snap.byPackage.find((p) => p.packageId === 'p1')!;
  assert.equal(p1.conversionRate, 0.5);
});

test('buildPaymentFunnelSnapshot: 패키지 시도 0건이면 conversionRate null', async () => {
  // confirm_success 만 있고 prepare_attempt 이 없는 이상 케이스 → 0.0% 가 아니라 null.
  const snap = await buildPaymentFunnelSnapshot(
    fakeFunnelService(events([{ stage: 'confirm_success', n: 1, packageId: 'ghost' }])),
    { windowDays: 7 }
  );
  const ghost = snap.byPackage.find((p) => p.packageId === 'ghost')!;
  assert.equal(ghost.prepareAttempt, 0);
  assert.equal(ghost.conversionRate, null);
});

// 🔴 회귀 가드 — 사용자 지시(2026-08-27): "결제된 것만 보여주면 안 될 것 같다".
//   결제액(gross)은 퍼널 이벤트, 환불액은 payment_orders 로 **출처가 다르다**. 둘 중
//   하나만 살아 있어도 화면은 그럴듯해 보이므로(=환불 0원), 같은 스냅샷에서 함께 단언한다.
//   gross 에 환불분이 남아 있는 것도 의도다 — 판 날 매출은 보존하고 순액에서만 뺀다(#641).
test('buildPaymentFunnelSnapshot: 결제액과 환불액을 함께 싣는다(gross 는 환불분 포함)', async () => {
  const todayIso = new Date().toISOString();
  const snap = await buildPaymentFunnelSnapshot(
    fakeFunnelService(
      events([{ stage: 'confirm_success', n: 2, packageId: 'p1', amount: 3300 }]),
      [
        {
          order_id: 'o1',
          package_id: 'p1',
          amount: 3300,
          refunded_at: todayIso,
          confirmed_at: todayIso,
          fulfilled_at: null,
          created_at: todayIso,
        },
      ]
    ),
    { windowDays: 30 }
  );
  assert.equal(snap.grossAmountWon, 6600);
  assert.equal(snap.refunds.totalWon, 3300);
  assert.equal(snap.refunds.items.length, 1);
  // 원 결제가 기간 안이면 순액만 깎이고 '기간 밖' 경고 금액은 0.
  assert.equal(snap.refunds.outsideWindowWon, 0);
});

// 2026-09-03 (migration 077) — 새 단계가 **집계에 실제로 들어오는지**.
//   payment-funnel-stats.ts 의 `if (!STAGES.includes(stage)) continue` 가 모르는 stage 를
//   조용히 버린다. 유니온·마이그레이션만 고치고 STAGES 를 빠뜨리면 DB 엔 쌓이는데 화면은 0 —
//   "기록이 안 된다"고 오진하고 로깅 코드를 다시 파게 된다(paywall_viewed 가 실제로 그랬다).
test('buildPaymentFunnelSnapshot: 페이월→체크아웃→로그인 벽 단계가 집계에 실린다', async () => {
  const snap = await buildPaymentFunnelSnapshot(
    fakeFunnelService(
      events([
        { stage: 'paywall_viewed', n: 40 },
        { stage: 'checkout_viewed', n: 9 },
        { stage: 'login_required', n: 6 },
        { stage: 'login_returned', n: 2 },
        { stage: 'prepare_attempt', n: 3 },
        { stage: 'confirm_success', n: 1 },
      ])
    ),
    { windowDays: 7 }
  );
  assert.equal(snap.totals.counts.paywall_viewed, 40);
  assert.equal(snap.totals.counts.checkout_viewed, 9);
  assert.equal(snap.totals.counts.login_required, 6);
  assert.equal(snap.totals.counts.login_returned, 2);
  // 로그인 벽 손실 = 벽에 튕긴 사람 − 돌아온 사람. 이 값이 이 계측을 넣은 이유다.
  assert.equal(snap.totals.counts.login_required - snap.totals.counts.login_returned, 4);
  // 기존 비율 계약은 그대로(분모는 여전히 prepare_attempt).
  assert.ok(Math.abs(snap.totals.overallConversionRate! - 1 / 3) < 1e-9);
});
