import assert from 'node:assert/strict';
import { resolveTodayFortuneUnlockAccess } from './route-helpers';

declare const test: (name: string, fn: () => void) => void;

const baseScope = {
  sourceSessionId: 'session-abc',
  readingKey: 'reading-key-abc',
  scopeKey: 'today:session-abc',
  todayKey: '2026-05-17',
};

const allFalseDeps = {
  getTodayDetailEntitlement: async () => null,
  hasTodayFortunePremiumAccess: async () => false,
  hasDetailReportAccess: async () => false,
  hasTodayFortuneDailyAccess: async () => false,
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

test('returns "coin-reading" when only detail_report_access row by readingKey exists', async () => {
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

test('returns "coin-daily" when only daily row exists — 사용자 명시 요구: "같은 날 두 번 결제 차단"', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      ...allFalseDeps,
      hasTodayFortuneDailyAccess: async (_u, k) => k === '2026-05-17',
    },
  );
  assert.equal(result, 'coin-daily');
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
      hasDetailReportAccess: async () => {
        coinCalls += 1;
        return true;
      },
      hasTodayFortuneDailyAccess: async () => {
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
      hasTodayFortuneDailyAccess: async () => {
        downstreamCalls += 1;
        return true;
      },
    },
  );
  assert.equal(result, 'coin-session');
  assert.equal(downstreamCalls, 0, 'coin-session 매치 후 reading/daily 조회는 호출되지 않아야 함');
});

test('short-circuits — coin-reading 매치 시 coin-daily 조회 skip', async () => {
  let dailyCalls = 0;
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => null,
      hasTodayFortunePremiumAccess: async () => false,
      hasDetailReportAccess: async () => true,
      hasTodayFortuneDailyAccess: async () => {
        dailyCalls += 1;
        return true;
      },
    },
  );
  assert.equal(result, 'coin-reading');
  assert.equal(dailyCalls, 0, 'coin-reading 매치 후 daily 조회는 호출되지 않아야 함');
});
