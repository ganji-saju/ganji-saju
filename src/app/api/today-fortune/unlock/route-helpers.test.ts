import assert from 'node:assert/strict';
import { resolveTodayFortuneUnlockAccess } from './route-helpers';

declare const test: (name: string, fn: () => void) => void;

const baseScope = {
  sourceSessionId: 'session-abc',
  readingKey: 'reading-key-abc',
  todayKey: '2026-05-17',
};

const allFalseDeps = {
  getTodayDetailEntitlement: async () => null,
  hasTodayFortunePremiumAccess: async () => false,
  hasDetailReportAccess: async () => false,
  hasTodayFortunePremiumAccessByReading: async () => false,
  hasTodayFortuneAccessForSaju: async () => false,
};

test('returns "taste-product" when entitlement row exists (550원 결제 경로)', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      ...allFalseDeps,
      getTodayDetailEntitlement: async () => ({ entitled: true }),
    },
  );
  assert.equal(result, 'taste-product');
});

test('returns "coin-session" when only today_fortune_premium_access row by sourceSessionId exists', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      ...allFalseDeps,
      hasTodayFortunePremiumAccess: async (_u, k) => k === 'session-abc',
    },
  );
  assert.equal(result, 'coin-session');
});

test('returns "coin-reading" when only detail_report_access row by readingKey exists (saju-detail 경로)', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      ...allFalseDeps,
      hasDetailReportAccess: async (_u, k) => k === 'reading-key-abc',
    },
  );
  assert.equal(result, 'coin-reading');
});

test('returns "coin-reading" when only today_fortune_premium_access row by readingKey exists (PR #200 정확한 fix — evidence)', async () => {
  // production row 의 실제 kind. PR #196 fallback (hasDetailReportAccess) 가
  // 잘못된 kind 만 조회해서 매번 false 였던 회귀의 정확한 fix.
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      ...allFalseDeps,
      hasTodayFortunePremiumAccessByReading: async (_u, k) => k === 'reading-key-abc',
    },
  );
  assert.equal(result, 'coin-reading');
});

test('4단계는 이 사주(readingKey)·오늘로 묻는다 — "같은 날 두 번 결제 차단"은 같은 사주만(2026-09-14)', async () => {
  const calls: Array<[string, string]> = [];
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      ...allFalseDeps,
      hasTodayFortuneAccessForSaju: async (_u: string, rk: string, day: string) => {
        calls.push([rk, day]);
        return rk === 'reading-key-abc' && day === '2026-05-17';
      },
    },
  );
  assert.equal(result, 'coin-reading');
  assert.deepEqual(calls, [['reading-key-abc', '2026-05-17']]);
});

test('returns null when no access row exists at all (첫 진입 — deduct 필요)', async () => {
  const result = await resolveTodayFortuneUnlockAccess('user-1', baseScope, allFalseDeps);
  assert.equal(result, null);
});

test('short-circuits — entitlement 매치 시 coin/daily 조회 skip', async () => {
  let coinCalls = 0;
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => ({ entitled: true }),
      hasTodayFortunePremiumAccess: async () => {
        coinCalls += 1;
        return true;
      },
      hasTodayFortunePremiumAccessByReading: async () => {
        coinCalls += 1;
        return true;
      },
      hasDetailReportAccess: async () => {
        coinCalls += 1;
        return true;
      },
      hasTodayFortuneAccessForSaju: async () => {
        coinCalls += 1;
        return true;
      },
    },
  );
  assert.equal(result, 'taste-product');
  assert.equal(coinCalls, 0, 'entitlement 매치 후 coin/daily 조회는 호출되지 않아야 함');
});

test('short-circuits — coin-session 매치 시 coin-reading / coin-daily 조회 skip', async () => {
  let downstreamCalls = 0;
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => null,
      hasTodayFortunePremiumAccess: async () => true,
      hasDetailReportAccess: async () => {
        downstreamCalls += 1;
        return true;
      },
      hasTodayFortunePremiumAccessByReading: async () => {
        downstreamCalls += 1;
        return true;
      },
      hasTodayFortuneAccessForSaju: async () => {
        downstreamCalls += 1;
        return true;
      },
    },
  );
  assert.equal(result, 'coin-session');
  assert.equal(downstreamCalls, 0, 'coin-session 매치 후 reading/daily 조회는 호출되지 않아야 함');
});

test('short-circuits — coin-reading (today_fortune_premium_access by readingKey) 매치 시 detail_report_access / daily 조회 skip', async () => {
  let downstreamCalls = 0;
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => null,
      hasTodayFortunePremiumAccess: async () => false,
      hasTodayFortunePremiumAccessByReading: async () => true,
      hasDetailReportAccess: async () => {
        downstreamCalls += 1;
        return true;
      },
      hasTodayFortuneAccessForSaju: async () => {
        downstreamCalls += 1;
        return true;
      },
    },
  );
  assert.equal(result, 'coin-reading');
  assert.equal(downstreamCalls, 0, 'coin-reading 매치 후 detail_report_access / daily 조회는 호출되지 않아야 함');
});
