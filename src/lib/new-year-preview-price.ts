// 2026-09-26 — 신년운세 미리보기의 가격 표시. 체크아웃·prepare 와 같은 함수(resolveChargeForUser)로 계산해
//   멤버십 회원에겐 9,950원이 보이게 한다(화면 금액 ≠ 청구 금액이 되지 않게 — 관문은 한 곳).
import type { User } from '@supabase/supabase-js';
import { getPackage } from '@/lib/payments/catalog';
import { couponEnvForHost, resolveChargeForUser } from '@/lib/coupons/coupon-charge';

export async function resolveNewYearPreviewPrice(user: User | null, host: string | null) {
  const pkg = getPackage('taste_new_year_2027')!;
  const quote = await resolveChargeForUser(pkg, user, null, { env: couponEnvForHost(host) });
  return { chargeAmount: quote.chargeAmount, listAmount: quote.listAmount, memberPercent: quote.memberPercent };
}
