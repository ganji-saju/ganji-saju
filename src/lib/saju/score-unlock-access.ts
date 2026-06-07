// 2026-06-07 — 사주 점수 단일 언락(score-total) 결제 해제 조회. score-factor-access 패턴.
//   언락 = score-total 구매(reading scope) OR 5요소(F1~F5) 전부 보유(개별 or today-set 번들 grandfather).
//   방어적: env/유저 없으면 잠금(false). 사용자 응답을 막지 않음.
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { buildReadingProductScopeKey, type ScoreFactorId } from '@/lib/payments/product-scope';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
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

    const scoreTotal = Boolean(
      await getTasteProductEntitlement(
        user.id,
        'score-total',
        buildReadingProductScopeKey(readingKey)
      )
    );
    if (scoreTotal) return true;

    // grandfather: 기존 score-factor 5개 전부(개별 or today-set 번들) 보유 시 해제 인정.
    const factors = await getSajuScoreFactorEntitlements(slug);
    return resolveScoreUnlocked({ scoreTotal: false, factors });
  } catch {
    return false;
  }
}
