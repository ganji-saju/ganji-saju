// 2026-05-16 PR (B1) — payment_funnel_events 테이블에 단계별 이벤트 기록.
// prepare / confirm route 에서 호출. 실패해도 결제 흐름은 차단하지 않는다 (best-effort).
import type { SupabaseClient } from '@supabase/supabase-js';

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
 * Insert one funnel event. Errors are swallowed — payment flow must not be
 * interrupted by analytics logging.
 */
export async function logPaymentFunnelEvent(
  supabase: SupabaseClient,
  input: PaymentFunnelEventInput
): Promise<void> {
  try {
    await supabase.from('payment_funnel_events').insert({
      user_id: input.userId ?? null,
      stage: input.stage,
      package_id: input.packageId ?? null,
      amount: input.amount ?? null,
      reason: input.reason ?? null,
      order_id: input.orderId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch {
    // best-effort. 결제 흐름 차단 금지.
  }
}
