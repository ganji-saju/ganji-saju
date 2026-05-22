// 2026-05-22 — per-factor 점수 풀이(score-factor) 결제 해제 조회. today-detail-access 패턴.
//   (readingKey, factorId) 단위 product_entitlements 조회 → F1~F5 unlock 맵.
//   방어적: env/유저 없으면 전부 잠금. 사용자 응답을 막지 않음.
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { buildScoreFactorScopeKey, type ScoreFactorId } from '@/lib/payments/product-scope';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

export type ScoreFactorUnlockMap = Record<ScoreFactorId, boolean>;

const FACTORS: ScoreFactorId[] = ['F1', 'F2', 'F3', 'F4', 'F5'];
const ALL_LOCKED: ScoreFactorUnlockMap = { F1: false, F2: false, F3: false, F4: false, F5: false };

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

    const result: ScoreFactorUnlockMap = { ...ALL_LOCKED };
    await Promise.all(
      FACTORS.map(async (f) => {
        const ent = await getTasteProductEntitlement(
          user.id,
          'score-factor',
          buildScoreFactorScopeKey(readingKey, f)
        );
        if (ent) result[f] = true;
      })
    );
    return result;
  } catch {
    return { ...ALL_LOCKED };
  }
}
