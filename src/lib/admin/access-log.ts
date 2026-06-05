// src/lib/admin/access-log.ts
// 어드민 감사 로그 기록. 순수 빌더(테스트) + service_role insert 헬퍼.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import type { AdminRole } from '@/lib/admin-auth';

export type AdminAction =
  | 'view_detail' | 'view_pii' | 'export_csv'
  | 'grant_credit' | 'revoke_credit' | 'suspend_sub' | 'cancel_sub'
  | 'force_reconsent' | 'refund_request' | 'refund_approve'
  | 'batch_refund_request' | 'purge_deleted_user';

export interface AccessLogInput {
  actorId: string;
  actorRole: AdminRole;
  action: AdminAction;
  targetUser?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
  ipHash?: string | null;
}

export interface AccessLogInsert {
  actor_id: string;
  actor_role: string;
  action: string;
  target_user: string | null;
  reason: string | null;
  meta: Record<string, unknown>;
  ip_hash: string | null;
}

export function buildAccessLogInsert(input: AccessLogInput): AccessLogInsert {
  return {
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    target_user: input.targetUser ?? null,
    reason: input.reason ?? null,
    meta: input.meta ?? {},
    ip_hash: input.ipHash ?? null,
  };
}

/** 감사 로그 1건 기록. 실패는 삼키되 콘솔 경고(감사 실패가 액션을 막지 않도록). */
export async function logAdminAccess(input: AccessLogInput): Promise<void> {
  if (!hasSupabaseServiceEnv) return;
  try {
    const service = await createServiceClient();
    await service.from('admin_access_log').insert(buildAccessLogInsert(input));
  } catch (err) {
    console.warn('[admin_access_log] insert 실패', err);
  }
}
