// 2026-08-26 — 소셜 로그인 실패 안내 문구. page.tsx 안에 있던 것을 옮겼다(.tsx 는 단위
//   테스트에서 import 할 수 없어 회귀 가드를 못 붙인다).
//
//   ⚠️ 이 파일이 생긴 이유: staging Google 로그인이
//   `?error=oauth_provider&provider=google&reason=fetch%20failed` 로 떨어졌는데 화면은
//   "Google 로그인 제공자 설정이 아직 완료되지 않았습니다 — Google 개발자 콘솔의 콜백 주소를
//   확인해 주세요" 라고 말했다. 실제 원인은 **인증 서버에 네트워크로 닿지 못한 것**이었고
//   (Supabase 호스트 DNS 미해석), 설정은 멀쩡했다. 잘못된 안내가 사람을 엉뚱한 콘솔로 보냈다.
//
//   Node fetch 는 DNS·TLS·커넥션 실패를 원인 불문 `fetch failed` 한 줄로만 준다. 그래서
//   reason 을 보고 **설정 문제와 연결 문제를 갈라서** 말한다.

/** Node/undici·supabase-js 가 네트워크 실패를 표현하는 방식들. */
const TRANSIENT_REASON =
  /fetch failed|network|timeout|timed out|econnrefused|econnreset|enotfound|eai_again|getaddrinfo|socket hang up|502|503|504/i;

/**
 * 설정 문제가 아니라 '지금 못 닿는' 상태인가. true 면 사용자에게 콘솔을 뒤지라고 하면 안 된다.
 */
export function isTransientAuthReason(reason: string | null | undefined): boolean {
  return Boolean(reason && TRANSIENT_REASON.test(reason));
}

export function getProviderLabel(value: string | null | undefined): string {
  if (value === 'google') return 'Google';
  if (value === 'kakao') return '카카오';
  return '소셜';
}

/**
 * 2026-09-11 — 선점 가입 탈취 가드(social-link-guard · 카카오 이메일 확인)가 로그인을 멈춘 사유. 설정 문제가 아니다.
 *   콜백은 이것도 `error=oauth_provider` 로 보내서, 여기 없으면 "개발자 콘솔을 확인해 주세요"가 뜬다.
 */
const GUARD_REASON_MESSAGES: Record<string, (providerLabel: string) => string> = {
  relogin_required: (p) =>
    `보안 확인을 위해 ${p}로 한 번 더 로그인해 주세요. 이 계정의 기존 비밀번호는 보호를 위해 해제됐어요 — 이메일 로그인도 쓰시려면 "비밀번호를 잊으셨나요?"로 다시 설정할 수 있어요.`,
  link_guard: () => '계정 보안 확인을 끝내지 못해 로그인을 멈췄어요. 잠시 후 다시 시도해 주세요. 계속되면 카카오톡 문의로 알려 주세요.',
  no_user: () => '계정 보안 확인을 끝내지 못해 로그인을 멈췄어요. 잠시 후 다시 시도해 주세요. 계속되면 카카오톡 문의로 알려 주세요.',
  kakao_email_unverified: () =>
    '카카오 계정의 이메일이 인증되지 않아 로그인을 멈췄어요. 카카오 계정 설정에서 이메일 인증을 마친 뒤 다시 시도해 주세요.',
  kakao_email_check_failed: () => '카카오 계정 확인을 끝내지 못했어요. 잠시 후 다시 시도해 주세요.',
};

export function getOAuthLoginError(
  error: string | null | undefined,
  provider: string | null | undefined,
  reason: string | null | undefined
): string {
  const providerLabel = getProviderLabel(provider);

  if (error === 'oauth_config') {
    return '로그인 환경변수가 비어 있습니다. Supabase URL과 공개 키를 운영 환경에 설정해 주세요.';
  }

  // 자기 키만: reason 은 URL 에서 온다 — `reason=valueOf` 면 프로토타입 함수를 불러 로그인 페이지가 죽는다.
  //   (Object.hasOwn 은 iOS 15.4 미만 WebView 에 없어 쓰지 않는다 — 이 파일은 로그인 페이지 번들에 들어간다.)
  if (error === 'oauth_provider' && reason && Object.prototype.hasOwnProperty.call(GUARD_REASON_MESSAGES, reason)) {
    return GUARD_REASON_MESSAGES[reason](providerLabel);
  }

  // 연결 실패는 설정 종류와 무관하게 같은 말을 해야 한다 — 어느 단계에서 끊겼든 사용자가
  // 할 수 있는 일은 '잠시 후 다시'뿐이다.
  if (
    (error === 'oauth_provider' || error === 'oauth_exchange' || error === 'oauth') &&
    isTransientAuthReason(reason)
  ) {
    return `지금 로그인 서버에 연결하지 못했습니다. 설정 문제가 아니라 일시적인 연결 장애일 수 있어요. 잠시 후 다시 시도해 주세요.${
      reason ? ` (${reason})` : ''
    }`;
  }

  if (error === 'oauth_provider') {
    return `${providerLabel} 로그인 제공자 설정이 아직 완료되지 않았습니다. Supabase Provider와 ${providerLabel} 개발자 콘솔의 콜백 주소를 확인해 주세요.`;
  }

  if (error === 'oauth_exchange') {
    const normalizedReason = reason?.toLowerCase() ?? '';
    if (normalizedReason.includes('code verifier')) {
      return `${providerLabel} 로그인 세션 연결이 완료되지 않았습니다. 로그인 시작 주소와 콜백 주소가 달라졌을 수 있어요. 현재 창에서 다시 로그인해 주세요.`;
    }
    return `${providerLabel} 로그인 세션 연결이 완료되지 않았습니다. 브라우저 쿠키 허용과 Supabase Redirect URL 설정을 확인해 주세요.${reason ? ` (${reason})` : ''}`;
  }

  if (error === 'oauth') {
    return `${providerLabel} 로그인 연결이 완료되지 않았습니다. Provider 설정과 리다이렉트 주소를 확인해 주세요.`;
  }

  return '';
}
