// 2026-08-02 — 카카오 plusfriends 채널 친구여부 검증 전용 OAuth(coupon-verify).
//   메인 로그인 콜백(/api/auth/kakao/callback, scope=openid)과 완전히 분리된 별도 플로우다
//   (로그인 전환율 보호 — 로그인 스코프는 절대 건드리지 않는다). 흐름:
//     (Task 7/8 CTA가) 사용자를 카카오 인가화면(scope=plusfriends)으로 보냄
//       → 카카오가 이 라우트로 code 를 돌려줌 → 토큰교환 → GET /v1/api/talk/channels(Bearer)
//       → isChannelFriend(...) 로 우리 채널(kakaoChannelId) 친구여부 판정.
//   ⚠️ 이 라우트는 "수신(콜백)" 측만 구현한다. 카카오로 보내는 "시작(authorize 리다이렉트)"
//   라우트는 아직 없다 — Task 7/8(CTA 배치)에서 kc_oauth_state/kc_oauth_nonce 쿠키를 심고
//   scope=plusfriends 로 카카오 인가화면에 리다이렉트하는 start 라우트를 배선해야
//   이 콜백이 실제로 도달한다. 그 전까지는 env 게이트로 휴면(도달 자체가 불가능).
//
// ⚠️ 검증필요 — 카카오 GET /v1/api/talk/channels 응답 스키마는 문서 기준(공식 문서/기존
//   콜백 참조)이며 실 응답으로 재확인 권장. isChannelFriend(src/lib/kakao/channel-friendship.ts)
//   가 방어적으로 파싱하므로 스키마가 다소 달라도 throw 없이 false 로 안전 처리된다.
import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import { isKakaoFriendCouponEnabled, issueKakaoFriendCoupon } from '@/lib/coupons/kakao-friend-coupon';
import { kakaoChannelId } from '@/lib/kakao/channel';
import { isChannelFriend } from '@/lib/kakao/channel-friendship';

export const dynamic = 'force-dynamic';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_CHANNELS_URL = 'https://kapi.kakao.com/v1/api/talk/channels';
const KAKAO_USER_ME_URL = 'https://kapi.kakao.com/v2/user/me';

// 결과를 보여줄 목적지. 쿠폰 CTA 진입점 4곳 중 하나(Task 8)인 마이/설정 — 아직 CTA 가
// 배치되지 않았어도 쿼리파라미터로 결과를 실어 보내는 계약만 여기서 고정해 둔다.
const RESULT_PATH = '/my/settings';

function resolveOrigin(req: NextRequest): string {
  try {
    const url = new URL(req.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return url.origin;
    // 2026-08-25 — 고정 스테이징 도메인은 origin 유지(#679 는 start 만 고쳐 callback 이
    //   canonical 로 새는 걸 놓쳤다 — 토큰 교환 redirect_uri 불일치 + 최종 리다이렉트가
    //   본사이트로 가서 세션이 스테이징에 안 남았다). start/callback/logout 전부 동일 규칙.
    if (url.hostname === 'staging.ganjisaju.kr') return url.origin;
  } catch {
    // fall through
  }
  return CANONICAL_SITE_URL;
}

// 카카오 회원번호(감사 로그용) — 동의항목과 무관하게 항상 제공되는 id 필드.
// 실패해도 친구여부 검증 흐름 자체를 막지 않는다(로그인 콜백 fetchKakaoContact 와 동일한
// best-effort 원칙). Task 6 이 issueKakaoFriendCoupon(userId, verifiedKakaoUid) 에 사용한다.
async function fetchKakaoUid(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(KAKAO_USER_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const me = (await res.json()) as { id?: number | string };
    return me.id != null ? String(me.id) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  // 0) 휴면 게이트 — 다른 어떤 처리보다 먼저. OFF 면 완전 무동작(404, 카카오 콘솔 세팅 전 안전).
  if (!isKakaoFriendCouponEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const origin = resolveOrigin(req);
  const params = new URL(req.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const providerError = params.get('error');

  // 로그인 콜백의 k_oauth_* 쿠키와 절대 공유하지 않는다(별도 플로우 — 동시 진행 시 충돌 방지).
  const cookieState = req.cookies.get('kc_oauth_state')?.value;

  const clearCookies = (res: NextResponse) => {
    res.cookies.delete('kc_oauth_state');
    res.cookies.delete('kc_oauth_nonce');
    return res;
  };
  // 🔴 2026-09-01 — 실패를 **반드시 로그로 남긴다**. 전엔 리다이렉트만 하고 아무 기록이
  //   없어서 "쿠폰이 안 와요" 컴플레인이 들어와도 어느 단계에서 죽는지 알 방법이 없었다
  //   (menu-pass 의 조용한 catch 와 같은 함정 — 로그가 없는 게 무죄의 증거처럼 보인다).
  const fail = (reason: string) => {
    console.error('[kakao-coupon] verification failed', { reason });
    return clearCookies(
      NextResponse.redirect(
        `${origin}${RESULT_PATH}?kakaoCoupon=error&reason=${encodeURIComponent(reason.slice(0, 120))}`
      )
    );
  };

  if (providerError && !code) return fail(providerError);
  if (!code || !state || !cookieState || state !== cookieState) return fail('state_mismatch');

  // 1) 인증된 앱 유저 확인 — 쿠폰은 로그인 상태에서만 발급/귀속 가능(redeem route 와 동일 패턴).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('unauthorized');

  const clientId = process.env.KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET; // 콘솔에서 활성화한 경우에만
  if (!clientId || !kakaoChannelId) return fail('config');

  // 2) 인가코드 → 토큰 교환(로그인 콜백과 동일 패턴, redirect_uri 만 이 라우트로 분리).
  let accessToken: string | null = null;
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: `${origin}/api/auth/kakao/coupon-verify`,
      code,
    });
    if (clientSecret) body.set('client_secret', clientSecret);

    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    });
    if (!tokenRes.ok) return fail('token_exchange');
    const tokens = (await tokenRes.json()) as { access_token?: string };
    accessToken = tokens.access_token ?? null;
  } catch {
    return fail('token_exchange');
  }
  if (!accessToken) return fail('no_access_token');

  // 3) 채널 친구여부 확인.
  let isFriend = false;
  try {
    const channelsRes = await fetch(KAKAO_CHANNELS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!channelsRes.ok) return fail('channels_fetch');
    const channelsJson = await channelsRes.json();
    isFriend = isChannelFriend(channelsJson, kakaoChannelId);
  } catch {
    return fail('channels_fetch');
  }

  if (!isFriend) return fail('not_friend');

  // 4) 친구 확인됨 → 쿠폰 멱등 발급(계정당 1회, user_coupons UNIQUE 강제). kakaoUid=감사용 verified_kakao_uid.
  const kakaoUid = await fetchKakaoUid(accessToken);
  const issued = await issueKakaoFriendCoupon(user.id, kakaoUid ?? '');
  if (!issued.ok) {
    console.error('[kakao-coupon] issuance failed after friend verification', { userId: user.id });
    return fail('issue_failed');
  }

  return clearCookies(NextResponse.redirect(`${origin}${RESULT_PATH}?kakaoCoupon=issued`));
}
