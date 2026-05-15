// 2026-05-16 — 오늘 별자리 일진 다이제스트 검증.
import assert from 'node:assert/strict';
import { computeStarSignDailyDigest, getStarSignPushBodyFor } from './daily-digest';

declare const test: (name: string, fn: () => void) => void;

test('computeStarSignDailyDigest - 같은 날 → 같은 결과 (결정적)', () => {
  const a = computeStarSignDailyDigest('2026-05-16');
  const b = computeStarSignDailyDigest('2026-05-16');
  assert.equal(a.topThree[0]!.slug, b.topThree[0]!.slug);
  assert.equal(a.caution.slug, b.caution.slug);
  assert.equal(a.globalAverage, b.globalAverage);
});

test('computeStarSignDailyDigest - top 3 + 1 caution', () => {
  const d = computeStarSignDailyDigest('2026-05-16');
  assert.equal(d.topThree.length, 3);
  assert.ok(d.caution);
  // 내림차순.
  assert.ok(d.topThree[0]!.overall >= d.topThree[1]!.overall);
  assert.ok(d.topThree[1]!.overall >= d.topThree[2]!.overall);
  // caution 은 top3 보다 낮거나 같음.
  assert.ok(d.caution.overall <= d.topThree[2]!.overall);
});

test('computeStarSignDailyDigest - mood distribution 합 = 12', () => {
  const d = computeStarSignDailyDigest('2026-05-16');
  const sum =
    d.moodDistribution.warm +
    d.moodDistribution.calm +
    d.moodDistribution.dynamic +
    d.moodDistribution.sensitive;
  assert.equal(sum, 12);
});

test('computeStarSignDailyDigest - global average 50-95 범위', () => {
  const d = computeStarSignDailyDigest('2026-05-16');
  assert.ok(d.globalAverage >= 50 && d.globalAverage <= 95);
});

test('computeStarSignDailyDigest - 다른 날 → 다른 top sign 가능', () => {
  // 100일치 시뮬레이션 — top sign 이 매번 같을 수 없음.
  const tops = new Set<string>();
  for (let day = 1; day <= 28; day += 1) {
    const dateKey = `2026-05-${String(day).padStart(2, '0')}`;
    const d = computeStarSignDailyDigest(dateKey);
    tops.add(d.topThree[0]!.slug);
  }
  assert.ok(tops.size > 1, 'TOP sign 이 매일 다양해야');
});

test('computeStarSignDailyDigest - notification candidates 3개', () => {
  const d = computeStarSignDailyDigest('2026-05-16');
  assert.equal(d.notificationCandidates.length, 3);
  for (const c of d.notificationCandidates) {
    assert.ok(c.length > 10, 'body 가 너무 짧음');
  }
});

test('getStarSignPushBodyFor - 사용자 별자리 있을 때', () => {
  const body = getStarSignPushBodyFor('aries');
  assert.ok(body.includes('양자리'));
  assert.ok(body.match(/\d+점/));
});

test('getStarSignPushBodyFor - slug null 일 때 fallback', () => {
  const body = getStarSignPushBodyFor(null);
  assert.ok(body.length > 10);
});

test('getStarSignPushBodyFor - 같은 날 + slug → 같은 메시지 (결정적)', () => {
  const a = getStarSignPushBodyFor('leo', computeStarSignDailyDigest('2026-05-16'));
  const b = getStarSignPushBodyFor('leo', computeStarSignDailyDigest('2026-05-16'));
  assert.equal(a, b);
});
