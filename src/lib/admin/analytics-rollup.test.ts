import assert from 'node:assert/strict';
import {
  kstDateKey,
  shiftDateKey,
  dateAxis,
  recentKstDateKeys,
  kstMidnightIso,
  paymentAttributionIso,
  computeDailyMetrics,
} from './analytics-rollup';

declare const test: (name: string, fn: () => void) => void;

test('kstDateKey: UTC→KST(+9) 경계 — 15:00Z 는 다음 날', () => {
  assert.equal(kstDateKey('2026-07-06T15:00:00Z'), '2026-07-07'); // +9 = 07-07 00:00
  assert.equal(kstDateKey('2026-07-06T14:59:00Z'), '2026-07-06'); // +9 = 07-06 23:59
  assert.equal(kstDateKey('2026-07-06T00:00:00Z'), '2026-07-06');
});

test('shiftDateKey / dateAxis / recentKstDateKeys', () => {
  assert.equal(shiftDateKey('2026-07-06', -1), '2026-07-05');
  assert.equal(shiftDateKey('2026-07-31', 1), '2026-08-01');
  assert.deepEqual(dateAxis('2026-07-05', '2026-07-07'), ['2026-07-05', '2026-07-06', '2026-07-07']);
  // now = KST 07-07 14:00 → 최근 3일.
  assert.deepEqual(
    recentKstDateKeys(3, new Date('2026-07-07T05:00:00Z')),
    ['2026-07-05', '2026-07-06', '2026-07-07']
  );
});

test('kstMidnightIso: KST 자정 → UTC 전날 15:00Z', () => {
  assert.equal(kstMidnightIso('2026-07-07'), '2026-07-06T15:00:00.000Z');
});

test('paymentAttributionIso: confirmed → fulfilled → created 우선순위', () => {
  assert.equal(
    paymentAttributionIso({ amount: 1, confirmed_at: 'C', fulfilled_at: 'F', created_at: 'X' }),
    'C'
  );
  assert.equal(
    paymentAttributionIso({ amount: 1, confirmed_at: null, fulfilled_at: 'F', created_at: 'X' }),
    'F'
  );
  assert.equal(
    paymentAttributionIso({ amount: 1, confirmed_at: null, fulfilled_at: null, created_at: 'X' }),
    'X'
  );
});

test('computeDailyMetrics: KST 버킷 + 전환 카운트 + 유입 파싱 + 윈도우 밖 결제 제외', () => {
  const dateKeys = ['2026-07-05', '2026-07-06', '2026-07-07'];
  const rows = computeDailyMetrics({
    dateKeys,
    sourceRows: [
      {
        date_key: '2026-07-06',
        visitors: 10,
        page_views: 25,
        inflow_referrers: [{ host: 'google.com', visitors: 6 }],
        inflow_utm: [{ source: 'naver', medium: 'cpc', campaign: 'x', visitors: 3 }],
      },
    ],
    signupIsos: [
      '2026-07-05T20:00:00Z', // +9 = 07-06 05:00 → 07-06
      '2026-07-06T14:59:00Z', // +9 = 07-06 23:59 → 07-06
      '2026-07-06T15:00:00Z', // +9 = 07-07 00:00 → 07-07
    ],
    paymentRows: [
      { amount: 9900, confirmed_at: '2026-07-06T01:00:00Z', fulfilled_at: null, created_at: '2026-07-06T00:00:00Z' }, // 07-06
      { amount: 990, confirmed_at: null, fulfilled_at: null, created_at: '2026-07-06T20:00:00Z' }, // +9 → 07-07
      { amount: 5000, confirmed_at: '2026-07-01T01:00:00Z', fulfilled_at: null, created_at: '2026-07-01T00:00:00Z' }, // 윈도우 밖 → 제외
    ],
    funnelRows: [
      { stage: 'prepare_attempt', created_at: '2026-07-06T02:00:00Z' },
      { stage: 'confirm_attempt', created_at: '2026-07-06T02:05:00Z' },
      { stage: 'confirm_success', created_at: '2026-07-06T02:06:00Z' },
      { stage: 'prepare_attempt', created_at: '2026-07-05T02:00:00Z' },
      { stage: 'prepare_blocked', created_at: '2026-07-06T02:00:00Z' }, // 무시(카운트 대상 아님)
    ],
  });

  const byKey = Object.fromEntries(rows.map((r) => [r.date_key, r]));

  // 방문/유입 (07-06)
  assert.equal(byKey['2026-07-06']!.visitors, 10);
  assert.equal(byKey['2026-07-06']!.page_views, 25);
  assert.deepEqual(byKey['2026-07-06']!.inflow_referrers, [{ host: 'google.com', visitors: 6 }]);
  assert.deepEqual(byKey['2026-07-06']!.inflow_utm, [
    { source: 'naver', medium: 'cpc', campaign: 'x', visitors: 3 },
  ]);

  // 가입
  assert.equal(byKey['2026-07-06']!.new_signups, 2);
  assert.equal(byKey['2026-07-07']!.new_signups, 1);
  assert.equal(byKey['2026-07-05']!.new_signups, 0);

  // 결제 (윈도우 밖 5000 제외)
  assert.equal(byKey['2026-07-06']!.paid_orders, 1);
  assert.equal(byKey['2026-07-06']!.revenue_won, 9900);
  assert.equal(byKey['2026-07-07']!.paid_orders, 1);
  assert.equal(byKey['2026-07-07']!.revenue_won, 990);

  // 퍼널
  assert.equal(byKey['2026-07-06']!.prepare_attempts, 1);
  assert.equal(byKey['2026-07-06']!.checkout_starts, 1);
  assert.equal(byKey['2026-07-06']!.confirm_success, 1);
  assert.equal(byKey['2026-07-05']!.prepare_attempts, 1);

  // 순서 보존
  assert.deepEqual(rows.map((r) => r.date_key), dateKeys);
});

test('computeDailyMetrics: 환불은 refunded_won 에 환불 시각 기준으로 집계, 매출과 분리', () => {
  // 판 날(07-06)의 매출은 유지, 환불한 날(07-07)에 환불액 기록 — 표준 회계.
  const rows = computeDailyMetrics({
    dateKeys: ['2026-07-06', '2026-07-07'],
    sourceRows: [],
    signupIsos: [],
    funnelRows: [],
    paymentRows: [
      { amount: 9900, confirmed_at: '2026-07-06T01:00:00Z', fulfilled_at: null, created_at: '2026-07-06T01:00:00Z' },
    ],
    refundRows: [{ amount: 9900, refunded_at: '2026-07-07T01:00:00Z' }],
  });
  const byKey = Object.fromEntries(rows.map((r) => [r.date_key, r]));
  assert.equal(byKey['2026-07-06']!.revenue_won, 9900, '판 날 매출은 그대로');
  assert.equal(byKey['2026-07-06']!.refunded_won, 0);
  assert.equal(byKey['2026-07-07']!.refunded_won, 9900, '환불한 날에 환불액');
  assert.equal(byKey['2026-07-07']!.refunded_orders, 1);
  assert.equal(byKey['2026-07-07']!.revenue_won, 0, '환불은 매출을 깎지 않는다(총매출 유지)');
});

test('computeDailyMetrics: refundRows 없이 호출해도 refunded_won=0 (하위호환)', () => {
  const rows = computeDailyMetrics({
    dateKeys: ['2026-07-06'],
    sourceRows: [],
    signupIsos: [],
    paymentRows: [],
    funnelRows: [],
  });
  assert.equal(rows[0]!.refunded_won, 0);
  assert.equal(rows[0]!.refunded_orders, 0);
});

test('computeDailyMetrics: 빈 날짜는 0으로 채워짐', () => {
  const rows = computeDailyMetrics({
    dateKeys: ['2026-07-05', '2026-07-06'],
    sourceRows: [],
    signupIsos: [],
    paymentRows: [],
    funnelRows: [],
  });
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.visitors, 0);
    assert.equal(r.paid_orders, 0);
    assert.deepEqual(r.inflow_referrers, []);
  }
});
