// 2026-08-02 — 카카오 plus_friends 채널 친구여부 검증 전용 OAuth 시작(coupon-verify).
//   로그인 시작(../start/route.ts, scope=openid)과 완전히 분리된 별도 플로우다(로그인
//   전환율 보호 — 로그인 쪽은 절대 건드리지 않는다). 상태/nonce/쿠키옵션 패턴은 로그인
//   시작 라우트를 그대로 미러링하되, 차이는 4가지뿐이다:
//     1) 휴면 게이트 우선 — OFF 면 카카오로 리다이렉트조차 하지 않고 404.
//     2) scope=plus_friends 고정(로그인의 openid 와 다름 — 채널 친구여부 조회 권한).
//     3) redirect_uri = coupon-verify 콜백(로그인 콜백이 아님).
//     4) 쿠키 이름 kc_oauth_state/kc_oauth_nonce(콜백의 validator 와 정확히 일치시켜야
//        함 — k_oauth_* 는 로그인 전용, 여기서 재사용하면 두 플로우가 충돌한다).
import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { isKakaoFriendCouponEnabled } from '@/lib/coupons/kakao-friend-coupon';

export const dynamic = 'force-dynamic';

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize';

function resolveOrigin(req: NextRequest): string {
  try {
    const url = new URL(req.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return url.origin;
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
  // 채널 친구여부(GET /v1/api/talk/channels) 조회 권한 — 콘솔 [동의항목]에 plus_friends 가
  // 설정되어 있어야 한다(로그인 시작의 openid 와 완전히 다른 스코프, 절대 병합하지 않는다).
  authUrl.searchParams.set('scope', 'plus_friends');
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
