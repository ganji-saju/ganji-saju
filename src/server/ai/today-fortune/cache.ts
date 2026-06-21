import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export interface TodayFortuneCacheKey {
  userId: string;
  dateKey: string;
  concernId: string;
  promptVersion: string;
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
