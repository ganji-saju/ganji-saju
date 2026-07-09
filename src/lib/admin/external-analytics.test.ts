import assert from 'node:assert/strict';
import {
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
