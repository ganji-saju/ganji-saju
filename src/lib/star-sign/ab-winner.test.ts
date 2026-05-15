// 2026-05-16 PR #145 — A/B winner ε-greedy 검증.
import assert from 'node:assert/strict';
import {
  __setWinnerSelectionForTest,
  chooseVariantWithExploration,
  type WinnerSelection,
} from './ab-winner';

declare const test: (name: string, fn: () => void) => void;

test('chooseVariantWithExploration - winner 없으면 균등 분배 (legacy)', () => {
  __setWinnerSelectionForTest(null);
  const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
  for (let i = 0; i < 600; i += 1) {
    const r = chooseVariantWithExploration(`u-${i}`, '2026-05-16');
    counts[r.variant] += 1;
    assert.equal(r.usedWinner, false);
  }
  for (const k of ['A', 'B', 'C']) {
    assert.ok(counts[k]! >= 140 && counts[k]! <= 260, `${k}: ${counts[k]} (균등 ~200)`);
  }
});

test('chooseVariantWithExploration - winner 있으면 90% winner / 10% explore', () => {
  const selection: WinnerSelection = {
    winner: 'B',
    stats: [
      { variant: 'A', sent: 100, clicked: 5, ctr: 0.05 },
      { variant: 'B', sent: 100, clicked: 12, ctr: 0.12 },
      { variant: 'C', sent: 100, clicked: 7, ctr: 0.07 },
    ],
    sampleEnough: true,
    marginPp: 5,
    computedAt: new Date().toISOString(),
  };
  __setWinnerSelectionForTest(selection);

  const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
  let winnerUsed = 0;
  for (let i = 0; i < 1000; i += 1) {
    const r = chooseVariantWithExploration(`u-${i}`, '2026-05-16');
    counts[r.variant] += 1;
    if (r.usedWinner) winnerUsed += 1;
  }
  // B 가 압도적이어야 — 약 900 (90% exploit + ~33% of 10% explore).
  assert.ok(counts.B! >= 880, `B count ${counts.B} (expected >= 880)`);
  // A 와 C 는 explore 의 균등 분배 ~33 each ± 25.
  assert.ok(counts.A! < 100, `A count ${counts.A}`);
  assert.ok(counts.C! < 100, `C count ${counts.C}`);
  // usedWinner 비율 ≈ 90%.
  assert.ok(winnerUsed >= 850 && winnerUsed <= 950, `winnerUsed ${winnerUsed} (~900)`);
});

test('chooseVariantWithExploration - 결정적 (같은 user+date → 같은 결과)', () => {
  __setWinnerSelectionForTest({
    winner: 'A',
    stats: [
      { variant: 'A', sent: 100, clicked: 15, ctr: 0.15 },
      { variant: 'B', sent: 100, clicked: 8, ctr: 0.08 },
      { variant: 'C', sent: 100, clicked: 5, ctr: 0.05 },
    ],
    sampleEnough: true,
    marginPp: 7,
    computedAt: new Date().toISOString(),
  });
  const r1 = chooseVariantWithExploration('alice', '2026-05-16');
  const r2 = chooseVariantWithExploration('alice', '2026-05-16');
  assert.equal(r1.variant, r2.variant);
  assert.equal(r1.usedWinner, r2.usedWinner);
});

test('chooseVariantWithExploration - sample 부족하면 winner 없음 처리', () => {
  // computeWinner 에서 sampleEnough=false 이면 winner=null 이 됨.
  // 여기서는 직접 selection.winner 가 null 일 때 동작 확인.
  __setWinnerSelectionForTest({
    winner: null,
    stats: [
      { variant: 'A', sent: 10, clicked: 1, ctr: 0.1 },
      { variant: 'B', sent: 8, clicked: 2, ctr: 0.25 },
      { variant: 'C', sent: 5, clicked: 0, ctr: 0 },
    ],
    sampleEnough: false,
    marginPp: 15,
    computedAt: new Date().toISOString(),
  });
  for (let i = 0; i < 100; i += 1) {
    const r = chooseVariantWithExploration(`u-${i}`, '2026-05-16');
    assert.equal(r.usedWinner, false, `winner=null 이면 usedWinner=false 여야`);
  }
});
