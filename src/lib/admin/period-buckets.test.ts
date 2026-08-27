// 주(월~일) 집계 회귀 가드.
import assert from 'node:assert/strict';
import { aggregateWeekly, weekStartKey, weekdayLabel } from './period-buckets';
import type { DailyMetricPoint } from './analytics-metrics';

declare const test: (name: string, fn: () => void) => void;

function day(date: string, over: Partial<DailyMetricPoint> = {}): DailyMetricPoint {
  return {
    date,
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
    ...over,
  };
}

test('주 시작은 언제나 월요일이다', () => {
  assert.equal(weekStartKey('2026-08-24'), '2026-08-24'); // 월 → 그대로
  assert.equal(weekStartKey('2026-08-27'), '2026-08-24'); // 목
  assert.equal(weekStartKey('2026-08-30'), '2026-08-24'); // 일 → 같은 주의 월요일
  assert.equal(weekStartKey('2026-08-31'), '2026-08-31'); // 다음 월요일
});

// 🔴 일요일이 다음 주로 넘어가면 주간 매출이 통째로 어긋난다(일=0 인 getUTCDay 를
//   그대로 쓰면 생기는 전형적인 off-by-one). 경계 이틀을 못박는다.
test('일요일은 이전 주에, 월요일은 새 주에 들어간다', () => {
  const weeks = aggregateWeekly([
    day('2026-08-30', { paidOrders: 1 }), // 일
    day('2026-08-31', { paidOrders: 1 }), // 월
  ]);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].weekStart, '2026-08-24');
  assert.equal(weeks[0].weekEnd, '2026-08-30');
  assert.equal(weeks[1].weekStart, '2026-08-31');
});

// 🔴 비율을 날짜별로 평균 내면 방문 2명인 날과 200명인 날이 같은 무게가 된다.
//   합계에서 다시 나눠야 한다 — 이 테스트가 그 계약이다.
test('주간 비율은 평균이 아니라 합계에서 다시 계산한다', () => {
  const [week] = aggregateWeekly([
    day('2026-08-24', { visitors: 2, paidOrders: 1, visitorToPaidRate: 0.5 }),
    day('2026-08-25', { visitors: 198, paidOrders: 1, visitorToPaidRate: 1 / 198 }),
  ]);
  assert.equal(week.visitors, 200);
  assert.equal(week.paidOrders, 2);
  assert.equal(week.visitorToPaidRate, 2 / 200); // 평균(0.2525…)이 아니다
});

test('분모 0 이면 비율은 null(0% 아님)', () => {
  const [week] = aggregateWeekly([day('2026-08-24')]);
  assert.equal(week.visitorToPaidRate, null);
  assert.equal(week.checkoutConversionRate, null);
});

test('7일이 안 차면 partial — 잘린 주를 온전한 주처럼 비교하지 않는다', () => {
  const full = aggregateWeekly(
    ['24', '25', '26', '27', '28', '29', '30'].map((d) => day(`2026-08-${d}`))
  );
  assert.equal(full[0].days, 7);
  assert.equal(full[0].partial, false);
  const cut = aggregateWeekly([day('2026-08-27'), day('2026-08-28')]);
  assert.equal(cut[0].days, 2);
  assert.equal(cut[0].partial, true);
});

test('입력 순서와 무관하게 오름차순으로 나온다', () => {
  const weeks = aggregateWeekly([day('2026-08-31'), day('2026-08-17'), day('2026-08-24')]);
  assert.deepEqual(
    weeks.map((w) => w.weekStart),
    ['2026-08-17', '2026-08-24', '2026-08-31']
  );
});

test('요일 라벨', () => {
  assert.equal(weekdayLabel('2026-08-24'), '월');
  assert.equal(weekdayLabel('2026-08-30'), '일');
});
