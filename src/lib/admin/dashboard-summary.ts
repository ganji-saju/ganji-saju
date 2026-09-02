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
import {
  getDailyMetrics,
  type DailyMetricPoint,
  type InflowAggEntry,
} from '@/lib/admin/analytics-metrics';
import type { AdminAction } from '@/lib/admin/access-log';
import {
  kstNoonDate,
  resolveAdminPeriod,
  type AdminPeriod,
} from './metric-periods';

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
  /** 조회한 달력 기간(일·주·월·분기·년). 화면 표기와 링크 생성에 쓴다. */
  period: AdminPeriod;
  operations: OperationsSnapshot | null;
  /**
   * 2026-07-20 — 유입 상위(referrer). 사용자 요청으로 /admin 요약에 노출.
   *   집계는 getDailyMetrics(=/admin/analytics 와 같은 경로)를 재사용한다 —
   *   따로 구현하면 두 화면 숫자가 갈라진다.
   */
  topReferrers: InflowAggEntry[];
  /**
   * 2026-08-27 — 유입 상위(UTM 캠페인). referrer 만으로는 링크인바이오(인포크링크 등)를
   *   거친 유입의 **원래 채널**을 알 수 없다 — referrer 는 직전 한 단계만 보인다.
   *   같은 getDailyMetrics 집계라 /admin/analytics 와 숫자가 갈라지지 않는다.
   */
  topUtm: InflowAggEntry[];
  /**
   * 2026-08-27 — 일별 지표 원본. getDailyMetrics 는 유입 카드 때문에 **이미 부르고 있었고**
   *   일별 행을 버리고 있었다 — 추가 쿼리 없이 그대로 싣는다. 화면에서 일/주(월~일)로 묶는다.
   */
  daily: DailyMetricPoint[];
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
  grant_credit: '전 지급',
  revoke_credit: '전 회수',
  suspend_sub: '구독 정지',
  cancel_sub: '구독 취소',
  force_reconsent: '재동의 요청',
  refund_request: '환불 요청',
  refund_approve: '환불 승인',
  batch_refund_request: '일괄 환불 요청',
  purge_deleted_user: '탈퇴 회원 파기',
  // 2026-08-31 — 부여 계열 라벨이 빠져 있어 최근 활동에 'grant_membership' 원문이 찍혔다.
  grant_membership: '멤버십 부여',
  grant_lifetime_report: '평생 리포트 부여',
  grant_product: '유료상품 권한 부여',
  revoke_product: '유료상품 권한 회수',
};

export function labelForAdminAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** 종전 호출 계약(오늘까지 N일). 새 코드는 AdminPeriod 를 넘긴다. */
export type DashboardWindow = number;

/** 유입·일별 지표 묶음(getDailyMetrics 1회 결과에서 화면이 쓰는 부분만). */
export interface AdminAnalyticsPart {
  topReferrers: InflowAggEntry[];
  topUtm: InflowAggEntry[];
  daily: DailyMetricPoint[];
}

/**
 * 2026-09-01 — **await 하지 않은 약속**들을 돌려준다(카드별 스트리밍용).
 *
 *   왜: /admin 은 무거운 집계 4종을 한 번에 await 해서 **가장 느린 하나가 끝날 때까지**
 *   화면에 아무것도 안 나왔다(첫 픽셀 = 마지막 쿼리). 약속을 그대로 넘기면 화면이
 *   `<Suspense>` 로 카드마다 따로 기다린다 — 쿼리 수·부하는 그대로고 체감만 바뀐다.
 *
 *   ⚠️ 모든 약속은 여기서 이미 catch 된다(실패 = null/빈값). 호출부가 await 를 빠뜨려도
 *   unhandled rejection 으로 화면이 통째로 죽지 않아야 한다.
 */
export interface AdminDashboardParts {
  period: AdminPeriod;
  windowDays: number;
  operations: Promise<OperationsSnapshot | null>;
  funnel: Promise<PaymentFunnelSnapshot | null>;
  llm: Promise<LlmCostStats | null>;
  analytics: Promise<AdminAnalyticsPart | null>;
  pending: Promise<PendingCounts>;
  recentActivity: Promise<RecentAdminActivity[]>;
}

const EMPTY_PENDING: PendingCounts = { refundRequested: 0, reviewPending: 0 };

/** 숫자(구 계약)면 '오늘까지 N일'로 해석. */
function toPeriod(input: AdminPeriod | DashboardWindow): AdminPeriod {
  return typeof input === 'number'
    ? { ...resolveAdminPeriod('day', undefined), days: input, label: `최근 ${input}일` }
    : input;
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export function getAdminDashboardParts(
  input: AdminPeriod | DashboardWindow = 14
): AdminDashboardParts {
  const period = toPeriod(input);
  const { days: windowDays, endKey } = period;

  // service 클라이언트도 약속으로 둔다 — 여기서 await 하면 스트리밍이 그 지점에서 막힌다.
  const clientPromise: Promise<ServiceClient | null> = hasSupabaseServiceEnv
    ? createServiceClient()
    : Promise.resolve(null);

  // 2026-07-04 감사 — 실패를 조용히 삼키면 'env 문제'로 오도됨 → 원인 로그를 남긴다.
  const withClient = <T>(
    label: string,
    run: (client: ServiceClient) => Promise<T>,
    fallback: T
  ): Promise<T> =>
    clientPromise
      .then((client) => (client ? run(client) : fallback))
      .catch((e: unknown) => {
        console.error(`[admin-dashboard] ${label} failed:`, e);
        return fallback;
      });

  return {
    period,
    windowDays,
    operations: withClient(
      'operations snapshot',
      (c) => buildOperationsSnapshot(c, { windowDays, endKey }),
      null
    ),
    funnel: withClient(
      'funnel snapshot',
      (c) => buildPaymentFunnelSnapshot(c, { windowDays, endKey }),
      null
    ),
    llm: getLlmCostStats(windowDays, endKey).catch(() => null),
    // 유입 상위 — /admin/analytics 와 동일 집계를 재사용(두 화면 숫자가 갈라지지 않게).
    analytics: withClient(
      'analytics(inflow)',
      async (c) => {
        const snap = await getDailyMetrics(c, windowDays, kstNoonDate(endKey));
        return { topReferrers: snap.topReferrers, topUtm: snap.topUtm, daily: snap.daily };
      },
      null
    ),
    pending: withClient(
      'pending counts',
      async (c) => {
        const [refundRes, reviewRes] = await Promise.all([
          c
            .from('refund_requests')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'requested'),
          c
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('moderation_status', 'pending'),
        ]);
        return { refundRequested: refundRes.count ?? 0, reviewPending: reviewRes.count ?? 0 };
      },
      EMPTY_PENDING
    ),
    recentActivity: withClient(
      'recent activity',
      async (c) => {
        const { data } = await c
          .from('admin_access_log')
          .select('id, actor_role, action, target_user, reason, created_at')
          .order('created_at', { ascending: false })
          .limit(8);
        return (data ?? []).map((row) => {
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
      },
      []
    ),
  };
}

/**
 * 전부 await 한 스냅샷(구 계약). 새 화면은 getAdminDashboardParts 로 카드별로 기다린다.
 */
export async function getAdminDashboardSummary(
  input: AdminPeriod | DashboardWindow = 14
): Promise<AdminDashboardSummary> {
  const parts = getAdminDashboardParts(input);
  const [operations, funnel, llm, analytics, pending, recentActivity] = await Promise.all([
    parts.operations,
    parts.funnel,
    parts.llm,
    parts.analytics,
    parts.pending,
    parts.recentActivity,
  ]);
  return {
    windowDays: parts.windowDays,
    period: parts.period,
    operations,
    funnel,
    llm,
    topReferrers: analytics?.topReferrers ?? [],
    topUtm: analytics?.topUtm ?? [],
    daily: analytics?.daily ?? [],
    pending,
    recentActivity,
  };
}

// 타입 재노출(페이지 import 편의).
export type { AdminAction };
