// 2026-05-16 PR (B1) — payment_funnel_events 테이블에 단계별 이벤트 기록.
// prepare / confirm route 에서 호출. 실패해도 결제 흐름은 차단하지 않는다 (best-effort).
//
// 2026-07-04 admin 지표 전수감사 — 근본 결함 수정:
//   payment_funnel_events 는 RLS enable + 'admin select' 정책만 있고 INSERT 정책이
//   없어(migration 030), 세션(anon/authenticated) 클라이언트의 insert 가 전부 조용히
//   거부되고 있었다(퍼널 대시보드가 비는 직접 원인). 호출부 시그니처는 유지하되
//   내부에서 service-role 클라이언트로 기록하고, 실패는 로그로 관측한다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export type PaymentFunnelStage =
  | 'prepare_attempt'
  | 'prepare_blocked'
  | 'prepare_ready'
  | 'confirm_attempt'
  | 'confirm_success'
  | 'confirm_failed';

export interface PaymentFunnelEventInput {
  stage: PaymentFunnelStage;
  userId?: string | null;
  packageId?: string | null;
  amount?: number | null;
  reason?: string | null;
  orderId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Insert one funnel event. Errors are logged but never thrown — payment flow
 * must not be interrupted by analytics logging.
 * `supabase` 인자는 service env 부재 시 폴백용으로만 사용된다(RLS 로 거부될 수 있음).
 */
export async function logPaymentFunnelEvent(
  supabase: SupabaseClient,
  input: PaymentFunnelEventInput
): Promise<void> {
  try {
    const client = hasSupabaseServiceEnv ? await createServiceClient() : supabase;
    const { error } = await client.from('payment_funnel_events').insert({
      user_id: input.userId ?? null,
      stage: input.stage,
      package_id: input.packageId ?? null,
      amount: input.amount ?? null,
      reason: input.reason ?? null,
      order_id: input.orderId ?? null,
      metadata: input.metadata ?? null,
    });
    if (error) {
      console.error('[funnel-log] insert failed:', input.stage, error.message);
    }
  } catch (err) {
    // best-effort. 결제 흐름 차단 금지 — 단, 관측은 남긴다.
    console.error('[funnel-log] unexpected failure:', input.stage, err);
  }
}
