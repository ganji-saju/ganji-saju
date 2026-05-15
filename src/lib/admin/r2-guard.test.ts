// 2026-05-16 PR #153 (D2) — R² guard 임계값 정책 검증.
// route 안 inline 로직을 순수 함수로 추출해 테스트 가능하게 만든 헬퍼.
import assert from 'node:assert/strict';

declare const test: (name: string, fn: () => void) => void;

const R2_THRESHOLD = 0.05;

function shouldBlockActivation(input: {
  rSquared: number | null;
  forced: boolean;
}): { blocked: boolean; reason?: string } {
  if (input.forced) return { blocked: false };
  if (input.rSquared === null) {
    return { blocked: true, reason: 'r_squared_null' };
  }
  if (input.rSquared < R2_THRESHOLD) {
    return { blocked: true, reason: 'r_squared_below_threshold' };
  }
  return { blocked: false };
}

test('shouldBlockActivation - rSquared null + 강제 X → 차단', () => {
  const result = shouldBlockActivation({ rSquared: null, forced: false });
  assert.equal(result.blocked, true);
  assert.equal(result.reason, 'r_squared_null');
});

test('shouldBlockActivation - rSquared 0.03 + 강제 X → 차단', () => {
  const result = shouldBlockActivation({ rSquared: 0.03, forced: false });
  assert.equal(result.blocked, true);
  assert.equal(result.reason, 'r_squared_below_threshold');
});

test('shouldBlockActivation - rSquared 0.10 → 통과', () => {
  const result = shouldBlockActivation({ rSquared: 0.1, forced: false });
  assert.equal(result.blocked, false);
});

test('shouldBlockActivation - rSquared = 0.05 정확히 → 통과 (경계)', () => {
  const result = shouldBlockActivation({ rSquared: 0.05, forced: false });
  assert.equal(result.blocked, false);
});

test('shouldBlockActivation - rSquared 0.01 + force=true → 통과 (강제 우회)', () => {
  const result = shouldBlockActivation({ rSquared: 0.01, forced: true });
  assert.equal(result.blocked, false);
});

test('shouldBlockActivation - rSquared null + force=true → 통과', () => {
  const result = shouldBlockActivation({ rSquared: null, forced: true });
  assert.equal(result.blocked, false);
});

test('R2_THRESHOLD - 0.05 fixed (정책 변경 가드)', () => {
  assert.equal(R2_THRESHOLD, 0.05);
});
