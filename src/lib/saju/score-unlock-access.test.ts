import assert from 'node:assert/strict';
import { resolveScoreUnlocked } from './score-unlock-access';

declare const test: (name: string, fn: () => void) => void;

// 2026-06-07 — 사주 점수 단일 언락 판정(순수 로직).
//   unlocked = score-total 구매 OR 5요소(F1~F5) 전부 보유(개별 or today-set 번들 = grandfather).

const NONE = { F1: false, F2: false, F3: false, F4: false, F5: false };
const ALL = { F1: true, F2: true, F3: true, F4: true, F5: true };

test('score-total 보유 → unlocked (요소 무관)', () => {
  assert.equal(resolveScoreUnlocked({ scoreTotal: true, factors: NONE }), true);
});

test('grandfather: 5요소 전부 보유 → unlocked (score-total 미보유여도)', () => {
  assert.equal(resolveScoreUnlocked({ scoreTotal: false, factors: ALL }), true);
});

test('5요소 일부만 보유 → locked', () => {
  assert.equal(
    resolveScoreUnlocked({ scoreTotal: false, factors: { ...NONE, F1: true, F3: true } }),
    false
  );
});

test('아무것도 없음 → locked', () => {
  assert.equal(resolveScoreUnlocked({ scoreTotal: false, factors: NONE }), false);
});
