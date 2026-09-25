// 2026-09-26 — 프리미엄 멤버십 회원 할인(신년운세 50%). 쿠폰과는 겹치지 않는다: 할인액이 큰 쪽 하나
//   (동률은 멤버십 — 쿠폰을 태우지 않는다). 청구액은 반드시 applyCouponDiscount 로 계산한다 —
//   resolveChargeForUser(표시·prepare)와 createPaymentOrder 가 같은 함수를 써야 화면가 = order.amount.
import { applyCouponDiscount } from '@/lib/coupons/discount-coupon';

export const MEMBER_DISCOUNT_PERCENT_BY_PACKAGE: Readonly<Record<string, number>> = {
  taste_new_year_2027: 50,
};

export function pickBetterDiscount(
  listAmount: number,
  memberPercent: number,
  coupon: { percent: number; maxDiscountWon?: number | null } | null
): 'member' | 'coupon' | 'none' {
  const member = memberPercent > 0 ? applyCouponDiscount(listAmount, memberPercent, null).discountWon : 0;
  const byCoupon = coupon ? applyCouponDiscount(listAmount, coupon.percent, coupon.maxDiscountWon ?? null).discountWon : 0;
  if (member === 0 && byCoupon === 0) return coupon ? 'coupon' : 'none';
  return member >= byCoupon ? 'member' : 'coupon';
}
