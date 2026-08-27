// 2026-05-23 ① — 궁합 깊은 풀이 접근 게이트 + per-couple 가격 플래그.
//   기존: love-question(글로벌) 1회 결제 → 모든 커플 영구 무제한.
//   변경: compat-reading 1회권을 커플 단위(compat:{coupleKey})로 판매.
//   grandfather: 기존/연애확인 love-question 글로벌 보유자는 계속 모든 커플 열람(클레임 방지).
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { buildCompatScopeKey } from '@/lib/payments/product-scope';
import { createServiceClient } from '@/lib/supabase/server';
import { monthlyPeriodKey, MEMBER_QUOTAS } from '@/lib/credits/member-benefits';
import { getMemberTier } from '@/lib/subscription';

// 2026-08-26 — COMPAT_PER_COUPLE_PRICING 플래그 제거.
//   원래는 "CTA 가 커플권을 팔지 전역권을 팔지" 를 고르는 가격 스위치였는데,
//   2026-07-20 전역권 판매 중단으로 가격 분기는 사라지고 **접근 확인만** 이 플래그 뒤에 남았다.
//   그 결과 플래그가 꺼진 환경에서는 커플권을 팔면서 커플권을 조회하지 않는 상태가 됐다
//   (스테이징에서 "결제해도 무료와 같은 내용" 으로 재현). 스위치를 없애 파는 것과 여는 것을 일치시킨다.

/**
 * 궁합 깊은 풀이(유료 §8) 접근 권한.
 *   1) grandfather: love-question 글로벌 보유 → 모든 커플 접근(기존·연애확인 구매자 보호).
 *   2) per-couple: compat-reading @ compat:{coupleKey} 보유 → 해당 커플만 접근.
 * 두 경로 모두 조건 없이 판정한다 — 파는 상품(커플권)과 여는 권한이 같아야 한다.
 */
export async function hasCompatibilityAccess(
  userId: string | null | undefined,
  coupleKey: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;

  const grandfather = await getTasteProductEntitlement(userId, 'love-question');
  if (grandfather) return true;

  if (!coupleKey) return false;
  const perCouple = await getTasteProductEntitlement(
    userId,
    'compat-reading',
    buildCompatScopeKey(coupleKey)
  );
  return Boolean(perCouple);
}

// 2026-06-28 — 멤버 궁합 월 무료. 커플별 멱등(같은 커플 재열람은 횟수 미차감).
//   credit_transactions(feature='compat', metadata.kind='member_compat_free', coupleKey, month)로
//   기록 = (1)재열람 멱등 (2)월간 distinct 커플 수 카운트. 한도 내면 기록 후 true.
//   등급별 한도: premium 월3 / plus 월1. 내부에서 getMemberTier 로 tier 자가 판별
//   (호출부에서 isPremiumMember 사전 체크 불필요).
export async function tryConsumeMemberCompatAccess(
  userId: string,
  coupleKey: string,
  now: Date = new Date()
): Promise<boolean> {
  if (!userId || !coupleKey) return false;
  const tier = await getMemberTier(userId);
  if (!tier) return false;
  const limit = MEMBER_QUOTAS[tier].compatMonthly;
  const month = monthlyPeriodKey(now);
  const service = await createServiceClient();

  // (1) 이번 달 이 커플을 이미 멤버 무료로 열었으면 멱등 무료(횟수 미차감).
  const { data: existing } = await service
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('feature', 'compat')
    .contains('metadata', { kind: 'member_compat_free', coupleKey, month })
    .limit(1);
  if (existing && existing.length > 0) return true;

  // (2) 이번 달 멤버 무료 사용 distinct 커플 수 < limit(등급별: premium 3 / plus 1) 이면 새로 1회 소비.
  const { count } = await service
    .from('credit_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature', 'compat')
    .contains('metadata', { kind: 'member_compat_free', month });
  if ((count ?? 0) >= limit) return false;

  const { error } = await service.from('credit_transactions').insert({
    user_id: userId,
    amount: 0,
    type: 'use',
    feature: 'compat',
    metadata: { kind: 'member_compat_free', coupleKey, month },
  });
  return !error;
}
