// 2026-05-16 Phase 2C — Supabase admin client (service_role).
//
// E2E 에서 entitlement seed/cleanup 위해 사용.
// ⚠️ 2026-09-27 실측: Supabase 프로젝트는 하나뿐이라 CI 도 **운영 DB** 를 쓴다(개발·스테이징 분리 DB 없음).
//   그래서 모든 쓰기는 test 계정 user_id 로만 한정하고 afterAll 에서 되돌린다(entitlement-helpers.ts).
//   다른 사용자 행을 건드리는 쿼리는 추가하지 말 것.

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
