// 할인쿠폰 PR4 — 할인 주문의 PG 승인 **직전** 재검증(설계 docs/discount-coupon-design.md §5-3).
//
// 왜 필요한가: payment_orders.expires_at 을 보는 곳은 정산 크론뿐이라, 할인가가 박힌 prepared 주문은 결제창을
//   다시 열면 **무기한 승인 가능**했다. 캠페인 종료·코드 회수(disabled_at)·등급 회수·다른 쿠폰으로 옮김(released_at)
//   이후에도 옛 주문이 옛 할인가로 승인된다. 금액 대조 때문에 "정가로 재승인"은 불가 → **승인 거부**가 맞다.
//   fulfillPaymentOrder 는 승인 **이후**라 늦다.
//
// 범위: 쿠폰이 붙은 주문만(일반 결제 회귀 0), 그리고 **아직 승인 전**인 주문만 — 이미 PG 승인이 난 주문을 막으면
//   돈은 나갔는데 지급이 안 된다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { COUPON_ROW_COLUMNS, couponDeadReason, type CouponRow } from '@/lib/coupons/discount-coupon';
import type { PaymentOrder } from './order-ledger';

export type CouponOrderRejectReason =
  | 'coupon_lookup_failed'
  | 'coupon_missing'
  | 'coupon_disabled'
  | 'coupon_expired'
  | 'coupon_not_bound';

type GuardOrder = Pick<PaymentOrder, 'userId' | 'couponCode' | 'status'>;

/**
 * 순수 판정 — 이 할인 주문을 지금 승인해도 되는가. 거부 사유 또는 null.
 * 죽음 판정은 couponDeadReason **그대로**(released_at·등급 disabled_at 포함 — 빠지면 "되살려도 부활하지 않는다"
 * (§11 E)가 옛 prepared 주문에서 깨진다). 귀속자가 바뀌었으면(24h 회수로 남에게 넘어감) 이 주문의 할인은 무효다.
 */
export function couponOrderVerdict(
  order: Pick<GuardOrder, 'userId' | 'couponCode'>,
  row: CouponRow | null,
  now: Date
): CouponOrderRejectReason | null {
  if (!order.couponCode) return null;
  if (!row) return 'coupon_missing';
  const dead = couponDeadReason(row, now);
  if (dead) return dead === 'expired' ? 'coupon_expired' : 'coupon_disabled';
  if (row.bound_user_id !== order.userId) return 'coupon_not_bound';
  return null;
}

/** PG 승인이 아직 안 난 상태. 이 밖(confirmed 이후)은 돈이 움직였으므로 막지 않는다. */
const PRE_APPROVAL_STATUSES: ReadonlySet<PaymentOrder['status']> = new Set(['prepared', 'in_progress']);

/**
 * 토스 confirm · 나이스페이 return 이 PG 승인 호출 **직전**에 부른다. 거부 사유가 나오면 승인하지 말 것.
 * 조회 실패는 거부(실패-닫힘) — 할인 주문을 확인 없이 승인하면 이 가드가 없는 것과 같다. 사용자는 결제 화면을 다시 열면 된다.
 */
export async function checkCouponOrderBeforeApproval(
  order: GuardOrder,
  opts: { service?: SupabaseClient; now?: Date } = {}
): Promise<CouponOrderRejectReason | null> {
  if (!order.couponCode || !PRE_APPROVAL_STATUSES.has(order.status)) return null;
  const service = opts.service ?? (await createServiceClient());
  const { data, error } = await service
    .from('discount_coupons')
    .select(COUPON_ROW_COLUMNS)
    .eq('code', order.couponCode)
    .maybeSingle();
  if (error) {
    console.error('[coupon-order-guard] discount_coupons 조회 실패', error.message);
    return 'coupon_lookup_failed';
  }
  return couponOrderVerdict(order, (data as unknown as CouponRow | null) ?? null, opts.now ?? new Date());
}

/** 사용자 안내. 이 주문은 취소되고, 결제 화면을 다시 열면 지금 적용되는 금액으로 새로 결제한다. */
export function couponOrderRejectMessage(reason: CouponOrderRejectReason): string {
  return reason === 'coupon_lookup_failed'
    ? '쿠폰을 확인하지 못해 결제를 멈췄어요. 결제 화면을 다시 열어 주세요. 결제된 금액은 없습니다.'
    : '쿠폰 사용 기간이 끝났거나 회수되어 이 할인가로는 결제할 수 없어요. 결제 화면을 다시 열면 지금 금액으로 결제할 수 있어요. 결제된 금액은 없습니다.';
}
