import {
  buildTodayDetailScopeKey,
  getTasteProductEntitlement,
} from '@/lib/product-entitlements';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

export async function getSajuTodayDetailEntitlement(slug: string) {
  if (!hasSupabaseServerEnv || !hasSupabaseServiceEnv) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return getTasteProductEntitlement(user.id, 'today-detail', buildTodayDetailScopeKey(slug));
}
