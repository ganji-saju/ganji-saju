// 2026-05-23 ① — 궁합 깊은 풀이 접근 게이트 + per-couple 가격 플래그.
//   기존: love-question(글로벌) 1회 결제 → 모든 커플 영구 무제한.
//   변경: compat-reading 1회권을 커플 단위(compat:{coupleKey})로 판매.
//   grandfather: 기존/연애확인 love-question 글로벌 보유자는 계속 모든 커플 열람(클레임 방지).
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { buildCompatScopeKey } from '@/lib/payments/product-scope';

/**
 * env COMPAT_PER_COUPLE_PRICING=1 일 때만 궁합 CTA 가 compat-reading(커플 1회권)을 판매.
 * 기본 OFF → 기존처럼 love-question(글로벌) 판매. 게이트(hasCompatibilityAccess)는 플래그와
 * 무관하게 항상 grandfather 를 포함하므로, 플래그 전환이 기존 구매자를 깨지 않는다.
 */
export function isCompatibilityPerCouplePricingEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.COMPAT_PER_COUPLE_PRICING === '1';
}

/**
 * 궁합 깊은 풀이(유료 §8) 접근 권한.
 *   1) grandfather: love-question 글로벌 보유 → 모든 커플 접근(기존·연애확인 구매자 보호).
 *   2) per-couple: compat-reading @ compat:{coupleKey} 보유 → 해당 커플만 접근.
 * 플래그 OFF 환경에서는 compat-reading 구매가 발생하지 않으므로 (1)만 동작 = 기존과 동일.
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
