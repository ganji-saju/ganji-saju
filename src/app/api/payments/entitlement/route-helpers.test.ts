import assert from 'node:assert/strict';
import { resolveTodayDetailCoinUnlock } from './route-helpers';

declare const test: (name: string, fn: () => void) => void;

test('returns true when today_fortune_premium_access exists by slug (PR #178 key)', async () => {
  const result = await resolveTodayDetailCoinUnlock(
    'user-1',
    { slug: 'session-abc', readingKey: 'reading-key-abc' },
    {
      hasTodayFortunePremiumAccess: async (_u, k) => k === 'session-abc',
      hasDetailReportAccess: async () => false,
    },
  );
  assert.equal(result, true);
});

test('returns true when today_fortune_premium_access exists by readingKey (PR #178 fallback)', async () => {
  const result = await resolveTodayDetailCoinUnlock(
    'user-1',
    { slug: 'session-abc', readingKey: 'reading-key-abc' },
    {
      hasTodayFortunePremiumAccess: async (_u, k) => k === 'reading-key-abc',
      hasDetailReportAccess: async () => false,
    },
  );
  assert.equal(result, true);
});

test('returns true when only detail_report_access exists (A6 회귀 fix — credits/use 가 저장하는 키)', async () => {
  const result = await resolveTodayDetailCoinUnlock(
    'user-1',
    { slug: 'session-abc', readingKey: 'reading-key-abc' },
    {
      hasTodayFortunePremiumAccess: async () => false,
      hasDetailReportAccess: async (_u, k) => k === 'reading-key-abc',
    },
  );
  assert.equal(result, true);
});

test('returns false when neither kind has a matching row', async () => {
  const result = await resolveTodayDetailCoinUnlock(
    'user-1',
    { slug: 'session-abc', readingKey: 'reading-key-abc' },
    {
      hasTodayFortunePremiumAccess: async () => false,
      hasDetailReportAccess: async () => false,
    },
  );
  assert.equal(result, false);
});

test('returns false and skips lookups when slug is missing', async () => {
  let touched = false;
  const result = await resolveTodayDetailCoinUnlock(
    'user-1',
    { slug: null, readingKey: 'reading-key-abc' },
    {
      hasTodayFortunePremiumAccess: async () => {
        touched = true;
        return true;
      },
      hasDetailReportAccess: async () => {
        touched = true;
        return true;
      },
    },
  );
  assert.equal(result, false);
  assert.equal(touched, false, 'lookups must not run without slug');
});

test('skips redundant readingKey lookup when readingKey === slug', async () => {
  let premiumCalls = 0;
  const result = await resolveTodayDetailCoinUnlock(
    'user-1',
    { slug: 'session-abc', readingKey: 'session-abc' },
    {
      hasTodayFortunePremiumAccess: async () => {
        premiumCalls += 1;
        return false;
      },
      hasDetailReportAccess: async () => true,
    },
  );
  assert.equal(result, true, 'falls through to detail_report_access');
  assert.equal(premiumCalls, 1, 'duplicate slug/readingKey lookup is skipped');
});
