// 2026-05-15 — 별자리 일별 운세 검증.
import assert from 'node:assert/strict';
import { getDailyFortune, toKstDateKey } from './daily-fortune';
import {
  getAllCompatibilities,
  getCompatibilityScore,
  getCompatibilityTone,
  STAR_SIGN_CONTENT,
} from './sign-content';

declare const test: (name: string, fn: () => void) => void;

test('getDailyFortune - 같은 별자리 + 같은 날 → 같은 결과', () => {
  const a = getDailyFortune('aries', '2026-05-15');
  const b = getDailyFortune('aries', '2026-05-15');
  assert.equal(a.highlight, b.highlight);
  assert.equal(a.scores.overall, b.scores.overall);
  assert.equal(a.luckyOfDay.number, b.luckyOfDay.number);
});

test('getDailyFortune - 다른 날 → 다른 점수', () => {
  const a = getDailyFortune('aries', '2026-05-15');
  const b = getDailyFortune('aries', '2026-05-16');
  // 모든 점수가 같을 확률은 매우 낮음.
  const allSame =
    a.scores.overall === b.scores.overall &&
    a.scores.love === b.scores.love &&
    a.scores.work === b.scores.work;
  assert.ok(!allSame, '날짜가 다르면 점수가 달라야 함');
});

test('getDailyFortune - 다른 별자리 → 다른 highlight', () => {
  const a = getDailyFortune('aries', '2026-05-15');
  const b = getDailyFortune('libra', '2026-05-15');
  // 별자리마다 highlight 후보가 다르므로 같을 수 없음.
  assert.notEqual(a.highlight, b.highlight);
});

test('getDailyFortune - 점수 50-95 범위', () => {
  for (const slug of ['aries', 'leo', 'pisces'] as const) {
    const f = getDailyFortune(slug, '2026-05-15');
    for (const v of Object.values(f.scores)) {
      assert.ok(v >= 50 && v <= 95, `${slug} score ${v} out of range`);
    }
  }
});

test('getDailyFortune - 럭키 숫자가 별자리 콘텐츠와 일치', () => {
  for (const slug of ['aries', 'taurus', 'gemini'] as const) {
    const f = getDailyFortune(slug, '2026-05-15');
    const allowedNumbers = STAR_SIGN_CONTENT[slug].luckyNumbers;
    assert.ok(
      allowedNumbers.includes(f.luckyOfDay.number),
      `${slug} lucky number ${f.luckyOfDay.number} not in [${allowedNumbers.join(',')}]`
    );
  }
});

test('toKstDateKey - KST 변환', () => {
  // UTC 2026-05-15 23:00 → KST 2026-05-16 08:00.
  const utcLate = new Date('2026-05-15T23:00:00Z');
  assert.equal(toKstDateKey(utcLate), '2026-05-16');
});

test('getCompatibilityScore - 동일 별자리 = 90', () => {
  assert.equal(getCompatibilityScore('leo', 'leo'), 90);
});

test('getCompatibilityScore - 대칭성', () => {
  for (const a of ['aries', 'libra', 'pisces'] as const) {
    for (const b of ['leo', 'cancer', 'sagittarius'] as const) {
      assert.equal(
        getCompatibilityScore(a, b),
        getCompatibilityScore(b, a),
        `${a} <-> ${b} 비대칭`
      );
    }
  }
});

test('getCompatibilityScore - 4 element trine 은 best 후보', () => {
  // 양(불) - 사자(불) - 사수(불) — trine.
  const aries_leo = getCompatibilityScore('aries', 'leo');
  // 정사각형: 양(불) - 게(물) - 천칭(공기) - 염소(땅)
  const aries_capricorn = getCompatibilityScore('aries', 'capricorn');
  assert.ok(aries_leo > aries_capricorn, 'trine 이 square 보다 높아야');
});

test('getCompatibilityScore - 점수 범위 50-95', () => {
  const signs = Object.keys(STAR_SIGN_CONTENT) as Array<keyof typeof STAR_SIGN_CONTENT>;
  for (const a of signs) {
    for (const b of signs) {
      const s = getCompatibilityScore(a, b);
      assert.ok(s >= 50 && s <= 95, `${a}-${b} score ${s} out of range`);
    }
  }
});

test('getCompatibilityTone - 임계값', () => {
  assert.equal(getCompatibilityTone(90), 'best');
  assert.equal(getCompatibilityTone(80), 'good');
  assert.equal(getCompatibilityTone(65), 'mid');
  assert.equal(getCompatibilityTone(55), 'avoid');
});

test('getAllCompatibilities - 12개 반환 + 점수 내림차순', () => {
  const comps = getAllCompatibilities('aries');
  assert.equal(comps.length, 12);
  for (let i = 1; i < comps.length; i += 1) {
    assert.ok(
      comps[i - 1]!.score >= comps[i]!.score,
      `정렬 깨짐 at index ${i}: ${comps[i - 1]!.score} < ${comps[i]!.score}`
    );
  }
  // 자기 자신 포함 — 90 점.
  const self = comps.find((c) => c.slug === 'aries');
  assert.ok(self);
  assert.equal(self!.score, 90);
});

test('STAR_SIGN_CONTENT - 12 sign 모두 정의', () => {
  const expected = [
    'aries',
    'taurus',
    'gemini',
    'cancer',
    'leo',
    'virgo',
    'libra',
    'scorpio',
    'sagittarius',
    'capricorn',
    'aquarius',
    'pisces',
  ];
  for (const slug of expected) {
    const c = STAR_SIGN_CONTENT[slug as keyof typeof STAR_SIGN_CONTENT];
    assert.ok(c, `${slug} content missing`);
    assert.ok(c.strengths.length >= 3, `${slug} strengths 부족`);
    assert.ok(c.weaknesses.length >= 3, `${slug} weaknesses 부족`);
    assert.ok(c.careerSuggestions.length >= 3, `${slug} careerSuggestions 부족`);
    assert.ok(c.idealMatches.length === 3, `${slug} idealMatches 3개여야`);
  }
});
