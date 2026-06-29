// 2026-06-29 — 구글 OAuth 인가코드 플로우 시작(내 도메인 동의화면).
//   기존 signInWithOAuth 는 supabase.co 를 거쳐 동의화면에 supabase.co 가 노출됐다.
//   여기서 redirect_uri = ganjisaju.kr/api/auth/google/callback 로 직접 구글에 보내 동의화면을
//   내 도메인으로 만든다. 받은 code 는 callback 에서 토큰교환 → supabase signInWithIdToken.
import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SITE_URL } from '@/lib/site';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

function resolveOrigin(req: NextRequest): string {
  try {
    const url = new URL(req.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return url.origin;
  } catch {
    // fall through
  }
  return CANONICAL_SITE_URL; // 운영은 항상 canonical (redirect_uri 가 구글 콘솔 등록값과 일치해야 함)
}

function getSafeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const next = getSafeNext(new URL(req.url).searchParams.get('next'));
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(`${origin}/login?error=oauth_config&provider=google`);
  }

  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const redirectUri = `${origin}/api/auth/google/callback`;

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(authUrl.toString());
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600, // 10분
  };
  res.cookies.set('g_oauth_state', state, cookieOptions);
  res.cookies.set('g_oauth_nonce', nonce, cookieOptions);
  res.cookies.set('g_oauth_next', next, cookieOptions);
  return res;
}
