import assert from 'node:assert/strict';
import {
  buildVercelRangeChunks,
  buildVercelRangeAttempts,
  getExternalAnalyticsSnapshot,
  normalizeExternalDate,
  parseGoogleAnalyticsRows,
  parseVercelAnalyticsRows,
} from './external-analytics';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = new Date('2026-07-07T05:00:00Z'); // KST 2026-07-07

test('normalizeExternalDate: GA4 YYYYMMDD, date key, ISO timestamp 지원', () => {
  assert.equal(normalizeExternalDate('20260705'), '2026-07-05');
  assert.equal(normalizeExternalDate('2026-07-06'), '2026-07-06');
  assert.equal(normalizeExternalDate('2026-07-07T00:00:00Z'), '2026-07-07');
  assert.equal(normalizeExternalDate('bad-date'), null);
});

test('parseGoogleAnalyticsRows: date + activeUsers + screenPageViews 파싱', () => {
  const rows = parseGoogleAnalyticsRows({
    rows: [
      {
        dimensionValues: [{ value: '20260706' }],
        metricValues: [{ value: '12' }, { value: '34' }],
      },
    ],
  });

  assert.deepEqual(rows.get('2026-07-06'), { activeUsers: 12, pageViews: 34 });
});

test('parseVercelAnalyticsRows: 다양한 aggregate 응답 필드명 정규화', () => {
  const rows = parseVercelAnalyticsRows({
    data: [
      { day: '2026-07-06', visitors: '9', pageViews: '21' },
      { timestamp: '2026-07-07T00:00:00Z', uniqueVisitors: 5, count: 13 },
    ],
  });

  assert.deepEqual(rows.get('2026-07-06'), { visitors: 9, pageViews: 21 });
  assert.deepEqual(rows.get('2026-07-07'), { visitors: 5, pageViews: 13 });
});

test('getExternalAnalyticsSnapshot: 외부 env 없으면 null gap-fill + source 미설정', async () => {
  const snap = await getExternalAnalyticsSnapshot(3, NOW, {}, async () => {
    throw new Error('fetch should not be called');
  });

  assert.equal(snap.windowDays, 3);
  assert.deepEqual(snap.daily.map((d) => d.date), ['2026-07-05', '2026-07-06', '2026-07-07']);
  assert.equal(snap.sources.googleAnalytics.configured, false);
  assert.equal(snap.sources.vercel.configured, false);
  assert.deepEqual(snap.totals, {
    gaActiveUsers: null,
    gaPageViews: null,
    vercelVisitors: null,
    vercelPageViews: null,
  });
});

test('getExternalAnalyticsSnapshot: Vercel만 설정되면 일별 PV를 축에 병합', async () => {
  const calls: string[] = [];
  const snap = await getExternalAnalyticsSnapshot(
    3,
    NOW,
    {
      VERCEL_ANALYTICS_TOKEN: 'token',
      VERCEL_PROJECT_ID: 'project',
    },
    async (input) => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({
          data: [
            { day: '2026-07-06', count: '10' },
            { day: '2026-07-07', pageViews: 20 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(snap.sources.vercel.configured, true);
  assert.equal(snap.sources.vercel.ok, true);
  assert.deepEqual(
    snap.daily.map((d) => d.vercelPageViews),
    [0, 10, 20]
  );
  assert.equal(snap.totals.vercelPageViews, 30);
});

test('buildVercelRangeAttempts: KST 오늘이 UTC 기준 미래면 Vercel until을 UTC 오늘로 제한', () => {
  const attempts = buildVercelRangeAttempts(
    '2026-07-08',
    '2026-07-10',
    new Date('2026-07-09T16:00:00Z')
  );

  assert.deepEqual(attempts[0], { fromKey: '2026-07-08', toKey: '2026-07-09' });
});

test('buildVercelRangeChunks: Vercel aggregate limit에 맞춰 100일 이하로 분할', () => {
  assert.deepEqual(buildVercelRangeChunks('2026-01-01', '2026-04-15'), [
    { fromKey: '2026-01-01', toKey: '2026-04-10' },
    { fromKey: '2026-04-11', toKey: '2026-04-15' },
  ]);
});

test('getExternalAnalyticsSnapshot: Vercel 100일 초과 조회는 limit=100 chunk로 호출', async () => {
  const calls: string[] = [];
  const snap = await getExternalAnalyticsSnapshot(
    105,
    NOW,
    {
      VERCEL_ANALYTICS_TOKEN: 'token',
      VERCEL_PROJECT_ID: 'project',
    },
    async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  );

  const expectedChunks = buildVercelRangeChunks(snap.from, snap.to);
  assert.equal(calls.length, expectedChunks.length);
  for (let i = 0; i < calls.length; i += 1) {
    const url = new URL(calls[i]!);
    assert.equal(url.searchParams.get('limit'), '100');
    assert.equal(url.searchParams.get('since'), expectedChunks[i]!.fromKey);
    assert.equal(url.searchParams.get('until'), expectedChunks[i]!.toKey);
  }
  assert.equal(snap.sources.vercel.ok, true);
});

test('getExternalAnalyticsSnapshot: Vercel reporting window 오류면 30일 fallback으로 재시도', async () => {
  const calls: string[] = [];
  const snap = await getExternalAnalyticsSnapshot(
    90,
    NOW,
    {
      VERCEL_ANALYTICS_TOKEN: 'token',
      VERCEL_PROJECT_ID: 'project',
      VERCEL_TEAM_ID: 'team',
    },
    async (input) => {
      calls.push(String(input));
      if (calls.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'outside reporting window' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          data: [{ timestamp: '2026-07-07T00:00:00.000Z', pageviews: 7, visitors: 3 }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  );

  assert.equal(calls.length, 2);
  assert.match(calls[0]!, /since=2026-04-09/);
  assert.match(calls[1]!, /since=2026-06-08/);
  assert.match(calls[1]!, /teamId=team/);
  assert.equal(snap.sources.vercel.ok, true);
  assert.equal(snap.sources.vercel.error, null);
  assert.equal(snap.sources.vercel.warning, 'Vercel 조회 가능 기간 제한으로 2026-06-08~2026-07-07만 표시');
  assert.equal(snap.totals.vercelPageViews, 7);
});

// 2026-09-02 회귀 가드 — GA4 JWT 는 **언제나 진짜 현재 시각**으로 서명한다.
//
//   2026-09-01 달력 기간(#765)에서 '기간 마지막 날 정오'를 두 번째 인자로 흘려보냈고,
//   그 값이 날짜 축과 **JWT iat/exp 양쪽**에 쓰이는 바람에 GA4 가 전부 거부됐다:
//     invalid_grant — "Token must be a short-lived token (60 minutes) and in a
//     reasonable timeframe."
//   실측(2026-09-02): 실제 시각 서명 200, 오늘 12:00 KST 서명 400, 지난 기간 서명 400.
//   축(기간)과 시계(인증)를 다시 섞으면 여기서 걸린다.
test('GA4: 지난 기간을 조회해도 JWT 는 현재 시각으로 서명한다(invalid_grant 회귀)', async () => {
  // RS256 서명이 필요하므로 테스트용 키를 즉석 생성(외부 비밀 불필요).
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });

  const axisEnd = new Date('2026-03-31T03:00:00Z'); // 지난 기간(3월) 마지막 날 정오 KST
  let assertionIat: number | null = null;

  await getExternalAnalyticsSnapshot(
    31,
    axisEnd,
    {
      GOOGLE_ANALYTICS_PROPERTY_ID: '123456789',
      GOOGLE_ANALYTICS_CLIENT_EMAIL: 'svc@example.iam.gserviceaccount.com',
      GOOGLE_ANALYTICS_PRIVATE_KEY: privateKey,
    },
    async (input, init) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com/token')) {
        const body = String((init as { body?: unknown } | undefined)?.body ?? '');
        const assertion = new URLSearchParams(body).get('assertion') ?? '';
        const claim = JSON.parse(
          Buffer.from(assertion.split('.')[1] ?? '', 'base64url').toString('utf8')
        ) as { iat: number; exp: number };
        assertionIat = claim.iat;
        return new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 });
      }
      return new Response(JSON.stringify({ rows: [] }), { status: 200 });
    }
  );

  assert.ok(assertionIat != null, 'GA4 토큰 요청이 일어나야 한다');
  const skewSec = Math.abs(Math.floor(Date.now() / 1000) - (assertionIat as number));
  assert.ok(
    skewSec < 60,
    `JWT iat 가 현재 시각에서 ${skewSec}초 떨어져 있다 — 기간 값이 서명 시각으로 새면 Google 이 invalid_grant 로 거부한다`
  );
});

test('GA4: 축은 여전히 요청한 기간을 따른다(회귀 수정이 기간을 망가뜨리지 않았는지)', async () => {
  const snap = await getExternalAnalyticsSnapshot(3, new Date('2026-03-31T03:00:00Z'), {}, async () => {
    throw new Error('fetch should not be called');
  });
  assert.deepEqual(
    snap.daily.map((d) => d.date),
    ['2026-03-29', '2026-03-30', '2026-03-31']
  );
});
