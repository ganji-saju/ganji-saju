// src/lib/admin/user-list.ts
// admin_user_summary 목록 조회. service_role. 필터·정렬·keyset 페이지네이션.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  decodeCursor,
  type AdminUserListParams,
  type AdminUserSummaryRow,
} from './user-list-query';

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

export async function fetchAdminUserList(params: AdminUserListParams): Promise<AdminUserListPage> {
  if (!hasSupabaseServiceEnv) return { rows: [], hasMore: false, refreshedAt: null };
  const service = await createServiceClient();
  const col = SORT_COLUMN[params.sort];

  let qb = service.from('admin_user_summary').select('*');

  // ── 필터(전부 AND) ──
  if (params.status === 'active') {
    qb = qb.gte('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  } else if (params.status === 'dormant') {
    qb = qb.lt('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  }
  if (params.signupFrom) qb = qb.gte('signup_at', `${params.signupFrom}T00:00:00.000Z`);
  if (params.signupTo) qb = qb.lte('signup_at', `${params.signupTo}T23:59:59.999Z`);
  if (params.paid === 'yes') qb = qb.gt('paid_count', 0);
  if (params.paid === 'no') qb = qb.eq('paid_count', 0);
  if (params.minLtv != null) qb = qb.gte('ltv_won', params.minLtv);
  if (params.subscription === 'none') qb = qb.is('subscription_status', null);
  else if (params.subscription !== 'all') qb = qb.eq('subscription_status', params.subscription);
  if (params.provider.length > 0) qb = qb.in('signup_provider', params.provider);
  if (params.inactiveDays != null) {
    qb = qb.lt('last_active_at', new Date(Date.now() - params.inactiveDays * 86400000).toISOString());
  }
  if (params.profile === 'complete') qb = qb.eq('profile_complete', true);
  if (params.profile === 'incomplete') qb = qb.eq('profile_complete', false);

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
