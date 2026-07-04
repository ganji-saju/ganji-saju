// 2026-05-15 — 운영 모니터링 메트릭 산출.
// admin_user_summary / payment_orders / readings / subscriptions / today_fortune_feedback /
// dialogue_messages 등에서 DAU·결제·만족도·구독 활성 등 계산.
//
// 2026-07-04 admin 지표 전수감사 반영:
//   - 결제 지표 소스를 credit_transactions(type='purchase' — 코인충전 폐지로 신규 행 없음)
//     → payment_orders(카드 단건·멤버십·나이스페이/토스 공통 원장)로 교체. 금액은 원화.
//   - 행 fetch 후 JS 합산 쿼리 전부 페이지네이션(fetchAllPages) — PostgREST 기본
//     1000행 캡으로 조용히 절단되던 문제 해소.
//   - 시리즈 날짜축을 KST 로 통일(기존엔 축=UTC·버킷키=KST 라 KST 00~09시에 '오늘'이
//     축에 없어 통째로 버려짐). 윈도우 시작도 KST 자정으로 스냅해 totals=Σdaily 정합.
//   - 활성 구독에 renews_at > now 조건 추가(만료 lazy 처리로 인한 과대집계 방지).
//   - admin_user_summary 최신 refreshed_at 을 스냅샷에 포함(요약 갱신 지연 관측).

import type { SupabaseClient } from '@supabase/supabase-js';

export interface DailySeries {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface OperationsSnapshot {
  generatedAt: string;
  /** 시간 윈도우 (일). */
  windowDays: number;
  /** 오늘 (KST 자정 단위). */
  today: {
    /** 오늘 순방문자(자체 핑 기반, 하한치). 미집계(마이그레이션 062 미적용 등)면 null. */
    visitors: number | null;
    /** 오늘 신규 가입 수. */
    newSignups: number;
    /** 오늘 활동 사용자 — distinct user 가 readings/today_feedback/dialogue 중 하나 이상 활동. */
    activeUsers: number;
    /** 오늘 결제 건수 (payment_orders 완료 상태). */
    purchaseCount: number;
    /** 오늘 결제 금액 합계 (원). */
    purchaseAmountWon: number;
    /** 오늘 사주 풀이 작성 건수. */
    readingsCreated: number;
    /** 오늘 누적 피드백 건수. */
    feedbackCount: number;
  };
  /** 누적 (현재 시점). */
  lifetime: {
    /** 총 가입자 (admin_user_summary row count). */
    totalUsers: number;
    /** 활성 구독자 (status='active' AND 만료 전). */
    activeSubscribers: number;
    /** 누적 사주 풀이 작성 건수. */
    totalReadings: number;
    /** 누적 결제 건수 (payment_orders 완료 상태). */
    totalPurchases: number;
    /** 누적 결제 금액 합계 (원). */
    totalPurchaseAmountWon: number;
    /** admin_user_summary 마지막 갱신 시각 (요약 지연 관측용, 없으면 null). */
    summaryRefreshedAt: string | null;
  };
  /** 윈도우 내 평균 만족도 (today_fortune_feedback.overall_rating). -1~+1. */
  satisfaction: {
    sampleSize: number;
    averageRating: number; // -1~+1
    /** 영역별 별점 평균 (1~5, null if no data). */
    areaAverages: {
      wealth: number | null;
      love: number | null;
      career: number | null;
      health: number | null;
      relationship: number | null;
    };
    /** correct = +1 / partial = 0 / miss = -1 비율. */
    correctRate: number;
    partialRate: number;
    missRate: number;
  };
  /** 지난 14일 일별 추이 (오래된 → 최신). */
  trends: {
    /** 일별 순방문자(자체 핑). 미집계면 빈 배열. */
    visitors: DailySeries[];
    newSignups: DailySeries[];
    purchaseCount: DailySeries[];
    activeUsers: DailySeries[];
    readingsCreated: DailySeries[];
  };
}

interface CountByDateMap {
  [date: string]: number;
}

/** ISO 'YYYY-MM-DDTHH:mm:ss...' → 'YYYY-MM-DD' (KST 자정 단위). */
function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  // KST = UTC+9. 간단 변환: UTC 시각에 9h 더한 후 날짜 추출.
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** KST 날짜키(YYYY-MM-DD) 기준으로 endKey 포함 직전 days 일의 축 생성. */
function buildEmptySeries(days: number, endKey: string): DailySeries[] {
  const endMs = Date.parse(`${endKey}T00:00:00Z`); // 날짜 산술용(표기만 사용)
  const series: DailySeries[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(endMs - i * 86_400_000);
    series.push({ date: d.toISOString().slice(0, 10), value: 0 });
  }
  return series;
}

function fillSeries(empty: DailySeries[], counts: CountByDateMap): DailySeries[] {
  return empty.map((row) => ({
    date: row.date,
    value: counts[row.date] ?? 0,
  }));
}

function countByDate<T extends { created_at: string }>(
  rows: T[],
  resolveCount: (row: T) => number = () => 1
): CountByDateMap {
  const map: CountByDateMap = {};
  for (const row of rows) {
    const key = toLocalDateKey(row.created_at);
    map[key] = (map[key] ?? 0) + resolveCount(row);
  }
  return map;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // 안전 상한(5만 행) — 초과 시 경고 로그.

/**
 * PostgREST 기본 max-rows(1000) 절단 방지 — range 페이지네이션으로 전량 수집.
 * fetchPage 는 (from, to) inclusive 범위를 받아 해당 페이지를 조회해야 한다.
 */
async function fetchAllPages<T>(
  label: string,
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      // 부분 데이터를 정상 집계처럼 반환하면 지표가 조용히 과소 표시된다(그럴듯한 작은
      // 숫자 — 관측 불가). route 의 try/catch 가 500 으로 응답하도록 throw.
      throw new Error(`[operations-stats] ${label} page ${page} failed: ${error.message}`);
    }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
  console.error(`[operations-stats] ${label} exceeded ${MAX_PAGES * PAGE_SIZE} rows — truncated`);
  return all;
}

/** payment_orders 에서 "완료된 결제"로 집계하는 상태들. (migration 063 RPC 와 일치 유지) */
const COMPLETED_ORDER_STATUSES = ['confirmed', 'fulfilling', 'fulfilled'];

/**
 * 누적 결제 건수/금액 — RPC(payment_order_totals, migration 063) 우선.
 * 행 전송 없이 SQL 집계라 5만 행(MAX_PAGES) 절단·전체 원장 왕복이 없다.
 * RPC 미존재(마이그레이션 미적용)면 기존 행 페이지네이션 폴백(상한 내 정확).
 */
async function fetchLifetimeOrderTotals(
  client: SupabaseClient
): Promise<{ count: number; amountWon: number }> {
  const rpcResp = await client.rpc('payment_order_totals');
  if (!rpcResp.error && rpcResp.data) {
    const row = (Array.isArray(rpcResp.data) ? rpcResp.data[0] : rpcResp.data) as
      | { order_count: number | string | null; total_amount: number | string | null }
      | undefined;
    if (row) {
      return {
        count: Number(row.order_count) || 0,
        amountWon: Number(row.total_amount) || 0,
      };
    }
  }
  const rows = await fetchAllPages<{ amount: number | null }>('orders-lifetime', (from, to) =>
    client
      .from('payment_orders')
      .select('amount')
      .in('status', COMPLETED_ORDER_STATUSES)
      .order('id', { ascending: true })
      .range(from, to)
  );
  return {
    count: rows.length,
    amountWon: rows.reduce((sum, r) => sum + (r.amount ?? 0), 0),
  };
}

/**
 * 운영 메트릭 한 번에 산출.
 * ⚠️ client 는 service-role 이어야 함(집계 테이블 다수가 owner-only/deny RLS).
 */
export async function buildOperationsSnapshot(
  client: SupabaseClient,
  options: { windowDays?: number } = {}
): Promise<OperationsSnapshot> {
  const windowDays = Math.max(7, Math.min(60, options.windowDays ?? 14));
  const now = new Date();
  const todayKey = toLocalDateKey(now.toISOString());

  // 시리즈 축(KST) 먼저 만들고, 윈도우 시작을 축 첫날의 KST 자정으로 스냅.
  const seriesSkeleton = buildEmptySeries(windowDays, todayKey);
  const windowStart = new Date(Date.parse(`${seriesSkeleton[0].date}T00:00:00+09:00`));
  const windowStartIso = windowStart.toISOString();
  const nowIso = now.toISOString();

  // 병렬 쿼리 — 행이 필요한 것들은 전량 페이지네이션, 건수만 필요한 것은 count head.
  const [
    signupRowsRaw,
    orderRows,
    lifetimeTotals,
    readingsRows,
    feedbackRows,
    dialogueRows,
    subscriptionsResp,
    totalReadingsCountResp,
    totalUsersCountResp,
    lastRefreshResp,
    visitCountsResp,
  ] = await Promise.all([
    // 신규 가입 (admin_user_summary.signup_at — migration 049 기준).
    // admin_user_summary 는 cron 으로 주기적으로 갱신되므로 매우 최근 가입자는
    // 다음 cron 실행 전까지 반영이 지연될 수 있음(summaryRefreshedAt 으로 관측).
    fetchAllPages<{ user_id: string; signup_at: string }>('signups', (from, to) =>
      client
        .from('admin_user_summary')
        .select('user_id, signup_at')
        .gte('signup_at', windowStartIso)
        // 정렬 tiebreak(유니크 키) — 타임스탬프 동률 시 페이지 경계 중복/누락 방지.
        .order('signup_at', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to)
    ),

    // 결제 (payment_orders 완료 상태, 윈도우 내) — 카드 단건·멤버십·PG 공통 원장.
    fetchAllPages<{ user_id: string | null; amount: number | null; created_at: string }>(
      'orders-window',
      (from, to) =>
        client
          .from('payment_orders')
          .select('user_id, amount, created_at')
          .in('status', COMPLETED_ORDER_STATUSES)
          .gte('created_at', windowStartIso)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
    ),

    // 전체 결제 — lifetime 통계(RPC 집계 우선, 미적용 시 행 페이지네이션 폴백).
    fetchLifetimeOrderTotals(client),

    // readings — 윈도우 내.
    fetchAllPages<{ user_id: string; created_at: string }>('readings', (from, to) =>
      client
        .from('readings')
        .select('user_id, created_at')
        .not('user_id', 'is', null)
        .gte('created_at', windowStartIso)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),

    // today_fortune_feedback — windowDays 윈도우 내 만족도 분석.
    fetchAllPages<{
      overall_rating: number | null;
      wealth_rating: number | null;
      love_rating: number | null;
      career_rating: number | null;
      health_rating: number | null;
      relationship_rating: number | null;
      created_at: string;
      user_id: string;
    }>('feedback', (from, to) =>
      client
        .from('today_fortune_feedback')
        .select(
          'overall_rating, wealth_rating, love_rating, career_rating, health_rating, relationship_rating, created_at, user_id'
        )
        .gte('created_at', windowStartIso)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),

    // 활동 소스 — dialogue_messages 의 user_id+date.
    fetchAllPages<{ user_id: string; created_at: string }>('dialogue', (from, to) =>
      client
        .from('dialogue_messages')
        .select('user_id, created_at')
        .gte('created_at', windowStartIso)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    ),

    // 활성 구독 — 만료 lazy 처리(expireIfNeeded는 유저 재방문 시에만 실행)라
    // status='active' 만으로는 과대집계 → renews_at 미래(또는 null) 조건 추가.
    client
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'active')
      .or(`renews_at.is.null,renews_at.gt.${nowIso}`),

    // 누적 사주 readings count.
    client
      .from('readings')
      .select('id', { count: 'exact', head: true })
      .not('user_id', 'is', null),

    // 누적 가입자 (admin_user_summary — user_id 가 PK, id 컬럼 없음).
    client.from('admin_user_summary').select('user_id', { count: 'exact', head: true }),

    // 요약 테이블 최신 갱신 시각(지연 관측).
    client
      .from('admin_user_summary')
      .select('refreshed_at')
      .order('refreshed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 순방문자(자체 핑, migration 062) — RPC group-by 라 행 전송 없음.
    // 함수 미존재(미적용) 시 error → null-graceful 처리.
    client.rpc('site_visit_daily_counts', {
      from_key: seriesSkeleton[0].date,
      to_key: todayKey,
    }),
  ]);

  // signup_at → created_at 로 매핑해 countByDate / toLocalDateKey 공통 인터페이스를 유지한다.
  const signupRows = signupRowsRaw.map((r) => ({ user_id: r.user_id, created_at: r.signup_at }));
  const purchaseRows = orderRows.map((r) => ({
    user_id: r.user_id ?? '',
    amount: r.amount ?? 0,
    created_at: r.created_at,
  }));
  // 순방문자(자체 핑) — RPC 미존재(마이그레이션 062 미적용)면 null 로 표시.
  const visitRows = visitCountsResp.error
    ? null
    : ((visitCountsResp.data ?? []) as Array<{ date_key: string; visitors: number }>);
  const visitorCounts: CountByDateMap = {};
  if (visitRows) {
    for (const row of visitRows) visitorCounts[row.date_key] = Number(row.visitors) || 0;
  }

  // 일별 추이 시리즈 빌드 — 오래된 → 최신.
  const trends = {
    visitors: visitRows ? fillSeries(seriesSkeleton, visitorCounts) : [],
    newSignups: fillSeries(seriesSkeleton, countByDate(signupRows)),
    purchaseCount: fillSeries(seriesSkeleton, countByDate(purchaseRows)),
    readingsCreated: fillSeries(seriesSkeleton, countByDate(readingsRows)),
    // 활동 사용자 추이 — 일별 distinct user_id.
    activeUsers: (() => {
      const dailyUsers: Record<string, Set<string>> = {};
      for (const row of readingsRows) {
        const key = toLocalDateKey(row.created_at);
        dailyUsers[key] = dailyUsers[key] ?? new Set();
        dailyUsers[key].add(row.user_id);
      }
      for (const row of feedbackRows) {
        const key = toLocalDateKey(row.created_at);
        dailyUsers[key] = dailyUsers[key] ?? new Set();
        dailyUsers[key].add(row.user_id);
      }
      for (const row of dialogueRows) {
        const key = toLocalDateKey(row.created_at);
        dailyUsers[key] = dailyUsers[key] ?? new Set();
        dailyUsers[key].add(row.user_id);
      }
      const counts: CountByDateMap = {};
      for (const [date, set] of Object.entries(dailyUsers)) {
        counts[date] = set.size;
      }
      return fillSeries(seriesSkeleton, counts);
    })(),
  };

  // 오늘 통계.
  const todaySignups = signupRows.filter((r) => toLocalDateKey(r.created_at) === todayKey).length;
  const todayPurchaseRows = purchaseRows.filter((r) => toLocalDateKey(r.created_at) === todayKey);
  const todayReadings = readingsRows.filter((r) => toLocalDateKey(r.created_at) === todayKey).length;
  const todayFeedback = feedbackRows.filter((r) => toLocalDateKey(r.created_at) === todayKey).length;

  const todayActiveUsers = new Set<string>();
  for (const r of readingsRows) {
    if (toLocalDateKey(r.created_at) === todayKey) todayActiveUsers.add(r.user_id);
  }
  for (const r of feedbackRows) {
    if (toLocalDateKey(r.created_at) === todayKey) todayActiveUsers.add(r.user_id);
  }
  for (const r of dialogueRows) {
    if (toLocalDateKey(r.created_at) === todayKey) todayActiveUsers.add(r.user_id);
  }

  // 만족도 통계 — 윈도우 내 피드백. overall_rating 이 -1/0/1 이 아닌 행(null 등)은
  // 표본에서 제외(기존엔 miss 로 오분류 + null 이면 NaN 전파).
  let sample = 0;
  let totalRating = 0;
  let correctN = 0;
  let partialN = 0;
  let missN = 0;
  const areaSums = { wealth: 0, love: 0, career: 0, health: 0, relationship: 0 };
  const areaCounts = { wealth: 0, love: 0, career: 0, health: 0, relationship: 0 };
  for (const row of feedbackRows) {
    if (row.overall_rating === 1 || row.overall_rating === 0 || row.overall_rating === -1) {
      sample += 1;
      totalRating += row.overall_rating;
      if (row.overall_rating === 1) correctN += 1;
      else if (row.overall_rating === 0) partialN += 1;
      else missN += 1;
    }
    for (const key of ['wealth', 'love', 'career', 'health', 'relationship'] as const) {
      const v = row[`${key}_rating`];
      if (typeof v === 'number') {
        areaSums[key] += v;
        areaCounts[key] += 1;
      }
    }
  }
  const avg = (key: keyof typeof areaSums) =>
    areaCounts[key] > 0 ? Number((areaSums[key] / areaCounts[key]).toFixed(2)) : null;

  return {
    generatedAt: now.toISOString(),
    windowDays,
    today: {
      visitors: visitRows ? (visitorCounts[todayKey] ?? 0) : null,
      newSignups: todaySignups,
      activeUsers: todayActiveUsers.size,
      purchaseCount: todayPurchaseRows.length,
      purchaseAmountWon: todayPurchaseRows.reduce((sum, r) => sum + r.amount, 0),
      readingsCreated: todayReadings,
      feedbackCount: todayFeedback,
    },
    lifetime: {
      totalUsers: totalUsersCountResp.count ?? 0,
      activeSubscribers: subscriptionsResp.count ?? 0,
      totalReadings: totalReadingsCountResp.count ?? 0,
      totalPurchases: lifetimeTotals.count,
      totalPurchaseAmountWon: lifetimeTotals.amountWon,
      summaryRefreshedAt:
        (lastRefreshResp.data as { refreshed_at?: string } | null)?.refreshed_at ?? null,
    },
    satisfaction: {
      sampleSize: sample,
      averageRating: sample > 0 ? Number((totalRating / sample).toFixed(3)) : 0,
      areaAverages: {
        wealth: avg('wealth'),
        love: avg('love'),
        career: avg('career'),
        health: avg('health'),
        relationship: avg('relationship'),
      },
      correctRate: sample > 0 ? Number((correctN / sample).toFixed(3)) : 0,
      partialRate: sample > 0 ? Number((partialN / sample).toFixed(3)) : 0,
      missRate: sample > 0 ? Number((missN / sample).toFixed(3)) : 0,
    },
    trends,
  };
}
