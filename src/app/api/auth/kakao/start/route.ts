// 2026-06-29 — 카카오 OAuth 인가코드 플로우 시작(내 도메인 동의화면). 구글과 동일 패턴.
//   redirect_uri = ganjisaju.kr/api/auth/kakao/callback 로 카카오에 직접 보내 동의화면을
//   내 도메인으로. 카카오는 OIDC 라 scope=openid 로 id_token 을 받는다(콘솔 OIDC 활성 필요).
import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SITE_URL } from '@/lib/site';

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

function getSafeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

// GoTrue 는 raw nonce 를 sha256(hex) 해 id_token.nonce 와 비교 → 카카오엔 해시 nonce 전송.
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const next = getSafeNext(new URL(req.url).searchParams.get('next'));
  const clientId = process.env.KAKAO_REST_API_KEY;

  if (!clientId) {
    return NextResponse.redirect(`${origin}/login?error=oauth_config&provider=kakao`);
  }

  const state = crypto.randomUUID();
  const rawNonce = crypto.randomUUID();
  const hashedNonce = await sha256Hex(rawNonce);
  const redirectUri = `${origin}/api/auth/kakao/callback`;

  const authUrl = new URL(KAKAO_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  // 2026-07-04 핫픽스 — 콘솔 [동의항목]에 미설정된 scope 를 요청하면 카카오가
  // KOE205 로 전면 거부해 로그인이 통째로 죽는다(#591 배포 직후 발생: 심사 진행중이라
  // 이름·전화번호 항목을 아직 설정 못 함). 기본은 openid 만 요청해 로그인을 보장하고,
  // 심사 승인 + [동의항목] 설정 완료 후 env 로 추가 scope 를 켠다:
  //   KAKAO_LOGIN_EXTRA_SCOPES="name phone_number" (+재배포)
  // 콜백(user/me 수집)은 scope 미동의 시 null 을 반환하므로 어느 상태든 안전.
  const extraScopes = (process.env.KAKAO_LOGIN_EXTRA_SCOPES ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  authUrl.searchParams.set('scope', ['openid', ...extraScopes].join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', hashedNonce);

  const res = NextResponse.redirect(authUrl.toString());
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,
  };
  res.cookies.set('k_oauth_state', state, cookieOptions);
  res.cookies.set('k_oauth_nonce', rawNonce, cookieOptions);
  res.cookies.set('k_oauth_next', next, cookieOptions);
  return res;
}
