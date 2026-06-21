import assert from 'node:assert/strict';
import { isVerificationEmailAllowed } from './verification-access';

declare const test: (name: string, fn: () => void) => void;

// 2026-06-21 보안(P1) 회귀 가드 — verification API fail-open 재발 차단.
// 이전 버그: 허용목록이 비면 무조건 true 반환 → INTERNAL_VERIFICATION_EMAILS 미설정 시
// 내부 검증 엔드포인트 전체 노출.

test('빈 허용목록 + 프로덕션 = 차단(fail-closed)', () => {
  assert.equal(
    isVerificationEmailAllowed('anyone@example.com', { allowlist: [], isProduction: true }),
    false
  );
  assert.equal(
    isVerificationEmailAllowed(null, { allowlist: [], isProduction: true }),
    false
  );
});

test('빈 허용목록 + 비프로덕션 = 허용(로컬/preview 편의)', () => {
  assert.equal(
    isVerificationEmailAllowed('dev@example.com', { allowlist: [], isProduction: false }),
    true
  );
});

test('허용목록 있음 = 일치 email 만 허용(대소문자 무시)', () => {
  const allowlist = ['ops@ganjisaju.kr'];
  assert.equal(
    isVerificationEmailAllowed('OPS@ganjisaju.kr', { allowlist, isProduction: true }),
    true
  );
  assert.equal(
    isVerificationEmailAllowed('intruder@example.com', { allowlist, isProduction: true }),
    false
  );
  assert.equal(
    isVerificationEmailAllowed(null, { allowlist, isProduction: true }),
    false
  );
});

test('허용목록이 있으면 비프로덕션이라도 미일치 email 은 차단', () => {
  assert.equal(
    isVerificationEmailAllowed('intruder@example.com', {
      allowlist: ['ops@ganjisaju.kr'],
      isProduction: false,
    }),
    false
  );
});
