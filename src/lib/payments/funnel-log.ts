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
  /** 페이월이 사용자 화면에 렌더된 순간(migration 073). 퍼널의 분모. */
  | 'paywall_viewed'
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

/**
 * 2026-08-12 — 페이월 노출 기록. 퍼널의 **분모**를 만든다.
 *
 * 지금까지 기록은 prepare_attempt(결제창 도달)부터 시작해서, "결과를 본 사람 중 몇 %가
 * 페이월을 봤나"를 계산할 수 없었다(무료 조회는 readings, 결제는 payment_funnel_events 로
 * 테이블이 갈려 조인 불가). 그래서 "무료가 좋아서 안 산다" 가설을 검증할 수 없었다.
 *
 * logPaymentFunnelEvent 와 달리 SupabaseClient 인자를 받지 않는다 — 서버 컴포넌트에서
 * 부르기 위해서다(페이지가 supabase 클라이언트를 들고 있지 않아도 됨). service env 가
 * 없으면 조용히 no-op 한다(RLS 로 어차피 거부되고, 화면을 막을 이유가 없다).
 *
 * ⚠️ 호출부는 반드시 `after()` 로 감쌀 것 — 렌더 경로에서 await 하면 응답이 그만큼 늦는다.
 */
export async function logPaywallImpression(input: {
  packageId: string;
  /** 어떤 화면의 페이월인지. 예: 'saju-result' */
  surface: string;
  /** 리포트 식별자. 고유 노출 집계 시 count(distinct metadata->>'slug') 로 쓴다. */
  slug?: string | null;
  userId?: string | null;
}): Promise<void> {
  if (!hasSupabaseServiceEnv) return;
  try {
    const client = await createServiceClient();
    const { error } = await client.from('payment_funnel_events').insert({
      user_id: input.userId ?? null,
      stage: 'paywall_viewed' satisfies PaymentFunnelStage,
      package_id: input.packageId,
      metadata: { surface: input.surface, slug: input.slug ?? null },
    });
    if (error) {
      console.error('[funnel-log] paywall_viewed insert failed:', error.message);
    }
  } catch (err) {
    console.error('[funnel-log] paywall_viewed unexpected failure:', err);
  }
}
