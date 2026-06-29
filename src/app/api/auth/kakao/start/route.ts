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
  authUrl.searchParams.set('scope', 'openid');
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
