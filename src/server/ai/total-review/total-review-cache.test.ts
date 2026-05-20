import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildTotalReviewCacheKey,
  isTotalReviewCacheFresh,
  isTotalReviewLLMEnabled,
} from './total-review-cache';

// 2026-05-21 — 총평 캐시 키/TTL/플래그. spec §8.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const data = calculateSajuDataV1({ year: 1999, month: 4, day: 1, hour: 14, gender: 'female' });
const baseCtx = { relationshipStatus: 'married', occupation: 'employee', concern: 'wealth', gender: 'F' };

test('buildTotalReviewCacheKey: 같은 사주 + 같은 컨텍스트 → 같은 키', () => {
  assert.equal(buildTotalReviewCacheKey(data, baseCtx), buildTotalReviewCacheKey(data, { ...baseCtx }));
});

test('buildTotalReviewCacheKey: 컨텍스트(고민) 변경 → 다른 키', () => {
  const other = buildTotalReviewCacheKey(data, { ...baseCtx, concern: 'health' });
  assert.notEqual(buildTotalReviewCacheKey(data, baseCtx), other);
});

test('buildTotalReviewCacheKey: 성별 변경 → 다른 키', () => {
  const other = buildTotalReviewCacheKey(data, { ...baseCtx, gender: 'M' });
  assert.notEqual(buildTotalReviewCacheKey(data, baseCtx), other);
});

test('isTotalReviewLLMEnabled: 기본 OFF, =1 일 때만 ON', () => {
  assert.equal(isTotalReviewLLMEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(isTotalReviewLLMEnabled({ OPENAI_INTERPRET_TOTAL_REVIEW: '0' } as unknown as NodeJS.ProcessEnv), false);
  assert.equal(isTotalReviewLLMEnabled({ OPENAI_INTERPRET_TOTAL_REVIEW: '1' } as unknown as NodeJS.ProcessEnv), true);
});

test('isTotalReviewCacheFresh: TTL 내 fresh, 초과 stale', () => {
  const now = new Date('2026-05-21T00:00:00Z');
  const fresh = new Date('2026-05-10T00:00:00Z').toISOString();
  const stale = new Date('2026-03-01T00:00:00Z').toISOString();
  assert.equal(isTotalReviewCacheFresh(fresh, 30, now), true);
  assert.equal(isTotalReviewCacheFresh(stale, 30, now), false);
});
