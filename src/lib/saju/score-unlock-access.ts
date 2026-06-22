// 2026-06-07 — 사주 점수 단일 언락(score-total) 결제 해제 조회. score-factor-access 패턴.
//   언락 = score-total 구매(reading scope) OR 5요소(F1~F5) 전부 보유(개별 or today-set 번들 grandfather).
//   2026-06-22 — 매칭을 readingKey(입력 문자열)가 아니라 사주 정체성으로 수행. 같은 사주를
//     경로/분 정밀도 다르게 입력해도 이용권이 이어진다(번들 ↔ 점수 게이트 이중과금 수정).
//   방어적: env/유저 없으면 잠금(false). 사용자 응답을 막지 않음.
import { listTasteProductEntitlementScopeKeys } from '@/lib/product-entitlements';
import { parseReadingProductScopeKey, type ScoreFactorId } from '@/lib/payments/product-scope';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import { sajuIdentityFromReadingKey, sajuIdentityKey } from '@/lib/saju/reading-identity';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { getSajuScoreFactorEntitlements } from './score-factor-access';

const FACTORS: ScoreFactorId[] = ['F1', 'F2', 'F3', 'F4', 'F5'];

/** 순수 판정: score-total 보유 또는 5요소 전부 보유(grandfather) 시 unlocked. */
export function resolveScoreUnlocked(input: {
  scoreTotal: boolean;
  factors: Record<ScoreFactorId, boolean>;
}): boolean {
  if (input.scoreTotal) return true;
  return FACTORS.every((f) => input.factors[f]);
}

/**
 * 순수: 사용자의 score-total 이용권 scope 목록을 현재 reading 의 사주 정체성으로 매칭.
 *   같은 readingKey(exact) 또는 같은 사주 정체성(분/경로 차이 흡수)이면 해제.
 */
export function resolveScoreTotalUnlockByIdentity(args: {
  currentReadingKey: string;
  currentIdentity: string | null;
  scopeKeys: string[];
}): boolean {
  for (const scopeKey of args.scopeKeys) {
    const readingKey = parseReadingProductScopeKey(scopeKey);
    if (!readingKey) continue;
    if (readingKey === args.currentReadingKey) return true;
    if (
      args.currentIdentity !== null &&
      sajuIdentityFromReadingKey(readingKey) === args.currentIdentity
    ) {
      return true;
    }
  }
  return false;
}

export async function getScoreUnlockEntitlement(slug: string): Promise<boolean> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const reading = await resolveReading(slug);
    const readingKey = reading ? toSlug(reading.input) : slug;
    const currentIdentity = reading
      ? sajuIdentityKey(reading.input)
      : sajuIdentityFromReadingKey(slug);

    // score-total 직접 보유 — 사주 정체성으로 매칭(분/경로 차이 흡수).
    const scoreTotalScopes = await listTasteProductEntitlementScopeKeys(user.id, 'score-total');
    if (
      resolveScoreTotalUnlockByIdentity({
        currentReadingKey: readingKey,
        currentIdentity,
        scopeKeys: scoreTotalScopes,
      })
    ) {
      return true;
    }

    // grandfather: 기존 score-factor 5개 전부(개별 or today-set 번들) 보유 시 해제 인정.
    const factors = await getSajuScoreFactorEntitlements(slug);
    return resolveScoreUnlocked({ scoreTotal: false, factors });
  } catch {
    return false;
  }
}
