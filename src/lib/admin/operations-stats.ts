// 2026-05-15 — 운영 모니터링 메트릭 산출.
// auth.users / credit_transactions / readings / subscriptions / today_fortune_feedback /
// dialogue_messages 등에서 DAU·결제·만족도·구독 활성 등 계산.

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
    /** 오늘 신규 가입 수. */
    newSignups: number;
    /** 오늘 DAU — distinct user 가 readings/today_feedback/dialogue 중 하나 이상 활동. */
    activeUsers: number;
    /** 오늘 결제 건수 (type='purchase'). */
    purchaseCount: number;
    /** 오늘 결제로 충전된 코인 총량 (amount > 0). */
    purchasedCredits: number;
    /** 오늘 사주 풀이 작성 건수. */
    readingsCreated: number;
    /** 오늘 누적 피드백 건수. */
    feedbackCount: number;
  };
  /** 누적 (현재 시점). */
  lifetime: {
    /** 총 가입자 (signup_bonus 트랜잭션 count). */
    totalUsers: number;
    /** 활성 구독자 (status='active'). */
    activeSubscribers: number;
    /** 누적 사주 풀이 작성 건수. */
    totalReadings: number;
    /** 누적 결제 건수. */
    totalPurchases: number;
    /** 누적 충전된 코인 총량. */
    totalPurchasedCredits: number;
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

function buildEmptySeries(days: number, endDate: Date): DailySeries[] {
  const series: DailySeries[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(endDate);
    d.setUTCDate(endDate.getUTCDate() - i);
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

/**
 * 운영 메트릭 한 번에 산출.
 */
export async function buildOperationsSnapshot(
  client: SupabaseClient,
  options: { windowDays?: number } = {}
): Promise<OperationsSnapshot> {
  const windowDays = Math.max(7, Math.min(60, options.windowDays ?? 14));
  const now = new Date();
  const todayKey = toLocalDateKey(now.toISOString());

  // 윈도우 시작 (KST 시간대 오늘 00:00 - windowDays).
  const windowStart = new Date(now);
  windowStart.setUTCDate(now.getUTCDate() - windowDays);

  // 병렬 쿼리.
  const [
    signupResp,
    creditTxResp,
    purchaseResp,
    readingsResp,
    feedbackResp,
    activitySources,
    subscriptionsResp,
    totalReadingsCountResp,
    totalUsersCountResp,
  ] = await Promise.all([
    // 신규 가입 (signup_bonus 트랜잭션).
    client
      .from('credit_transactions')
      .select('user_id, created_at')
      .eq('type', 'signup_bonus')
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: true })
      .limit(50_000),

    // 결제 (purchase type, 윈도우 내).
    client
      .from('credit_transactions')
      .select('user_id, amount, created_at')
      .eq('type', 'purchase')
      .gt('amount', 0)
      .gte('created_at', windowStart.toISOString())
      .limit(50_000),

    // 전체 결제 — lifetime 통계용.
    client
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('type', 'purchase')
      .gt('amount', 0)
      .limit(50_000),

    // readings — 윈도우 내.
    client
      .from('readings')
      .select('user_id, created_at')
      .not('user_id', 'is', null)
      .gte('created_at', windowStart.toISOString())
      .limit(50_000),

    // today_fortune_feedback — 만족도 윈도우 내 + 만족도 30일 분석.
    client
      .from('today_fortune_feedback')
      .select('overall_rating, wealth_rating, love_rating, career_rating, health_rating, relationship_rating, created_at, user_id')
      .gte('created_at', windowStart.toISOString())
      .limit(50_000),

    // 활동 소스 — readings + today_fortune_feedback + dialogue_messages 의 user_id+date.
    // readings 는 위에서 가져왔으니 여기서 dialogue 만 한 번 더.
    client
      .from('dialogue_messages')
      .select('user_id, created_at')
      .gte('created_at', windowStart.toISOString())
      .limit(50_000),

    // 활성 구독.
    client
      .from('subscriptions')
      .select('user_id', { count: 'exact', head: true })
      .eq('status', 'active'),

    // 누적 사주 readings count.
    client
      .from('readings')
      .select('id', { count: 'exact', head: true })
      .not('user_id', 'is', null),

    // 누적 가입자.
    client
      .from('credit_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'signup_bonus'),
  ]);

  const signupRows = (signupResp.data ?? []) as Array<{ user_id: string; created_at: string }>;
  const purchaseRows = (creditTxResp.data ?? []) as Array<{
    user_id: string;
    amount: number;
    created_at: string;
  }>;
  const allPurchaseRows = (purchaseResp.data ?? []) as Array<{ amount: number; created_at: string }>;
  const readingsRows = (readingsResp.data ?? []) as Array<{ user_id: string; created_at: string }>;
  const feedbackRows = (feedbackResp.data ?? []) as Array<{
    overall_rating: number;
    wealth_rating: number | null;
    love_rating: number | null;
    career_rating: number | null;
    health_rating: number | null;
    relationship_rating: number | null;
    created_at: string;
    user_id: string;
  }>;
  const dialogueRows = (activitySources.data ?? []) as Array<{
    user_id: string;
    created_at: string;
  }>;

  // 일별 추이 시리즈 빌드 — 오래된 → 최신.
  const seriesSkeleton = buildEmptySeries(windowDays, now);
  const trends = {
    newSignups: fillSeries(seriesSkeleton, countByDate(signupRows)),
    purchaseCount: fillSeries(seriesSkeleton, countByDate(purchaseRows)),
    readingsCreated: fillSeries(seriesSkeleton, countByDate(readingsRows)),
    // DAU 추이 — 일별 distinct user_id.
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

  // 만족도 통계 — 윈도우 내 피드백.
  const sample = feedbackRows.length;
  let totalRating = 0;
  let correctN = 0;
  let partialN = 0;
  let missN = 0;
  const areaSums = { wealth: 0, love: 0, career: 0, health: 0, relationship: 0 };
  const areaCounts = { wealth: 0, love: 0, career: 0, health: 0, relationship: 0 };
  for (const row of feedbackRows) {
    totalRating += row.overall_rating;
    if (row.overall_rating === 1) correctN += 1;
    else if (row.overall_rating === 0) partialN += 1;
    else missN += 1;
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
      newSignups: todaySignups,
      activeUsers: todayActiveUsers.size,
      purchaseCount: todayPurchaseRows.length,
      purchasedCredits: todayPurchaseRows.reduce((sum, r) => sum + r.amount, 0),
      readingsCreated: todayReadings,
      feedbackCount: todayFeedback,
    },
    lifetime: {
      totalUsers: totalUsersCountResp.count ?? 0,
      activeSubscribers: subscriptionsResp.count ?? 0,
      totalReadings: totalReadingsCountResp.count ?? 0,
      totalPurchases: allPurchaseRows.length,
      totalPurchasedCredits: allPurchaseRows.reduce((sum, r) => sum + r.amount, 0),
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
