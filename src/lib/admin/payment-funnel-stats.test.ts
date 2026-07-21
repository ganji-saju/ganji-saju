import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentFunnelStage } from '@/lib/payments/funnel-log';
import { buildPaymentFunnelSnapshot } from './payment-funnel-stats';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// 최소 fake — .from().select().gte().order().range(from,to) 체인.
// buildPaymentFunnelSnapshot 은 range 페이지네이션이라 rows(<1000) 는 첫 페이지에서 한 번에
// 반환하고 break 한다. 두 번째 페이지 이후는 빈 배열.
function fakeFunnelService(rows: unknown[]): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.gte = () => chain;
  chain.order = () => chain;
  chain.range = (from: number) =>
    Promise.resolve({ data: from === 0 ? rows : [], error: null });
  return { from: () => chain } as unknown as SupabaseClient;
}

// stage 를 n 개 만든다. created_at 은 totals 집계에 무관(날짜는 dayMap 만 사용)하므로 고정값.
function events(
  spec: Array<{ stage: PaymentFunnelStage; n: number; packageId?: string; reason?: string }>
) {
  const rows: Array<{
    stage: string;
    package_id: string | null;
    reason: string | null;
    created_at: string;
  }> = [];
  const iso = '2026-07-15T00:00:00.000Z';
  for (const { stage, n, packageId, reason } of spec) {
    for (let i = 0; i < n; i += 1) {
      rows.push({
        stage,
        package_id: packageId ?? null,
        reason: reason ?? null,
        created_at: iso,
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
