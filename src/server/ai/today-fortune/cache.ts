import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export interface TodayFortuneCacheKey {
  userId: string;
  dateKey: string;
  concernId: string;
  promptVersion: string;
}

/**
 * 캐시 키에 **사주 주체**를 접붙인다.
 *
 * 🔴 배경: 키가 (user_id, date_key, concern_id, prompt_version) 뿐이라 한 계정이 같은 날
 *   같은 고민으로 다른 가족을 조회하면 **첫 사람의 본문(이름 포함)이 그대로 서빙**된다
 *   (궁합 캐시 사고와 같은 클래스). 가족 5명 등록은 멤버 기능이고 멤버는 하루 1회 제한이
 *   면제되므로 실제로 도달 가능한 경로다.
 *   컬럼 추가는 수동 마이그레이션이 필요해(적용 누락 시 조용히 깨짐) 버전 토큰에 합친다 —
 *   prompt_version 은 캐시 무효화용 불투명 문자열이라 의미 충돌이 없다.
 *   ⚠️subjectKey 를 빼면 교차 서빙이 즉시 부활한다(가드: cache.test.ts).
 */
export function todayFortuneCacheVersion(
  promptVersion: string,
  subjectKey: string | null | undefined
): string {
  const trimmed = subjectKey?.trim();
  return trimmed ? `${promptVersion}|subject:${trimmed}` : promptVersion;
}

export interface TodayFortuneCacheRow {
  headline: string;
  body: string;
  source: string;
  model: string | null;
}

interface TodayFortuneCacheValue {
  headline: string;
  body: string;
  source: string;
  model: string | null;
  fallbackReason: string | null;
  iljinGanzi: string | null;
}

export function buildTodayFortuneCacheInsert(
  key: TodayFortuneCacheKey,
  value: TodayFortuneCacheValue
): Record<string, unknown> {
  return {
    user_id: key.userId,
    date_key: key.dateKey,
    concern_id: key.concernId,
    prompt_version: key.promptVersion,
    headline: value.headline,
    body: value.body,
    source: value.source,
    model: value.model,
    fallback_reason: value.fallbackReason,
    iljin_ganzi: value.iljinGanzi,
    updated_at: new Date().toISOString(),
  };
}

export async function readTodayFortuneAi(
  key: TodayFortuneCacheKey
): Promise<TodayFortuneCacheRow | null> {
  if (!hasSupabaseServiceEnv) return null;

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('today_fortune_ai')
      .select('headline, body, source, model')
      .eq('user_id', key.userId)
      .eq('date_key', key.dateKey)
      .eq('concern_id', key.concernId)
      .eq('prompt_version', key.promptVersion)
      .maybeSingle();

    if (error || !data) return null;
    return data as TodayFortuneCacheRow;
  } catch {
    return null;
  }
}

export async function writeTodayFortuneAi(
  key: TodayFortuneCacheKey,
  value: TodayFortuneCacheValue
): Promise<void> {
  if (!hasSupabaseServiceEnv) return;

  try {
    const supabase = await createServiceClient();
    await supabase
      .from('today_fortune_ai')
      .upsert(buildTodayFortuneCacheInsert(key, value), {
        onConflict: 'user_id,date_key,concern_id,prompt_version',
      });
  } catch {
    // Cache writes must never break the user-facing response.
  }
}
