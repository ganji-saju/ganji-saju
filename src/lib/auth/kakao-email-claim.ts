/**
 * 🔴 2026-09-11 — 카카오 id_token 에 email 이 실리면 GoTrue(parseKakaoIDToken)는 **무조건 '확인된 이메일'** 로 보고 같은
 * 이메일의 기존 계정에 자동 연결한다. 카카오 id_token 의 email 은 '유효'할 뿐 '인증'을 보장하지 않는다(카카오 문서: 미인증
 * 이메일 존재). scope 가 openid 뿐이어도 공격자는 인가 URL 에 account_email 을 직접 붙일 수 있다 → 인증된 이메일일 때만
 * 로그인시킨다. 이메일 없는 토큰(현재 대부분)은 연결 대상이 아니라 그대로 통과.
 *
 * ⚠️ 이 검사는 우리 콜백을 거칠 때만 돈다. id_token 을 GoTrue 에 직접 내는 경로는 카카오 콘솔 설정으로만 닫힌다
 *   (social-link-guard.ts 머리 주석).
 */

/** 카카오 user/me 응답 중 쓰는 필드. */
export type KakaoMe = {
  kakao_account?: {
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    phone_number?: string;
    name?: string;
  };
};

/**
 * 'ok' = 로그인해도 됨 · 'unverified' = 카카오가 인증 안 된(또는 다른) 이메일이라고 답함 ·
 * 'check_failed' = 이메일이 실렸는데 확인하지 못함(user/me 실패·토큰 해석 실패). 둘 다 로그인을 막는다(실패-닫힘).
 */
export function kakaoEmailClaimVerdict(idToken: string, me: KakaoMe | null): 'ok' | 'unverified' | 'check_failed' {
  let email: unknown;
  try {
    email = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString()).email;
  } catch {
    return 'check_failed';
  }
  if (typeof email !== 'string' || !email) return 'ok';
  if (!me) return 'check_failed';
  const account = me.kakao_account;
  return account?.is_email_valid &&
    account.is_email_verified &&
    account.email?.trim().toLowerCase() === email.trim().toLowerCase()
    ? 'ok'
    : 'unverified';
}
