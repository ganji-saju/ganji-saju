// 2026-08-26 — 확정된 주문 하나를 GA4 로 내보내는 디스패처(멱등).
//
//   호출 지점이 여럿이다(confirm 라우트 · 나이스페이 return · 정산 크론). 어디서 몇 번을
//   불러도 한 번만 나가야 하므로 **DB 플래그를 먼저 선점**하고 전송한다. 전송이 실패하면
//   플래그를 되돌려 다음 호출이 다시 집도록 한다.
//
//   결제 흐름을 절대 막지 않는다 — 계측 실패로 결제가 깨지면 본말전도다.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { getPackage, isBundlePackage, isSubscriptionPackage } from '@/lib/payments/catalog';
import { sendGaPurchase, sendGaRefund, type GaPurchaseItem, type GaSendResult } from './ga-server';
import { hasGa4ServerEnv } from './ga-config';

interface GaOrderRow {
  order_id: string;
  user_id: string | null;
  package_id: string | null;
  amount: number | null;
  payment_method_code: string | null;
  ga_client_id: string | null;
  ga_session_id: string | null;
  analytics_consent: string | null;
}

const ORDER_COLUMNS =
  'order_id, user_id, package_id, amount, payment_method_code, ga_client_id, ga_session_id, analytics_consent';

/** 결제 이력이 있는 것으로 보는 종료 상태. 환불된 과거 결제도 '첫 구매 아님' 으로 센다. */
const PURCHASED_STATUSES = ['confirmed', 'fulfilling', 'fulfilled', 'refunded'];

/**
 * 이번 결제가 이 사용자의 첫 결제인가. 모르면 **null 을 그대로 둔다** —
 * 추측해서 true 를 넣으면 신규 CAC 가 부풀고, false 를 넣으면 신규가 사라진다.
 */
async function resolveIsFirstPurchase(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  userId: string | null,
  orderId: string
): Promise<boolean | null> {
  if (!userId) return null;
  const { count, error } = await service
    .from('payment_orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', PURCHASED_STATUSES)
    .neq('order_id', orderId);
  if (error) return null;
  return (count ?? 0) === 0;
}

/** 상품 계열 — item_id 와 같은 값을 넣으면 계열별 매출 분해가 안 된다. */
function resolveItemCategory(packageId: string): string {
  const pkg = getPackage(packageId);
  if (!pkg) return 'unknown';
  if (isBundlePackage(pkg)) return 'bundle';
  if (isSubscriptionPackage(pkg)) return 'membership';
  return pkg.kind;
}

function buildItems(packageId: string, amount: number): GaPurchaseItem[] {
  const pkg = getPackage(packageId);
  return [
    {
      itemId: packageId,
      itemName: pkg?.name ?? packageId,
      itemCategory: resolveItemCategory(packageId),
      // value = Σ(price × quantity) 계약을 지키려면 카탈로그 정가가 아니라 **실결제액**을 쓴다
      // (가격 오버라이드·이벤트가·쿠폰이 있으면 정가와 다르다).
      price: amount,
      quantity: 1,
    },
  ];
}

/**
 * 확정 주문의 purchase 전송. 이미 보냈거나 env·동의가 없으면 조용히 건너뛴다.
 * ⚠️ 호출부는 await 하되 예외를 삼킨다(내부에서도 던지지 않는다).
 */
export async function dispatchGaPurchase(orderId: string): Promise<GaSendResult> {
  if (!hasGa4ServerEnv || !hasSupabaseServiceEnv) return { sent: false, skipped: 'no_env' };

  try {
    const service = await createServiceClient();
    // 선점: ga_purchase_sent_at 이 비어 있는 행만 잡는다 → 재전송·동시호출에도 1회.
    const { data, error } = await service
      .from('payment_orders')
      .update({ ga_purchase_sent_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .is('ga_purchase_sent_at', null)
      .select(ORDER_COLUMNS)
      .maybeSingle();

    if (error) return { sent: false, skipped: 'error', error: error.message };
    if (!data) return { sent: false, skipped: 'error', error: 'already_sent_or_missing' };

    const row = data as GaOrderRow;
    const packageId = row.package_id ?? '(unknown)';
    const amount = Math.max(0, Number(row.amount) || 0);

    const isFirstPurchase = await resolveIsFirstPurchase(service, row.user_id, row.order_id);

    const result = await sendGaPurchase({
      clientId: row.ga_client_id,
      sessionId: row.ga_session_id,
      userId: row.user_id,
      transactionId: row.order_id,
      value: amount,
      paymentMethod: row.payment_method_code,
      productType: packageId,
      isFirstPurchase,
      items: buildItems(packageId, amount),
      consent: row.analytics_consent,
    });

    if (!result.sent && result.skipped === 'error') {
      // 네트워크·5xx 는 되돌려서 다음 호출(정산 크론)이 다시 집게 한다.
      // no_client_id·consent_denied 는 되돌리지 않는다 — 다시 시도해도 같은 결론이라
      // 크론이 매번 헛돌 뿐이다.
      await service
        .from('payment_orders')
        .update({ ga_purchase_sent_at: null })
        .eq('order_id', orderId);
      console.error('[ga-mp] purchase failed', { orderId, error: result.error });
    }
    return result;
  } catch (err) {
    console.error('[ga-mp] purchase dispatch threw', {
      orderId,
      error: err instanceof Error ? err.message : err,
    });
    return { sent: false, skipped: 'error', error: 'threw' };
  }
}

/**
 * 환불 전송. 원거래와 **같은 transaction_id** 여야 GA4 가 그 거래의 매출을 차감한다.
 * 부분 환불은 같은 키 + 환불 금액만 보낸다.
 */
export async function dispatchGaRefund(
  orderId: string,
  refundedAmount: number
): Promise<GaSendResult> {
  if (!hasGa4ServerEnv || !hasSupabaseServiceEnv) return { sent: false, skipped: 'no_env' };

  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from('payment_orders')
      .update({ ga_refund_sent_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .is('ga_refund_sent_at', null)
      .select(ORDER_COLUMNS)
      .maybeSingle();

    if (error) return { sent: false, skipped: 'error', error: error.message };
    if (!data) return { sent: false, skipped: 'error', error: 'already_sent_or_missing' };

    const row = data as GaOrderRow;
    const result = await sendGaRefund({
      clientId: row.ga_client_id,
      sessionId: row.ga_session_id,
      userId: row.user_id,
      transactionId: row.order_id,
      value: Math.max(0, Number(refundedAmount) || 0),
      consent: row.analytics_consent,
    });

    if (!result.sent && result.skipped === 'error') {
      await service
        .from('payment_orders')
        .update({ ga_refund_sent_at: null })
        .eq('order_id', orderId);
      console.error('[ga-mp] refund failed', { orderId, error: result.error });
    }
    return result;
  } catch (err) {
    console.error('[ga-mp] refund dispatch threw', {
      orderId,
      error: err instanceof Error ? err.message : err,
    });
    return { sent: false, skipped: 'error', error: 'threw' };
  }
}
