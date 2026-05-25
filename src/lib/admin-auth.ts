// 2026-05-16 PR #141 — admin 화이트리스트 가드.
// 모든 /admin/* 페이지 + /api/admin/* API 에서 사용.
//
// 화이트리스트 소스 (우선순위):
// 1. env ADMIN_USER_IDS (comma-separated UUID) — 부트스트랩용
// 2. admin_users 테이블 (DB)
//
// 둘 다 통과해야 access 허용. 양쪽 모두 in-memory cache (5분 TTL) 적용.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';

const TTL_MS = 5 * 60 * 1000;

interface AdminCacheEntry {
  isAdmin: boolean;
  loadedAt: number;
}

const cache = new Map<string, AdminCacheEntry>();

function envAdminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

async function checkAdminInDb(userId: string): Promise<boolean> {
  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * 사용자가 admin 인지 확인.
 * - env ADMIN_USER_IDS 에 있으면 즉시 true (no DB call)
 * - 그 외 admin_users 테이블 조회 (TTL 5분 cache)
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  if (!userId) return false;

  // env 우선.
  if (envAdminIds().has(userId)) return true;

  // cache hit ?
  const now = Date.now();
  const entry = cache.get(userId);
  if (entry && now - entry.loadedAt < TTL_MS) {
    return entry.isAdmin;
  }

  const isAdmin = await checkAdminInDb(userId);
  cache.set(userId, { isAdmin, loadedAt: now });
  return isAdmin;
}

/** 현재 요청의 supabase client 에서 user 가져와 admin 검증. */
export async function getCurrentAdminCheck(client: SupabaseClient): Promise<{
  ok: boolean;
  userId: string | null;
  reason: 'ok' | 'unauthenticated' | 'forbidden';
}> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { ok: false, userId: null, reason: 'unauthenticated' };
  }
  const allowed = await isAdminUser(user.id);
  if (!allowed) {
    return { ok: false, userId: user.id, reason: 'forbidden' };
  }
  return { ok: true, userId: user.id, reason: 'ok' };
}

// 2026-05-25 Phase 2 — super_admin 역할(환불 승인 등 민감 작업 게이트).
export type AdminRole = 'admin' | 'super_admin';

async function fetchAdminRole(userId: string): Promise<AdminRole | null> {
  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from('admin_users')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { role?: string }).role === 'super_admin' ? 'super_admin' : 'admin';
  } catch {
    return null;
  }
}

/**
 * admin 역할 조회. env ADMIN_USER_IDS(부트스트랩)는 super_admin 으로 취급(시스템 설립자).
 * 그 외는 admin_users.role. admin 아니면 null.
 */
export async function getAdminRole(userId: string): Promise<AdminRole | null> {
  if (!userId) return null;
  if (envAdminIds().has(userId)) return 'super_admin';
  return fetchAdminRole(userId);
}

/** 현재 요청 user 의 admin 역할 검증(role 포함). */
export async function getCurrentAdminRole(client: SupabaseClient): Promise<{
  ok: boolean;
  userId: string | null;
  role: AdminRole | null;
  reason: 'ok' | 'unauthenticated' | 'forbidden';
}> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, userId: null, role: null, reason: 'unauthenticated' };
  const role = await getAdminRole(user.id);
  if (!role) return { ok: false, userId: user.id, role: null, reason: 'forbidden' };
  return { ok: true, userId: user.id, role, reason: 'ok' };
}

/** 테스트용 — cache 강제 비우기. */
export function __clearAdminCache() {
  cache.clear();
}
