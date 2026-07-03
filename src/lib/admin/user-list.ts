// src/lib/admin/user-list.ts
// admin_user_summary 목록 조회. service_role. 필터·정렬·keyset 페이지네이션.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  decodeCursor,
  type AdminUserListParams,
  type AdminUserSummaryRow,
} from './user-list-query';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SummaryQuery = any;

const SAFE_CURSOR_V = /^[0-9T:.Z+-]+$/;    // ISO 타임스탬프 또는 정수만
const SAFE_CURSOR_ID = /^[0-9a-fA-F-]+$/;  // UUID 문자만

const SORT_COLUMN: Record<AdminUserListParams['sort'], keyof AdminUserSummaryRow> = {
  signup: 'signup_at',
  ltv: 'ltv_won',
  last_active: 'last_active_at',
  paid_count: 'paid_count',
};

export interface AdminUserListPage {
  rows: AdminUserSummaryRow[];
  hasMore: boolean;
  refreshedAt: string | null;
}

/** 모든 필터를 AND로 적용(목록·카운트 공유). */
function applyListFilters(qb: SummaryQuery, params: AdminUserListParams): SummaryQuery {
  let q = qb;
  if (params.status === 'active') {
    q = q.gte('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  } else if (params.status === 'dormant') {
    q = q.lt('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  }
  // 2026-07-04 감사 — 관리자 입력은 KST 날짜인데 UTC 경계로 비교해 9시간 밀리던 문제.
  if (params.signupFrom) q = q.gte('signup_at', `${params.signupFrom}T00:00:00+09:00`);
  if (params.signupTo) q = q.lte('signup_at', `${params.signupTo}T23:59:59.999+09:00`);
  if (params.signupWithinDays != null) {
    q = q.gte('signup_at', new Date(Date.now() - params.signupWithinDays * 86400000).toISOString());
  }
  if (params.paid === 'yes') q = q.gt('paid_count', 0);
  if (params.paid === 'no') q = q.eq('paid_count', 0);
  if (params.minLtv != null) q = q.gte('ltv_won', params.minLtv);
  if (params.refundable === 'yes') q = q.gt('refundable_won', 0);
  if (params.firstReading === 'none') q = q.eq('reading_count', 0);
  if (params.subscription === 'none') q = q.is('subscription_status', null);
  else if (params.subscription !== 'all') q = q.eq('subscription_status', params.subscription);
  if (params.provider.length > 0) q = q.in('signup_provider', params.provider);
  if (params.inactiveDays != null) {
    q = q.lt('last_active_at', new Date(Date.now() - params.inactiveDays * 86400000).toISOString());
  }
  if (params.profile === 'complete') q = q.eq('profile_complete', true);
  if (params.profile === 'incomplete') q = q.eq('profile_complete', false);
  return q;
}

export async function fetchAdminUserList(params: AdminUserListParams): Promise<AdminUserListPage> {
  if (!hasSupabaseServiceEnv) return { rows: [], hasMore: false, refreshedAt: null };
  const service = await createServiceClient();
  const col = SORT_COLUMN[params.sort];

  let qb = service.from('admin_user_summary').select('*');

  qb = applyListFilters(qb, params);

  // ── keyset (모든 정렬 DESC, tie-break user_id DESC) ──
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  if (cursor && SAFE_CURSOR_V.test(cursor.v) && SAFE_CURSOR_ID.test(cursor.id)) {
    qb = qb.or(`${col}.lt.${cursor.v},and(${col}.eq.${cursor.v},user_id.lt.${cursor.id})`);
  }
  qb = qb
    .order(col as string, { ascending: false })
    .order('user_id', { ascending: false })
    .limit(params.limit + 1);

  const { data, error } = await qb;
  if (error || !data) return { rows: [], hasMore: false, refreshedAt: null };

  const all = data as unknown as Array<AdminUserSummaryRow & { refreshed_at: string }>;
  const hasMore = all.length > params.limit;
  const rows = all.slice(0, params.limit);
  const refreshedAt = rows[0]?.refreshed_at ?? all[0]?.refreshed_at ?? null;
  return { rows, hasMore, refreshedAt };
}

/** 세그먼트 인원수 등 — 필터 적용 후 정확 카운트(행 미전송). */
export async function countAdminUsers(params: AdminUserListParams): Promise<number> {
  if (!hasSupabaseServiceEnv) return 0;
  const service = await createServiceClient();
  let qb = service.from('admin_user_summary').select('user_id', { count: 'exact', head: true });
  qb = applyListFilters(qb, params);
  const { count, error } = await qb;
  // 에러를 0으로 삼키면 '데이터 없음'과 구분 불가 — 최소한 관측은 남긴다.
  if (error) {
    console.error('[user-list] countAdminUsers failed:', error.message);
    return 0;
  }
  return count ?? 0;
}
