// 2026-05-15 — 운영 모니터링 메트릭 산출 검증.
// SupabaseClient 를 모킹하여 buildOperationsSnapshot 가 올바른 집계를 반환하는지 점검.
// 2026-07-04 감사 반영: 결제 소스 payment_orders 전환·range 페이지네이션·maybeSingle 지원.
import assert from 'node:assert/strict';
import { buildOperationsSnapshot } from './operations-stats';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

type Row = Record<string, unknown>;

interface MockResponse {
  data?: Row[] | Row | null;
  count?: number;
  error?: { message: string } | null;
}

/**
 * 표 키 → 응답 매핑으로 SupabaseClient 흉내. select().eq().gte().range() 체이닝을
 * 종착점에서 await 하면 응답이 반환되도록 thenable 객체로 흘려보낸다.
 * 같은 테이블의 N번째 from() 호출은 responses[N] 을 반환(순서 매핑).
 */
function createMockClient(table: Record<string, MockResponse | MockResponse[]>) {
  const counters: Record<string, number> = {};
  const builder = (tableName: string) => {
    const responses = (() => {
      const v = table[tableName];
      if (!v) return [{ data: [] }];
      return Array.isArray(v) ? v : [v];
    })();

    const idx = counters[tableName] ?? 0;
    counters[tableName] = idx + 1;
    const response = responses[Math.min(idx, responses.length - 1)] ?? { data: [] };

    const handler = {
      select: () => handler,
      eq: () => handler,
      gt: () => handler,
      gte: () => handler,
      lte: () => handler,
      lt: () => handler,
      not: () => handler,
      in: () => handler,
      or: () => handler,
      order: () => handler,
      limit: () => handler,
      range: () => handler,
      maybeSingle: () => handler,
      then: (resolve: (value: MockResponse & { error: { message: string } | null }) => unknown) => {
        return Promise.resolve({ error: null, ...response }).then(resolve);
      },
    };
    return handler;
  };

  return {
    from: (tableName: string) => builder(tableName),
  } as unknown as Parameters<typeof buildOperationsSnapshot>[0];
}

test('buildOperationsSnapshot - 빈 데이터셋', async () => {
  const client = createMockClient({});
  const snap = await buildOperationsSnapshot(client, { windowDays: 14 });
  assert.equal(snap.windowDays, 14);
  assert.equal(snap.today.newSignups, 0);
  assert.equal(snap.today.activeUsers, 0);
  assert.equal(snap.today.purchaseCount, 0);
  assert.equal(snap.today.purchaseAmountWon, 0);
  assert.equal(snap.satisfaction.sampleSize, 0);
  assert.equal(snap.satisfaction.averageRating, 0);
  assert.equal(snap.lifetime.totalUsers, 0);
  assert.equal(snap.trends.newSignups.length, 14);
});

test('buildOperationsSnapshot - windowDays clamp', async () => {
  const client = createMockClient({});
  const tooSmall = await buildOperationsSnapshot(client, { windowDays: 1 });
  assert.equal(tooSmall.windowDays, 7);
  const client2 = createMockClient({});
  const tooLarge = await buildOperationsSnapshot(client2, { windowDays: 9999 });
  assert.equal(tooLarge.windowDays, 60);
});

test('buildOperationsSnapshot - 시리즈 축 마지막 날짜 = KST 오늘', async () => {
  // 축이 UTC 로 생성되면 KST 00~09시에 오늘 버킷이 통째로 사라지던 회귀 가드.
  const client = createMockClient({});
  const snap = await buildOperationsSnapshot(client, { windowDays: 14 });
  const kstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  assert.equal(snap.trends.newSignups[snap.trends.newSignups.length - 1].date, kstToday);
});

test('buildOperationsSnapshot - 만족도 분포 계산 (null rating 표본 제외)', async () => {
  const now = new Date().toISOString();
  const client = createMockClient({
    today_fortune_feedback: {
      data: [
        {
          overall_rating: 1,
          wealth_rating: 5,
          love_rating: 4,
          career_rating: null,
          health_rating: 3,
          relationship_rating: 4,
          created_at: now,
          user_id: 'u1',
        },
        {
          overall_rating: 1,
          wealth_rating: 4,
          love_rating: 3,
          career_rating: 5,
          health_rating: null,
          relationship_rating: 3,
          created_at: now,
          user_id: 'u2',
        },
        {
          overall_rating: 0,
          wealth_rating: 3,
          love_rating: 3,
          career_rating: 3,
          health_rating: 3,
          relationship_rating: 3,
          created_at: now,
          user_id: 'u3',
        },
        {
          overall_rating: -1,
          wealth_rating: 1,
          love_rating: 2,
          career_rating: 2,
          health_rating: 1,
          relationship_rating: 2,
          created_at: now,
          user_id: 'u4',
        },
        {
          // 2026-07-04 — 유효하지 않은 rating(null)은 표본에서 제외(기존엔 miss 오분류+NaN).
          overall_rating: null,
          wealth_rating: null,
          love_rating: null,
          career_rating: null,
          health_rating: null,
          relationship_rating: null,
          created_at: now,
          user_id: 'u5',
        },
      ],
    },
  });
  const snap = await buildOperationsSnapshot(client, { windowDays: 14 });
  assert.equal(snap.satisfaction.sampleSize, 4);
  // (1 + 1 + 0 - 1) / 4 = 0.25
  assert.equal(snap.satisfaction.averageRating, 0.25);
  assert.equal(snap.satisfaction.correctRate, 0.5); // 2/4
  assert.equal(snap.satisfaction.partialRate, 0.25); // 1/4
  assert.equal(snap.satisfaction.missRate, 0.25); // 1/4
  // wealth: (5+4+3+1)/4 = 3.25
  assert.equal(snap.satisfaction.areaAverages.wealth, 3.25);
  // career: (null + 5 + 3 + 2)/3 = 3.33...
  assert.equal(snap.satisfaction.areaAverages.career, 3.33);
});

test('buildOperationsSnapshot - 활동 사용자는 union distinct', async () => {
  const now = new Date().toISOString();
  const client = createMockClient({
    readings: {
      data: [
        { user_id: 'u1', created_at: now },
        { user_id: 'u2', created_at: now },
      ],
    },
    today_fortune_feedback: {
      data: [
        {
          overall_rating: 1,
          wealth_rating: null,
          love_rating: null,
          career_rating: null,
          health_rating: null,
          relationship_rating: null,
          created_at: now,
          user_id: 'u2', // 중복
        },
        {
          overall_rating: 1,
          wealth_rating: null,
          love_rating: null,
          career_rating: null,
          health_rating: null,
          relationship_rating: null,
          created_at: now,
          user_id: 'u3',
        },
      ],
    },
    dialogue_messages: {
      data: [{ user_id: 'u4', created_at: now }],
    },
  });
  const snap = await buildOperationsSnapshot(client);
  // 오늘 활동자: u1, u2, u3, u4 = 4 distinct
  assert.equal(snap.today.activeUsers, 4);
});

test('buildOperationsSnapshot - 결제는 payment_orders 완료 상태 기준(원화 합산)', async () => {
  const now = new Date().toISOString();
  const client = createMockClient({
    payment_orders: [
      // window
      {
        data: [
          { user_id: 'u1', amount: 9900, created_at: now },
          { user_id: 'u2', amount: 49000, created_at: now },
        ],
      },
      // lifetime
      {
        data: [
          { amount: 9900, created_at: now },
          { amount: 49000, created_at: now },
          { amount: 990, created_at: '2026-01-01T00:00:00.000Z' },
        ],
      },
    ],
  });
  const snap = await buildOperationsSnapshot(client);
  assert.equal(snap.today.purchaseCount, 2);
  assert.equal(snap.today.purchaseAmountWon, 58900);
  assert.equal(snap.lifetime.totalPurchases, 3);
  assert.equal(snap.lifetime.totalPurchaseAmountWon, 59890);
});

test('buildOperationsSnapshot - lifetime count 반영', async () => {
  // count: head=true 쿼리는 count 필드를 반환.
  // admin_user_summary from() 순서: ① signups(window rows) ② totalUsers count ③ refreshed_at maybeSingle
  const client = createMockClient({
    admin_user_summary: [
      { data: [] },
      { count: 1234 },
      { data: { refreshed_at: '2026-07-04T00:00:00.000Z' } },
    ],
    readings: [
      { data: [] }, // window rows
      { count: 5678 }, // lifetime count
    ],
    subscriptions: { count: 42 },
  });
  const snap = await buildOperationsSnapshot(client);
  assert.equal(snap.lifetime.activeSubscribers, 42);
  assert.equal(snap.lifetime.totalUsers, 1234);
  assert.equal(snap.lifetime.totalReadings, 5678);
  assert.equal(snap.lifetime.summaryRefreshedAt, '2026-07-04T00:00:00.000Z');
});
