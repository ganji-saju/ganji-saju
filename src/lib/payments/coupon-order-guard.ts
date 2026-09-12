// PG 승인 **직전** 공통 관문 — 할인쿠폰 PR4(설계 docs/discount-coupon-design.md §5-3) + 닫힌 주문 승인 차단.
//
// 호출부는 PG 승인 호출 3곳 전부다: 토스 confirm · 나이스페이 return · 정산(settlePaymentOrderFromToss, 토스 IN_PROGRESS).
//
// 1) 닫힌 주문(canceled·expired·refunded)은 승인하지 않는다 — 원장(markPaymentOrderConfirmed)이 이 상태의 승인 확정을 받지
//    않아, 승인을 내면 **청구만 되고 기록·지급이 안 된다**(인증을 늦게 마친 만료 주문 등 — 쿠폰과 무관한 기존 구멍).
// 2) 할인 주문은 쿠폰이 아직 살아 있고 주문 주인에게 귀속돼 있는지 다시 본다. 할인가가 박힌 주문은 결제창을 다시 열면
//    캠페인 종료·배치/등급 회수·다른 쿠폰으로 옮김 뒤에도 옛 할인가로 승인됐다. 정가 재승인은 금액 대조로 불가 → 거부.
//
// 🔴 거부해도 **주문 상태를 바꾸지 않는다**(2026-09-12 리뷰): 거부하며 canceled 로 닫았더니, 같은 주문이 다시 들어올 때
//   (결제 성공 화면 새로고침) 검사 대상에서 빠져 승인이 나가고, 원장은 canceled 를 확정하지 못해 **돈만 빠졌다**.
//   상태를 그대로 두면 재진입마다 같은 검사가 돌고, 동시에 도는 요청이 이미 지급된 주문을 덮어쓰지도 않는다.
// PG 는 승인 요청이 없으면 청구하지 않는다 — 토스: IN_PROGRESS(인증 완료)는 미청구, 10분 안에 승인 안 하면 만료(공식 문서) ·
//   나이스페이: "승인 API를 호출하지 않는 경우 결제(승인)이 발생되지 않습니다"(공식 매뉴얼 Server 승인 모델).
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

export type ApprovalBlock = 'order_closed' | CouponOrderRejectReason;

type GuardOrder = Pick<PaymentOrder, 'userId' | 'couponCode' | 'status'>;

/**
 * 순수 판정 — 이 할인 주문의 쿠폰이 지금도 유효한가. 거부 사유 또는 null.
 * 죽음 판정은 couponDeadReason **그대로**(released_at·등급 disabled_at 포함 — 빠지면 "되살려도 부활하지 않는다"
 * (§11 E)가 옛 주문에서 깨진다). 귀속자가 바뀌었으면(24h 회수로 남에게 넘어감) 이 주문의 할인은 무효다.
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

/** 원장이 승인 확정을 받지 않는 상태(markPaymentOrderConfirmed 대상 밖) — 여기서 승인하면 청구만 된다. */
const CLOSED_FOR_APPROVAL: ReadonlySet<PaymentOrder['status']> = new Set(['canceled', 'expired', 'refunded']);
/** PG 승인이 이미 난 상태 — 쿠폰을 다시 볼 이유가 없고, 막으면 지급만 끊긴다. */
const MONEY_MOVED: ReadonlySet<PaymentOrder['status']> = new Set(['confirmed', 'fulfilling', 'fulfilled', 'fulfillment_failed']);

/**
 * PG 승인 호출 **직전**에 부른다. 막을 이유가 있으면 그 사유, 아니면 null. 막히면 승인하지 말고 **상태도 바꾸지 말 것**.
 * @param approvalMayHaveBeenRequested 이 주문으로 PG 승인 요청이 이미 나갔을 수 있는가(토스: 결제 키가 붙은 뒤 — 쿠폰 검사는
 *   그 첫 요청 전에 이미 통과했다). 이때 쿠폰을 막으면 이미 청구된 결제를 "청구 없음"으로 안내하게 된다.
 */
export async function checkBeforePgApproval(
  order: GuardOrder,
  opts: { approvalMayHaveBeenRequested: boolean; service?: SupabaseClient; now?: Date }
): Promise<ApprovalBlock | null> {
  if (CLOSED_FOR_APPROVAL.has(order.status)) return 'order_closed';
  if (!order.couponCode || opts.approvalMayHaveBeenRequested || MONEY_MOVED.has(order.status)) return null;
  const service = opts.service ?? (await createServiceClient());
  const { data, error } = await service
    .from('discount_coupons')
    .select(COUPON_ROW_COLUMNS)
    .eq('code', order.couponCode)
    .maybeSingle();
  if (error) {
    // 실패-닫힘: 할인 주문을 확인 없이 승인하면 이 관문이 없는 것과 같다. 상태를 안 바꾸므로 잠시 뒤 재시도하면 된다.
    console.error('[approval-gate] discount_coupons 조회 실패', error.message);
    return 'coupon_lookup_failed';
  }
  return couponOrderVerdict(order, (data as unknown as CouponRow | null) ?? null, opts.now ?? new Date());
}

/** 사용자 안내. 막힌 결제는 승인하지 않았으므로 청구되지 않는다. */
export function approvalBlockMessage(block: ApprovalBlock): string {
  if (block === 'order_closed') {
    return '시간이 지났거나 취소된 주문이라 결제하지 않았어요. 결제 화면을 다시 열어 주세요. 청구된 금액은 없습니다.';
  }
  if (block === 'coupon_lookup_failed') {
    return '쿠폰을 확인하지 못해 결제를 멈췄어요. 잠시 뒤 다시 시도해 주세요. 청구된 금액은 없습니다.';
  }
  return '쿠폰 사용 기간이 끝났거나 회수되어 이 할인가로는 결제하지 않았어요. 결제 화면을 다시 열면 지금 금액으로 결제할 수 있어요. 청구된 금액은 없습니다.';
}

/** 일시 장애(재시도하면 될 수 있음)는 503, 나머지는 409. */
export function approvalBlockHttpStatus(block: ApprovalBlock): 409 | 503 {
  return block === 'coupon_lookup_failed' ? 503 : 409;
}
