import assert from 'node:assert/strict';
import { resolveTodayFortuneUnlockAccess } from './route-helpers';

declare const test: (name: string, fn: () => void) => void;

const baseScope = {
  sourceSessionId: 'session-abc',
  readingKey: 'reading-key-abc',
  scopeKey: 'today:session-abc',
};

test('returns "taste-product" when entitlement row exists (550원 결제 경로)', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => ({ entitled: true }),
      hasTodayFortunePremiumAccess: async () => false,
      hasDetailReportAccess: async () => false,
    },
  );
  assert.equal(result, 'taste-product');
});

test('returns "coin-session" when only today_fortune_premium_access row by sourceSessionId exists', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => null,
      hasTodayFortunePremiumAccess: async (_u, k) => k === 'session-abc',
      hasDetailReportAccess: async () => false,
    },
  );
  assert.equal(result, 'coin-session');
});

test('returns "coin-reading" when only detail_report_access row by readingKey exists (새로고침 회귀 fix 핵심)', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => null,
      hasTodayFortunePremiumAccess: async () => false,
      hasDetailReportAccess: async (_u, k) => k === 'reading-key-abc',
    },
  );
  assert.equal(result, 'coin-reading');
});

test('returns null when neither entitlement nor coin unlock exists (첫 진입 — deduct 필요)', async () => {
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => null,
      hasTodayFortunePremiumAccess: async () => false,
      hasDetailReportAccess: async () => false,
    },
  );
  assert.equal(result, null);
});

test('short-circuits — entitlement 매치 시 coin path 조회 skip', async () => {
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
    },
  );
  assert.equal(result, 'taste-product');
  assert.equal(coinCalls, 0, 'entitlement 매치 후 coin 조회는 호출되지 않아야 함');
});

test('short-circuits — coin-session 매치 시 coin-reading 조회 skip', async () => {
  let readingCalls = 0;
  const result = await resolveTodayFortuneUnlockAccess(
    'user-1',
    baseScope,
    {
      getTodayDetailEntitlement: async () => null,
      hasTodayFortunePremiumAccess: async () => true,
      hasDetailReportAccess: async () => {
        readingCalls += 1;
        return true;
      },
    },
  );
  assert.equal(result, 'coin-session');
  assert.equal(readingCalls, 0, 'coin-session 매치 후 coin-reading 조회는 호출되지 않아야 함');
});
