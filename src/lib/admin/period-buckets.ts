// 2026-08-27 — 관리자 지표의 **기간 단위 집계**(일 / 주). 사용자 지시:
//   "데이터를 일단위로 매일매일 볼 수 있게 날짜로 표시 · 주단위도 월요일부터 일요일까지".
//
//   ⚠️ 여기서 '주'는 최근 7일 rolling 이 아니라 **달력 주(월~일)** 다. 기간 프리셋
//      (metric-ranges.ts)의 '주(7일)'는 조회 **윈도우 길이**고, 이 파일은 그 윈도우 안의
//      날짜를 월~일로 **묶는** 일을 한다 — 둘은 다른 축이라 서로 바꾸지 않는다.
//
//   ⚠️ 비율은 **절대 평균 내지 않는다**. 7일치 전환율을 평균하면 방문 3명인 날과 300명인 날이
//      같은 무게가 되어 주간 전환율이 실제와 크게 어긋난다. 합계에서 다시 나눈다.
import { shiftDateKey } from './analytics-rollup';
import type { DailyMetricPoint } from './analytics-metrics';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 'YYYY-MM-DD'(KST 날짜키)의 요일 한 글자. */
export function weekdayLabel(dateKey: string): string {
  return WEEKDAY[new Date(`${dateKey}T00:00:00Z`).getUTCDay()];
}

/** 그 날짜가 속한 주(월~일)의 **월요일** 날짜키. */
export function weekStartKey(dateKey: string): string {
  const dow = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토
  return shiftDateKey(dateKey, -((dow + 6) % 7)); // 월=0칸, 일=6칸 뒤로
}

export interface MetricSums {
  /** 집계에 들어간 날 수. */
  days: number;
  visitors: number;
  pageViews: number;
  newSignups: number;
  paidOrders: number;
  revenueWon: number;
  refundedOrders: number;
  refundedWon: number;
  netRevenueWon: number;
  prepareAttempts: number;
  checkoutStarts: number;
  confirmSuccess: number;
  visitorToPaidRate: number | null;
  checkoutConversionRate: number | null;
}

export interface WeeklyMetricPoint extends MetricSums {
  /** 주 시작(월요일) 날짜키 — 정렬·key 용. */
  weekStart: string;
  /** 주 끝(일요일) 날짜키. 데이터가 없는 날도 포함한 **달력상** 끝이다. */
  weekEnd: string;
  /** '08-24 ~ 08-30' */
  label: string;
  /** days < 7 — 화면에서 '부분'으로 표시해 다른 주와 나란히 비교하지 않게 한다. */
  partial: boolean;
}

// 분모 0 이면 비율은 정의되지 않음 → null(화면 '—'). 0% 로 강등하면 트래픽 없는 구간이
// '전환 0%' 처럼 보여 판단을 흐린다(analytics-metrics 의 rate() 와 같은 계약).
function rate(numer: number, denom: number): number | null {
  return denom > 0 ? numer / denom : null;
}

/**
 * 일별 포인트들의 합계. **비율은 합계에서 다시 계산한다** — 날짜별 비율을 평균하면
 * 방문 2명인 날과 200명인 날이 같은 무게가 되어 실제와 크게 어긋난다.
 * 주간 집계도 기간 합계도 전부 이 함수 하나를 지난다(두 곳이 갈라지지 않게).
 */
export function sumDaily(daily: readonly DailyMetricPoint[]): MetricSums {
  const s: MetricSums = {
    days: 0,
    visitors: 0,
    pageViews: 0,
    newSignups: 0,
    paidOrders: 0,
    revenueWon: 0,
    refundedOrders: 0,
    refundedWon: 0,
    netRevenueWon: 0,
    prepareAttempts: 0,
    checkoutStarts: 0,
    confirmSuccess: 0,
    visitorToPaidRate: null,
    checkoutConversionRate: null,
  };
  for (const d of daily) {
    s.days += 1;
    s.visitors += d.visitors;
    s.pageViews += d.pageViews;
    s.newSignups += d.newSignups;
    s.paidOrders += d.paidOrders;
    s.revenueWon += d.revenueWon;
    s.refundedOrders += d.refundedOrders;
    s.refundedWon += d.refundedWon;
    s.netRevenueWon += d.netRevenueWon;
    s.prepareAttempts += d.prepareAttempts;
    s.checkoutStarts += d.checkoutStarts;
    s.confirmSuccess += d.confirmSuccess;
  }
  s.visitorToPaidRate = rate(s.paidOrders, s.visitors);
  s.checkoutConversionRate = rate(s.confirmSuccess, s.prepareAttempts);
  return s;
}

/**
 * 일별 포인트를 달력 주(월~일)로 묶는다. 입력 순서와 무관하며 결과는 **오름차순**.
 */
export function aggregateWeekly(daily: readonly DailyMetricPoint[]): WeeklyMetricPoint[] {
  const groups = new Map<string, DailyMetricPoint[]>();
  for (const d of daily) {
    const key = weekStartKey(d.date);
    const bucket = groups.get(key);
    if (bucket) bucket.push(d);
    else groups.set(key, [d]);
  }

  return Array.from(groups.entries())
    .map(([weekStart, days]) => {
      const weekEnd = shiftDateKey(weekStart, 6);
      const sums = sumDaily(days);
      return {
        ...sums,
        weekStart,
        weekEnd,
        label: `${weekStart.slice(5)} ~ ${weekEnd.slice(5)}`,
        partial: sums.days < 7,
      };
    })
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0));
}
