// 어드민 수동 코인 지급 입력 검증 회귀 가드.
import assert from 'node:assert/strict';
import { validateGrantCredits, MAX_GRANT_AMOUNT } from './grant-credits';

declare const test: (name: string, fn: () => void) => void;

const base = {
  userId: '11111111-1111-1111-1111-111111111111',
  amount: 15,
  type: 'purchase',
  reason: '서비스 보상',
};

test('지급검증: 정상 입력 통과 + 정규화', () => {
  const r = validateGrantCredits(base);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, base);
});

test('지급검증: 문자열 amount 도 숫자로 정규화', () => {
  const r = validateGrantCredits({ ...base, amount: '15' });
  assert.equal(r.ok, true);
  assert.equal(r.value?.amount, 15);
});

test('지급검증: userId 누락 → 실패', () => {
  const r = validateGrantCredits({ ...base, userId: '  ' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('userId')));
});

test('지급검증: amount 0/음수 → 실패', () => {
  assert.equal(validateGrantCredits({ ...base, amount: 0 }).ok, false);
  assert.equal(validateGrantCredits({ ...base, amount: -5 }).ok, false);
});

test('지급검증: amount 소수 → 실패', () => {
  const r = validateGrantCredits({ ...base, amount: 1.5 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('정수')));
});

test('지급검증: 상한 초과 → 실패(과지급 방지)', () => {
  const r = validateGrantCredits({ ...base, amount: MAX_GRANT_AMOUNT + 1 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('이하')));
  // 상한 경계값은 통과.
  assert.equal(validateGrantCredits({ ...base, amount: MAX_GRANT_AMOUNT }).ok, true);
});

test('지급검증: 잘못된 type → 실패', () => {
  const r = validateGrantCredits({ ...base, type: 'gift' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('type')));
});

test('지급검증: subscription type 허용', () => {
  assert.equal(validateGrantCredits({ ...base, type: 'subscription' }).ok, true);
});

test('지급검증: 사유 너무 짧으면 실패(감사 추적)', () => {
  const r = validateGrantCredits({ ...base, reason: 'x' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('사유')));
});
