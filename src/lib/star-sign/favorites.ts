// 2026-05-16 PR #138 — 별자리 즐겨찾기 유틸.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StarSignSlug } from './sign-content';

const VALID_SLUGS = new Set<StarSignSlug>([
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
]);

export function isValidStarSignSlug(value: unknown): value is StarSignSlug {
  return typeof value === 'string' && VALID_SLUGS.has(value as StarSignSlug);
}

/** 사용자가 follow 한 별자리 slug list (최신순). */
export async function listFavoriteStarSigns(
  client: SupabaseClient,
  userId: string
): Promise<StarSignSlug[]> {
  const { data, error } = await client
    .from('star_sign_favorites')
    .select('slug')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error || !data) return [];
  return data
    .map((r) => r.slug as string)
    .filter(isValidStarSignSlug);
}

export async function addFavoriteStarSign(
  client: SupabaseClient,
  userId: string,
  slug: StarSignSlug
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client
    .from('star_sign_favorites')
    .insert({ user_id: userId, slug });
  if (error) {
    // 중복 (unique 위반) 은 이미 추가된 상태로 간주 → ok.
    if (error.code === '23505') return { ok: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeFavoriteStarSign(
  client: SupabaseClient,
  userId: string,
  slug: StarSignSlug
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client
    .from('star_sign_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('slug', slug);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
