// 카카오 id_token 의 email 을 믿어도 되는지. 미인증 이메일이 GoTrue 자동 연결로 남의 계정에 붙는 걸 막는 관문이다.
import assert from 'node:assert/strict';
import { kakaoEmailClaimVerdict, type KakaoMe } from './kakao-email-claim';

declare const test: (name: string, fn: () => void) => void;

const token = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const me = (account: NonNullable<KakaoMe['kakao_account']>): KakaoMe => ({ kakao_account: account });
const verified = { email: 'a@b.com', is_email_valid: true, is_email_verified: true };

test('이메일 없는 토큰은 확인 없이 통과(연결 대상 아님)', () => {
  assert.equal(kakaoEmailClaimVerdict(token({ sub: '1' }), null), 'ok');
});

test('인증된 같은 이메일만 통과 — 대소문자·공백 차이는 같은 이메일', () => {
  assert.equal(kakaoEmailClaimVerdict(token({ email: ' A@B.com' }), me(verified)), 'ok');
});

test('미인증·무효·다른 이메일은 unverified', () => {
  assert.equal(kakaoEmailClaimVerdict(token({ email: 'a@b.com' }), me({ ...verified, is_email_verified: false })), 'unverified');
  assert.equal(kakaoEmailClaimVerdict(token({ email: 'a@b.com' }), me({ ...verified, is_email_valid: false })), 'unverified');
  assert.equal(kakaoEmailClaimVerdict(token({ email: 'a@b.com' }), me({ ...verified, email: 'x@b.com' })), 'unverified');
  assert.equal(kakaoEmailClaimVerdict(token({ email: 'a@b.com' }), {}), 'unverified');
});

test('이메일이 실렸는데 user/me 를 못 받았거나 토큰이 깨졌으면 check_failed(막는다)', () => {
  assert.equal(kakaoEmailClaimVerdict(token({ email: 'a@b.com' }), null), 'check_failed');
  assert.equal(kakaoEmailClaimVerdict('not-a-jwt', null), 'check_failed');
});
