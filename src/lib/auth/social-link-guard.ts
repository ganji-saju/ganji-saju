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
//
// ⚠️ 남는 창(2026-09-11 리뷰):
//   · 이미 발급된 공격자 access JWT 는 만료(기본 1시간)까지 PostgREST 에서 유효하다(앱 서버는 getUser 로 거부).
//   · 카카오 id_token 을 GoTrue 에 **직접** 내는 경로는 이 콜백을 거치지 않는다 — 카카오 콘솔 설정(Client Secret·
//     account_email 동의항목)으로만 닫힌다.
//   · 근본 해법은 가입 때 메일함 증명(signup 의 email_confirm: true 제거) — 그러면 GoTrue 자체 방어가 원자적으로 돈다.
import { randomBytes } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';

/** 무력화를 한 번만 하려고 app_metadata 에 남기는 표식. app_metadata 는 service role 만 쓴다(사용자 위조 불가). */
export const SOCIAL_LINK_GUARD_FLAG = 'social_link_guard_at';

/** 비밀번호(email) 신원과 소셜(google·kakao) 신원이 한 계정에 같이 있고, 아직 무력화하지 않았는가. */
export function needsPasswordInvalidation(user: Pick<User, 'identities' | 'app_metadata'>): boolean {
  const providers = new Set((user.identities ?? []).map((identity) => identity.provider));
  const hasSocial = providers.has('google') || providers.has('kakao');
  return providers.has('email') && hasSocial && !user.app_metadata?.[SOCIAL_LINK_GUARD_FLAG];
}

export type SocialLinkGuardResult =
  | { status: 'ok'; user: User }
  | { status: 'invalidated'; user: User; password: string }
  | { status: 'error' };

/**
 * signInWithIdToken 직후 호출한다. 'error' 면 호출부는 **로그인을 끝내지 말고 실패**시킨다(실패-닫힘 —
 * 판정 못 한 채 통과시키면 탈취 창이 그대로 열린다).
 *
 * 🔴 판정은 **항상 관리자 API 로 다시 읽은 계정**으로 한다. GoTrue 는 기존 계정에 소셜을 자동 연결할 때 연결 전에 읽어 둔
 *   계정을 그대로 응답한다 — 응답의 identities 엔 방금 붙은 소셜이 없어서, 응답만 보면 탈취가 일어나는 바로 그
 *   로그인에서 'ok' 가 나온다(2026-09-11 리뷰에서 발견, upstream GoTrue 로 확인).
 */
export async function enforceSocialLinkGuard(
  service: SupabaseClient,
  signedIn: Pick<User, 'id'>,
  now: Date = new Date()
): Promise<SocialLinkGuardResult> {
  const { data, error } = await service.auth.admin.getUserById(signedIn.id);
  if (error || !data?.user || !Array.isArray(data.user.identities)) return { status: 'error' };
  const user = data.user;
  if (!needsPasswordInvalidation(user)) return { status: 'ok', user };

  const password = randomBytes(32).toString('base64url');
  // app_metadata 는 GoTrue 가 키 단위로 병합한다 — 표식만 보낸다(낡은 사본을 통째로 쓰면 동시 로그인의 providers 를 되돌린다).
  const { error: updateError } = await service.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { [SOCIAL_LINK_GUARD_FLAG]: now.toISOString() },
  });
  return updateError ? { status: 'error' } : { status: 'invalidated', user, password };
}

/** 방금 받은 세션만 남기고 이 사용자의 다른 세션(= 비밀번호로 들어와 있던 공격자)을 전부 끊는다. */
export async function revokeOtherSessions(service: SupabaseClient, accessToken: string): Promise<boolean> {
  const { error } = await service.auth.admin.signOut(accessToken, 'others');
  return !error;
}

/**
 * 우리가 넣은 무작위 비밀번호로 실제 로그인이 되는가(= 무력화가 남아 있는가). 확인용 세션은 바로 지운다.
 * 경합: 관리자 변경 직전에 공격자 세션이 보낸 updateUser({password}) 는 bcrypt 뒤 세션을 다시 확인하지 않고 우리 값
 *   위에 써질 수 있다(GoTrue UserUpdate). 그러면 공격자 비밀번호가 산 채로 표식만 남는다.
 * ponytail: 재로그인·세션 정리 뒤 한 번만 본다 — 그보다 늦게 도착하는 쓰기(본문을 천천히 보내 늘린 요청)는 못 본다.
 *   완전히 닫는 건 가입 때 메일함 증명(파일 머리 주석).
 */
async function passwordStillOurs(
  probe: SupabaseClient,
  service: SupabaseClient,
  email: string | undefined,
  password: string
): Promise<boolean> {
  if (!email) return false;
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await service.auth.admin.signOut(data.session.access_token, 'local');
  return true;
}

/**
 * 구글·카카오 콜백 공통: signInWithIdToken 직후 가드 → 무력화했으면 같은 id_token 으로 새 세션을 받고, 나머지 세션을
 * 끊고, 무력화가 살아 있는지 확인한다. `supabase` 는 응답 쿠키를 쓰는 SSR 클라이언트(재로그인 세션이 그 쿠키로 나간다),
 * `service` 는 관리자 호출용, `probe` 는 쿠키 없는 anon 클라이언트(확인용 로그인 — 세션이 응답으로 새지 않는다).
 */
export async function guardSocialSignIn(
  supabase: SupabaseClient,
  service: SupabaseClient,
  probe: SupabaseClient,
  signedIn: { user: User | null },
  credentials: { provider: 'google' | 'kakao'; token: string; nonce?: string }
): Promise<{ ok: true; user: User } | { ok: false; reason: string }> {
  if (!signedIn.user) return { ok: false, reason: 'no_user' };
  const result = await enforceSocialLinkGuard(service, signedIn.user);
  if (result.status === 'error') return { ok: false, reason: 'link_guard' };
  if (result.status === 'ok') return { ok: true, user: result.user };

  // 관리자 비밀번호 변경은 이 계정의 세션을 전부 지운다(GoTrue: 같은 트랜잭션) → 같은 id_token 으로 새 세션.
  const { data, error } = await supabase.auth.signInWithIdToken(credentials);
  const session = error || !data.user ? null : data.session;
  // 세션을 안 지우는 버전이어도 공격자 세션이 남지 않게 명시적으로 끊는다(보험).
  const revoked = session ? await revokeOtherSessions(service, session.access_token) : false;

  // 확인은 재로그인 성패와 무관하게 가장 늦게 한다(늦을수록 경합 쓰기를 더 잡는다).
  if (!(await passwordStillOurs(probe, service, result.user.email, result.password))) {
    // 표식을 지워 다음 소셜 로그인에서 가드 전체가 다시 돈다(null = GoTrue 가 키를 지운다).
    //   표식은 **확인이 실패했을 때만** 지운다 — 재로그인 실패에도 지우면, id_token 재사용을 거부하는 GoTrue 에선
    //   로그인할 때마다 무력화→재로그인 실패가 반복돼 영영 못 들어온다.
    await service.auth.admin.updateUserById(result.user.id, { app_metadata: { [SOCIAL_LINK_GUARD_FLAG]: null } });
    return { ok: false, reason: 'link_guard' };
  }
  if (!session) return { ok: false, reason: 'relogin_required' }; // 무력화는 확인됐다 — 다시 로그인하면 표식 덕에 바로 통과
  if (!revoked) return { ok: false, reason: 'link_guard' };
  return { ok: true, user: result.user };
}
