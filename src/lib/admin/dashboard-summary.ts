// 2026-06-28 — /admin 랜딩 대시보드 데이터 통합.
//   기존 스냅샷(운영·결제퍼널·LLM비용)을 한 번에 조립 + 대기 작업 카운트 + 최근 어드민 활동.
//   신규 쿼리는 "대기건수 2개 + 활동피드 1개"뿐, 나머지는 재사용.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { buildOperationsSnapshot, type OperationsSnapshot } from '@/lib/admin/operations-stats';
import {
  buildPaymentFunnelSnapshot,
  type PaymentFunnelSnapshot,
} from '@/lib/admin/payment-funnel-stats';
import { getLlmCostStats, type LlmCostStats } from '@/lib/admin/llm-cost-stats';
import type { AdminAction } from '@/lib/admin/access-log';

export interface PendingCounts {
  /** 환불 요청 대기(status='requested'). */
  refundRequested: number;
  /** 후기 모더레이션 대기(moderation_status='pending'). */
  reviewPending: number;
}

export interface RecentAdminActivity {
  id: string;
  actorRole: string;
  action: string;
  actionLabel: string;
  targetUser: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AdminDashboardSummary {
  windowDays: number;
  operations: OperationsSnapshot | null;
  funnel: PaymentFunnelSnapshot | null;
  llm: LlmCostStats | null;
  pending: PendingCounts;
  recentActivity: RecentAdminActivity[];
}

// 감사 로그 action → 한글 라벨(순수, 테스트 대상).
const ACTION_LABELS: Record<string, string> = {
  view_detail: '회원 상세 조회',
  view_pii: '개인정보 열람',
  export_csv: 'CSV 내보내기',
  grant_credit: '코인 지급',
  revoke_credit: '코인 회수',
  suspend_sub: '구독 정지',
  cancel_sub: '구독 취소',
  force_reconsent: '재동의 요청',
  refund_request: '환불 요청',
  refund_approve: '환불 승인',
  batch_refund_request: '일괄 환불 요청',
  purge_deleted_user: '탈퇴 회원 파기',
};

export function labelForAdminAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const VALID_WINDOWS = [7, 14, 30] as const;
export type DashboardWindow = (typeof VALID_WINDOWS)[number];

/** ?days= 입력을 허용된 윈도우(7/14/30)로 정규화. 기본 14. */
export function normalizeDashboardWindow(raw: unknown): DashboardWindow {
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return (VALID_WINDOWS as readonly number[]).includes(n) ? (n as DashboardWindow) : 14;
}

export async function getAdminDashboardSummary(
  windowDays: DashboardWindow = 14
): Promise<AdminDashboardSummary> {
  const base: AdminDashboardSummary = {
    windowDays,
    operations: null,
    funnel: null,
    llm: null,
    pending: { refundRequested: 0, reviewPending: 0 },
    recentActivity: [],
  };
  if (!hasSupabaseServiceEnv) return base;

  try {
    const supabase = await createServiceClient();

    const [operations, funnel, llm, refundRes, reviewRes, activityRes] = await Promise.all([
      buildOperationsSnapshot(supabase, { windowDays }).catch(() => null),
      buildPaymentFunnelSnapshot(supabase, { windowDays }).catch(() => null),
      getLlmCostStats(windowDays).catch(() => null),
      supabase
        .from('refund_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'requested'),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('moderation_status', 'pending'),
      supabase
        .from('admin_access_log')
        .select('id, actor_role, action, target_user, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const recentActivity: RecentAdminActivity[] = (activityRes.data ?? []).map((row) => {
      const r = row as {
        id: string;
        actor_role: string;
        action: string;
        target_user: string | null;
        reason: string | null;
        created_at: string;
      };
      return {
        id: r.id,
        actorRole: r.actor_role,
        action: r.action,
        actionLabel: labelForAdminAction(r.action),
        targetUser: r.target_user,
        reason: r.reason,
        createdAt: r.created_at,
      };
    });

    return {
      windowDays,
      operations,
      funnel,
      llm,
      pending: {
        refundRequested: refundRes.count ?? 0,
        reviewPending: reviewRes.count ?? 0,
      },
      recentActivity,
    };
  } catch {
    return base;
  }
}

// 타입 재노출(페이지 import 편의).
export type { AdminAction };
