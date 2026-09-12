// src/lib/admin/access-log.ts
// 어드민 감사 로그 기록. 순수 빌더(테스트) + service_role insert 헬퍼.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import type { AdminRole } from '@/lib/admin-auth';

export type AdminAction =
  | 'view_detail' | 'view_pii' | 'export_csv'
  | 'grant_credit' | 'revoke_credit' | 'grant_membership' | 'suspend_sub' | 'cancel_sub'
  | 'force_reconsent' | 'refund_request' | 'refund_approve'
  | 'batch_refund_request' | 'purge_deleted_user'
  | 'grant_lifetime_report'
  // 2026-08-31 — 유료상품 이용권 수동 부여(궁합·점수·달력·당일권 등 전 상품).
  | 'grant_product'
  | 'revoke_product'
  // 2026-07-04 — 계정 관리(이용정지/해제·정보수정·삭제).
  | 'ban_user' | 'unban_user' | 'update_user_info' | 'delete_user'
  // 2026-09-13 — 할인쿠폰 관리(/admin/coupons, super_admin). meta 에 코드 평문 금지(마스킹·스탬프만).
  | 'coupon_tier_update' | 'coupon_tier_toggle' | 'coupon_issue'
  | 'coupon_batch_revoke' | 'coupon_batch_restore' | 'coupon_batch_expiry'
  | 'coupon_lookup' | 'coupon_release' | 'coupon_export';

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
