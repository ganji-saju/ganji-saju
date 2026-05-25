import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  buildLifetimeCacheKey,
  hashLifetimeReport,
  isLifetimeCacheFresh,
  type LifetimeCacheKeyContext,
} from './lifetime-interpretation-cache';

// 2026-05-25 Phase 0a — 대운 본편 캐시 키/TTL. total-review-cache.test.ts 패턴 복제.
//   결정요인 전부 포함: saju + context + gender + counselor + targetYear + reportHash(챕터) + feedback + promptVersion.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const data = calculateSajuDataV1({ year: 1999, month: 4, day: 1, hour: 14, gender: 'female' });
const otherData = calculateSajuDataV1({ year: 1988, month: 8, day: 8, hour: 8, gender: 'male' });

const baseCtx: LifetimeCacheKeyContext = {
  relationshipStatus: 'married',
  occupation: 'employee',
  concern: 'wealth',
  gender: 'F',
  counselorId: 'female',
  targetYear: 2026,
  reportHash: 'report-hash-a',
  recentFeedbackSummary: null,
  promptVersion: 'saju-lifetime/v1-female',
};

test('buildLifetimeCacheKey: 같은 입력 → 같은 키', () => {
  assert.equal(buildLifetimeCacheKey(data, baseCtx), buildLifetimeCacheKey(data, { ...baseCtx }));
});

test('buildLifetimeCacheKey: 사주가 다르면 → 다른 키', () => {
  assert.notEqual(buildLifetimeCacheKey(data, baseCtx), buildLifetimeCacheKey(otherData, baseCtx));
});

test('buildLifetimeCacheKey: counselor 다르면 → 다른 키', () => {
  assert.notEqual(
    buildLifetimeCacheKey(data, baseCtx),
    buildLifetimeCacheKey(data, { ...baseCtx, counselorId: 'male' })
  );
});

test('buildLifetimeCacheKey: 컨텍스트(고민) 다르면 → 다른 키', () => {
  assert.notEqual(
    buildLifetimeCacheKey(data, baseCtx),
    buildLifetimeCacheKey(data, { ...baseCtx, concern: 'health' })
  );
});

test('buildLifetimeCacheKey: 성별 다르면 → 다른 키', () => {
  assert.notEqual(
    buildLifetimeCacheKey(data, baseCtx),
    buildLifetimeCacheKey(data, { ...baseCtx, gender: 'M' })
  );
});

test('buildLifetimeCacheKey: targetYear 다르면 → 다른 키 (누락 결정요인 #1)', () => {
  assert.notEqual(
    buildLifetimeCacheKey(data, baseCtx),
    buildLifetimeCacheKey(data, { ...baseCtx, targetYear: 2027 })
  );
});

test('buildLifetimeCacheKey: reportHash(챕터) 다르면 → 다른 키 (누락 결정요인 #2)', () => {
  assert.notEqual(
    buildLifetimeCacheKey(data, baseCtx),
    buildLifetimeCacheKey(data, { ...baseCtx, reportHash: 'report-hash-b' })
  );
});

test('buildLifetimeCacheKey: recentFeedbackSummary 다르면 → 다른 키 (누락 결정요인 #3)', () => {
  assert.notEqual(
    buildLifetimeCacheKey(data, baseCtx),
    buildLifetimeCacheKey(data, { ...baseCtx, recentFeedbackSummary: '최근 피드백 있음' })
  );
});

test('buildLifetimeCacheKey: promptVersion 다르면 → 다른 키 (무효화)', () => {
  assert.notEqual(
    buildLifetimeCacheKey(data, baseCtx),
    buildLifetimeCacheKey(data, { ...baseCtx, promptVersion: 'saju-lifetime/v2-female' })
  );
});

test('buildLifetimeCacheKey: SHA256 16진수 64자', () => {
  assert.match(buildLifetimeCacheKey(data, baseCtx), /^[0-9a-f]{64}$/);
});

test('hashLifetimeReport: 같은 리포트 → 같은 해시, 다르면 다른 해시', () => {
  const reportA = { coreIdentity: { summary: 'A' }, targetYear: 2026 };
  const reportB = { coreIdentity: { summary: 'B' }, targetYear: 2026 };
  assert.equal(hashLifetimeReport(reportA), hashLifetimeReport({ ...reportA }));
  assert.notEqual(hashLifetimeReport(reportA), hashLifetimeReport(reportB));
  assert.match(hashLifetimeReport(reportA), /^[0-9a-f]{64}$/);
});

test('isLifetimeCacheFresh: TTL 30일 내 fresh, 초과 stale', () => {
  const now = new Date('2026-05-25T00:00:00Z');
  const fresh = new Date('2026-05-10T00:00:00Z').toISOString();
  const stale = new Date('2026-03-01T00:00:00Z').toISOString();
  assert.equal(isLifetimeCacheFresh(fresh, 30, now), true);
  assert.equal(isLifetimeCacheFresh(stale, 30, now), false);
});
