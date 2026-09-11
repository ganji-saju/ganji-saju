// 🔴 선점 가입 탈취 차단(2026-09-11 조사 — docs/coupon-lookup-cap-proposal.md 별건 1).
//
// 사슬: 공격자가 피해자 이메일로 이메일 가입(signup 이 소유 증명 없이 '확인됨'으로 만든다) → 피해자가 나중에 같은
//   이메일로 구글(email_verified) 로그인 → GoTrue 가 기존 계정에 **자동 연결**한다. GoTrue 의 선점 방어
//   (비밀번호·다른 신원 삭제)는 기존 계정이 '미확인'일 때만 돌아서, 공격자 비밀번호가 살아 있는 채로 피해자 구글이 붙는다.
//   자동 연결을 끄는 토글은 없다 → 앱이 불변식을 복구할 수 있는 곳은 소셜 로그인 콜백뿐이다.
//
// 불변식: **소셜 신원이 붙은 계정의 비밀번호는 그 소셜 주인이 메일로 다시 설정하기 전엔 쓸 수 없다.**
//   이메일 먼저 가입한 정상 사용자도 한 번 무력화되지만, 소셜 로그인은 그대로 되고 비밀번호는 "비밀번호 찾기"
//   (메일함 소유 증명)로 되살린다. 누가 비밀번호를 만들었는지 앱이 구별할 방법이 없으므로 이게 최소 비용이다.
import { randomBytes } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/** 무력화를 한 번만 하려고 app_metadata 에 남기는 표식. app_metadata 는 service role 만 쓴다(사용자 위조 불가). */
export const SOCIAL_LINK_GUARD_FLAG = 'social_link_guard_at';

type GuardUser = Pick<User, 'id' | 'identities' | 'app_metadata'>;

/** 비밀번호(email) 신원과 소셜(google·kakao) 신원이 한 계정에 같이 있고, 아직 무력화하지 않았는가. */
export function needsPasswordInvalidation(user: Pick<User, 'identities' | 'app_metadata'>): boolean {
  const providers = new Set((user.identities ?? []).map((identity) => identity.provider));
  const hasSocial = providers.has('google') || providers.has('kakao');
  return providers.has('email') && hasSocial && !user.app_metadata?.[SOCIAL_LINK_GUARD_FLAG];
}

export type SocialLinkGuardResult = 'ok' | 'invalidated' | 'error';

/**
 * signInWithIdToken 직후 호출한다. 'error' 면 호출부는 **로그인을 끝내지 말고 실패**시킨다(실패-닫힘 —
 * 판정 못 한 채 통과시키면 탈취 창이 그대로 열린다). 'invalidated' 면 이 계정의 기존 세션이 끊겼을 수 있으니
 * 호출부가 같은 id_token 으로 다시 로그인한 뒤 revokeOtherSessions 로 나머지(공격자) 세션을 끊는다.
 */
export async function enforceSocialLinkGuard(
  service: SupabaseClient,
  signedIn: GuardUser,
  now: Date = new Date()
): Promise<SocialLinkGuardResult> {
  let user: GuardUser = signedIn;
  // 토큰 응답에 identities 가 빠져 있으면(호스티드 GoTrue 버전 차) 관리자 API 로 다시 읽는다.
  if (!Array.isArray(user.identities)) {
    const { data, error } = await service.auth.admin.getUserById(signedIn.id);
    if (error || !data?.user) return 'error';
    user = data.user;
  }
  if (!needsPasswordInvalidation(user)) return 'ok';

  const { error } = await service.auth.admin.updateUserById(user.id, {
    password: randomBytes(32).toString('base64url'),
    app_metadata: { ...(user.app_metadata ?? {}), [SOCIAL_LINK_GUARD_FLAG]: now.toISOString() },
  });
  return error ? 'error' : 'invalidated';
}

/** 방금 받은 세션만 남기고 이 사용자의 다른 세션(= 비밀번호로 들어와 있던 공격자)을 전부 끊는다. */
export async function revokeOtherSessions(service: SupabaseClient, accessToken: string): Promise<boolean> {
  const { error } = await service.auth.admin.signOut(accessToken, 'others');
  return !error;
}

/**
 * 구글·카카오 콜백 공통: signInWithIdToken 직후 가드 → 무력화했으면 같은 id_token 으로 새 세션을 받고 나머지 세션을 끊는다.
 * `supabase` 는 응답 쿠키를 쓰는 SSR 클라이언트(재로그인 세션이 그 쿠키로 나간다), `service` 는 관리자 호출용.
 */
export async function guardSocialSignIn(
  supabase: SupabaseClient,
  service: SupabaseClient,
  signedIn: { user: User | null },
  credentials: { provider: 'google' | 'kakao'; token: string; nonce?: string }
): Promise<{ ok: true; user: User } | { ok: false; reason: string }> {
  if (!signedIn.user) return { ok: false, reason: 'no_user' };
  const result = await enforceSocialLinkGuard(service, signedIn.user);
  if (result === 'error') return { ok: false, reason: 'link_guard' };
  if (result === 'ok') return { ok: true, user: signedIn.user };

  // 무력화(관리자 비밀번호 변경)가 이 사용자의 세션을 전부 끊었을 수 있다 → 같은 id_token 으로 새 세션.
  //   재사용이 거부되면 사용자는 한 번 더 로그인하면 된다(표식이 남아 다음엔 바로 통과). 안전성은 그대로다.
  const { data, error } = await supabase.auth.signInWithIdToken(credentials);
  if (error || !data.user || !data.session) return { ok: false, reason: 'relogin_required' };
  // 비밀번호 변경이 세션을 안 끊는 버전이어도 공격자 세션이 남지 않게 명시적으로 끊는다.
  if (!(await revokeOtherSessions(service, data.session.access_token))) {
    return { ok: false, reason: 'link_guard' };
  }
  return { ok: true, user: data.user };
}
