// 2026-05-16 Phase 2C — Supabase admin client (service_role).
//
// E2E 에서 entitlement seed/cleanup 위해 사용. 절대 production project 에서 사용 금지.
// dev/staging project 의 SUPABASE_SERVICE_ROLE_KEY 만 허용.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 미설정 — Phase 2C entitlement seed 불가'
    );
  }

  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
