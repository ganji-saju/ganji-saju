// 2026-05-15 — 운영 모니터링 메트릭 산출 검증.
// SupabaseClient 를 모킹하여 buildOperationsSnapshot 가 올바른 집계를 반환하는지 점검.
import assert from 'node:assert/strict';
import { buildOperationsSnapshot } from './operations-stats';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

type Row = Record<string, unknown>;

interface MockResponse {
  data?: Row[] | null;
  count?: number;
}

/**
 * 표 키 → 응답 매핑으로 SupabaseClient 흉내. select().eq().gte().limit() 체이닝을
 * 종착점에서 await 하면 응답이 반환되도록 thenable 객체로 흘려보낸다.
 */
function createMockClient(table: Record<string, MockResponse | MockResponse[]>) {
  const counters: Record<string, number> = {};
  const builder = (tableName: string) => {
    const responses = (() => {
      const v = table[tableName];
      if (!v) return [{ data: [] }];
      return Array.isArray(v) ? v : [v];
    })();

    const handler = {
      select: () => handler,
      eq: () => handler,
      gt: () => handler,
      gte: () => handler,
      lte: () => handler,
      lt: () => handler,
      not: () => handler,
      order: () => handler,
      limit: () => handler,
      then: (resolve: (value: MockResponse) => unknown) => {
        const idx = counters[tableName] ?? 0;
        counters[tableName] = idx + 1;
        const response = responses[Math.min(idx, responses.length - 1)] ?? { data: [] };
        return Promise.resolve(response).then(resolve);
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

test('buildOperationsSnapshot - 만족도 분포 계산', async () => {
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

test('buildOperationsSnapshot - DAU 는 union distinct', async () => {
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
  // 오늘 DAU: u1, u2, u3, u4 = 4 distinct
  assert.equal(snap.today.activeUsers, 4);
});

test('buildOperationsSnapshot - lifetime count 반영', async () => {
  // count: head=true 쿼리는 count 필드를 반환.
  const client = createMockClient({
    credit_transactions: [
      { data: [] }, // signupResp (window)
      { data: [] }, // creditTxResp (window purchases)
      { data: [] }, // purchaseResp (lifetime)
      { count: 1234 }, // totalUsersCountResp
    ],
    readings: [
      { data: [] }, // readingsResp (window)
      { count: 5678 }, // totalReadingsCountResp
    ],
    subscriptions: { count: 42 },
  });
  const snap = await buildOperationsSnapshot(client);
  assert.equal(snap.lifetime.activeSubscribers, 42);
  // 호출 순서가 Promise.all 안에서 동시 진행되어도 from(table) 호출 순서로 counter 증가.
  // 위 mock 은 같은 table 의 호출 순서대로 응답을 매핑.
});
