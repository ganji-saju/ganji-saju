// 2026-08-02 — 카카오 plusfriends 채널 친구여부 검증 전용 OAuth 시작(coupon-verify).
//   로그인 시작(../start/route.ts, scope=openid)과 완전히 분리된 별도 플로우다(로그인
//   전환율 보호 — 로그인 쪽은 절대 건드리지 않는다). 상태/nonce/쿠키옵션 패턴은 로그인
//   시작 라우트를 그대로 미러링하되, 차이는 4가지뿐이다:
//     1) 휴면 게이트 우선 — OFF 면 카카오로 리다이렉트조차 하지 않고 404.
//     2) scope=plusfriends 고정(로그인의 openid 와 다름 — 채널 친구여부 조회 권한).
//     3) redirect_uri = coupon-verify 콜백(로그인 콜백이 아님).
//     4) 쿠키 이름 kc_oauth_state/kc_oauth_nonce(콜백의 validator 와 정확히 일치시켜야
//        함 — k_oauth_* 는 로그인 전용, 여기서 재사용하면 두 플로우가 충돌한다).
import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { isKakaoFriendCouponEnabled } from '@/lib/coupons/kakao-friend-coupon';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize';

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

export async function GET(req: NextRequest) {
  // 0) 휴면 게이트 — 다른 어떤 처리보다 먼저. OFF 면 카카오로 보내지 않고 완전 무동작.
  if (!isKakaoFriendCouponEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const origin = resolveOrigin(req);

  // 0-1) 🔴 2026-09-01 — 로그인 선행. 쿠폰은 계정에 귀속되므로 콜백이 비로그인이면
  //   `unauthorized` 로 죽는데, 그 시점엔 사용자가 이미 카카오 동의까지 다 마친 뒤다.
  //   실제로 상태 API 가 비로그인에게도 'issuable' 을 줘서 홈 배너가 방문자 전원에게
  //   보였고(프로덕션 실측), 누른 사람은 전원 여기서 조용히 떨어졌다.
  //   진입점이 4곳이라 배너마다 막지 않고 **공통 시작점인 여기서** 한 번 막는다.
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) {
      const next = encodeURIComponent('/api/auth/kakao/coupon-verify/start');
      return NextResponse.redirect(`${origin}/login?next=${next}`);
    }
  } catch {
    // 세션 조회 실패는 막지 않는다 — 콜백이 다시 판정한다(결제자 오차단 방지 원칙과 동일).
  }

  const clientId = process.env.KAKAO_REST_API_KEY;

  if (!clientId) {
    return NextResponse.redirect(`${origin}/my/settings?kakaoCoupon=error&reason=oauth_config`);
  }

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const redirectUri = `${origin}/api/auth/kakao/coupon-verify`;

  const authUrl = new URL(KAKAO_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  // 채널 친구여부(GET /v1/api/talk/channels) 조회 권한 — 콘솔 [동의항목]에 plusfriends 가
  // 설정되어 있어야 한다(로그인 시작의 openid 와 완전히 다른 스코프, 절대 병합하지 않는다).
  authUrl.searchParams.set('scope', 'plusfriends');
  authUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authUrl.toString());
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,
  };
  // 콜백(coupon-verify/route.ts) 이 검증하는 정확히 그 이름 — 로그인의 k_oauth_* 와 절대
  // 공유하지 않는다(동시 진행 시 충돌 방지).
  res.cookies.set('kc_oauth_state', state, cookieOptions);
  res.cookies.set('kc_oauth_nonce', nonce, cookieOptions);
  return res;
}
