// 2026-05-16 — 오늘 별자리 일진 다이제스트 검증.
import assert from 'node:assert/strict';
import { chooseVariantFor, computeStarSignDailyDigest, getStarSignPushBodyFor } from './daily-digest';

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

// ─── A/B variant tests ──────────────────────────────────────────

test('getStarSignPushBodyFor - variant A/B/C 모두 다른 메시지', () => {
  const digest = computeStarSignDailyDigest('2026-05-16');
  const a = getStarSignPushBodyFor('aries', digest, 'A');
  const b = getStarSignPushBodyFor('aries', digest, 'B');
  const c = getStarSignPushBodyFor('aries', digest, 'C');
  // 3개 모두 길이 충분 + 서로 달라야.
  assert.ok(a.length > 10);
  assert.ok(b.length > 10);
  assert.ok(c.length > 10);
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
});

test('getStarSignPushBodyFor - variant B 는 boost 키워드 포함', () => {
  const body = getStarSignPushBodyFor('aries', undefined, 'B');
  assert.ok(body.includes('부스터'));
});

test('getStarSignPushBodyFor - variant C 는 럭키 키워드 포함', () => {
  const body = getStarSignPushBodyFor('aries', undefined, 'C');
  assert.ok(body.includes('럭키'));
});

test('getStarSignPushBodyFor - slug null + variant A/B/C 다른 후보', () => {
  const digest = computeStarSignDailyDigest('2026-05-16');
  const a = getStarSignPushBodyFor(null, digest, 'A');
  const b = getStarSignPushBodyFor(null, digest, 'B');
  const c = getStarSignPushBodyFor(null, digest, 'C');
  assert.notEqual(a, b);
  assert.notEqual(b, c);
});

test('chooseVariantFor - 같은 user + 같은 날 → 같은 variant (결정적)', () => {
  const v1 = chooseVariantFor('user-123', '2026-05-16');
  const v2 = chooseVariantFor('user-123', '2026-05-16');
  assert.equal(v1, v2);
});

test('chooseVariantFor - 같은 user 다른 날 → variant 달라질 수 있음', () => {
  const variants = new Set<string>();
  for (let d = 1; d <= 28; d += 1) {
    const dateKey = `2026-05-${String(d).padStart(2, '0')}`;
    variants.add(chooseVariantFor('user-123', dateKey));
  }
  // 28일 중 3 variant 모두 등장해야.
  assert.ok(variants.size === 3, `28 days → ${variants.size} variants (need 3)`);
});

test('chooseVariantFor - 1000 users → variant 분포 비슷 (33% 근처)', () => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (let i = 0; i < 1000; i += 1) {
    counts[chooseVariantFor(`user-${i}`, '2026-05-16')] += 1;
  }
  // 333±100 정도면 균등.
  for (const k of ['A', 'B', 'C']) {
    assert.ok(counts[k]! >= 230 && counts[k]! <= 430, `variant ${k}: ${counts[k]}/1000 unbalanced`);
  }
});

test('chooseVariantFor - 항상 A/B/C 중 하나 반환', () => {
  for (let i = 0; i < 50; i += 1) {
    const v = chooseVariantFor(`u-${i}`, '2026-05-16');
    assert.ok(v === 'A' || v === 'B' || v === 'C', `invalid variant ${v}`);
  }
});
