// 2026-05-22 — per-factor 점수 풀이(score-factor) 결제 해제 조회. today-detail-access 패턴.
//   (readingKey, factorId) 단위 product_entitlements 조회 → F1~F5 unlock 맵.
//   방어적: env/유저 없으면 전부 잠금. 사용자 응답을 막지 않음.
import { listTasteProductEntitlementScopeKeys } from '@/lib/product-entitlements';
import { parseScoreFactorScopeKey, type ScoreFactorId } from '@/lib/payments/product-scope';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import { sajuIdentityFromReadingKey, sajuIdentityKey } from '@/lib/saju/reading-identity';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

export type ScoreFactorUnlockMap = Record<ScoreFactorId, boolean>;

const ALL_LOCKED: ScoreFactorUnlockMap = { F1: false, F2: false, F3: false, F4: false, F5: false };

/**
 * 순수: 사용자의 score-factor 이용권 scope 목록을 현재 reading 의 사주 정체성으로 매칭.
 *   같은 readingKey(exact) 또는 같은 사주 정체성(분/경로 차이 흡수)이면 해당 요소 해제.
 *   정체성 매칭으로 번들(다른 입력 정밀도) → 같은 사주 점수 게이트 grandfather 가 성립한다.
 */
export function resolveScoreFactorUnlockByIdentity(args: {
  currentReadingKey: string;
  currentIdentity: string | null;
  scopeKeys: string[];
}): ScoreFactorUnlockMap {
  const result: ScoreFactorUnlockMap = { ...ALL_LOCKED };
  for (const scopeKey of args.scopeKeys) {
    const parsed = parseScoreFactorScopeKey(scopeKey);
    if (!parsed) continue;
    const matches =
      parsed.readingKey === args.currentReadingKey ||
      (args.currentIdentity !== null &&
        sajuIdentityFromReadingKey(parsed.readingKey) === args.currentIdentity);
    if (matches) result[parsed.factorId] = true;
  }
  return result;
}

export async function getSajuScoreFactorEntitlements(slug: string): Promise<ScoreFactorUnlockMap> {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) return { ...ALL_LOCKED };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ...ALL_LOCKED };

    const reading = await resolveReading(slug);
    const readingKey = reading ? toSlug(reading.input) : slug;
    const currentIdentity = reading
      ? sajuIdentityKey(reading.input)
      : sajuIdentityFromReadingKey(slug);

    // 사용자의 score-factor 이용권 전부를 가져와 사주 정체성으로 매칭(개별·번들·분 차이 흡수).
    const scopeKeys = await listTasteProductEntitlementScopeKeys(user.id, 'score-factor');
    return resolveScoreFactorUnlockByIdentity({ currentReadingKey: readingKey, currentIdentity, scopeKeys });
  } catch {
    return { ...ALL_LOCKED };
  }
}
