// 2026-08-26 회귀 가드 — 연결 장애를 '설정 미완료'라고 말하지 않는다.
//   실제 사고: staging Google 로그인이 reason=fetch failed 로 떨어졌는데 화면은
//   "Google 개발자 콘솔의 콜백 주소를 확인해 주세요" 라고 안내했다. 원인은 인증 서버에
//   네트워크로 닿지 못한 것(Supabase 호스트 NXDOMAIN)이었고 설정은 멀쩡했다.
import assert from 'node:assert/strict';
import { getOAuthLoginError, isTransientAuthReason } from './oauth-login-error';

declare const test: (name: string, fn: () => void) => void;

test('연결 실패 안내: fetch failed 를 설정 문제로 말하지 않는다', () => {
  const msg = getOAuthLoginError('oauth_provider', 'google', 'fetch failed');
  assert.ok(msg.includes('연결하지 못했습니다'));
  assert.ok(msg.includes('잠시 후 다시'));
  assert.ok(!msg.includes('개발자 콘솔'), '콘솔을 뒤지라고 하면 안 된다');
  assert.ok(!msg.includes('설정이 아직 완료되지'), '설정 미완료로 오진하면 안 된다');
  assert.ok(msg.includes('fetch failed'), '원인 문자열은 남겨 디버깅을 돕는다');
});

test('연결 실패 안내: 단계(provider/exchange/oauth)와 무관하게 같은 말', () => {
  for (const stage of ['oauth_provider', 'oauth_exchange', 'oauth']) {
    const msg = getOAuthLoginError(stage, 'kakao', 'ENOTFOUND');
    assert.ok(msg.includes('연결하지 못했습니다'), `${stage} 에서 연결 안내가 아님`);
  }
});

test('네트워크 사유 판정: undici·supabase-js 표현들을 모두 잡는다', () => {
  for (const reason of [
    'fetch failed',
    'TypeError: fetch failed',
    'network error',
    'request timed out',
    'ECONNREFUSED 127.0.0.1:443',
    'getaddrinfo EAI_AGAIN db.example.supabase.co',
    'socket hang up',
    'upstream returned 503',
  ]) {
    assert.equal(isTransientAuthReason(reason), true, reason);
  }
});

test('네트워크 사유 판정: 진짜 설정 오류는 통과시키지 않는다', () => {
  for (const reason of [
    'redirect_uri_mismatch',
    'invalid_client',
    'Unsupported provider: provider is not enabled',
    'access_denied',
    null,
    '',
  ]) {
    assert.equal(isTransientAuthReason(reason), false, String(reason));
  }
});

test('설정 오류는 기존 안내 유지 — 콘솔·Provider 확인을 그대로 말한다', () => {
  const msg = getOAuthLoginError('oauth_provider', 'google', 'Unsupported provider');
  assert.ok(msg.includes('Google 로그인 제공자 설정'));
  assert.ok(msg.includes('개발자 콘솔'));
});

test('code verifier 분기는 그대로 — 연결 문제로 삼키지 않는다', () => {
  const msg = getOAuthLoginError('oauth_exchange', 'kakao', 'both auth code and code verifier should be non-empty');
  assert.ok(msg.includes('현재 창에서 다시 로그인'));
});

test('알 수 없는 error 코드는 빈 문자열 — 없는 오류를 지어내지 않는다', () => {
  assert.equal(getOAuthLoginError(null, 'google', null), '');
  assert.equal(getOAuthLoginError('something_else', 'google', 'fetch failed'), '');
});
