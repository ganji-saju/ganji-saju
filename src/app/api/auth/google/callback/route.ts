// 2026-06-29 — 구글 OAuth 콜백(인가코드 → 토큰교환 → supabase 세션).
//   start 에서 redirect_uri = ganjisaju.kr/api/auth/google/callback 로 받은 code 를
//   구글 토큰엔드포인트에서 id_token 으로 교환 → supabase.auth.signInWithIdToken 으로 세션 생성.
//   세션 쿠키는 @supabase/ssr 어댑터가 응답에 세팅(기존 /api/auth/callback 과 동일 패턴).
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { supabaseAnonKey, supabaseServerUrl } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function resolveOrigin(req: NextRequest): string {
  try {
    const url = new URL(req.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return url.origin;
  } catch {
    // fall through
  }
  return CANONICAL_SITE_URL;
}

function getSafeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const params = new URL(req.url).searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const providerError = params.get('error');

  const cookieState = req.cookies.get('g_oauth_state')?.value;
  const nonce = req.cookies.get('g_oauth_nonce')?.value;
  const next = getSafeNext(req.cookies.get('g_oauth_next')?.value);

  const clearCookies = (res: NextResponse) => {
    res.cookies.delete('g_oauth_state');
    res.cookies.delete('g_oauth_nonce');
    res.cookies.delete('g_oauth_next');
    return res;
  };
  const fail = (reason: string) =>
    clearCookies(
      NextResponse.redirect(
        `${origin}/login?error=oauth_provider&provider=google&reason=${encodeURIComponent(reason.slice(0, 120))}`
      )
    );

  if (providerError && !code) return fail(providerError);
  if (!code || !state || !cookieState || state !== cookieState) return fail('state_mismatch');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !supabaseServerUrl || !supabaseAnonKey) {
    return fail('config');
  }

  // 인가코드 → 토큰 교환
  let idToken: string | null = null;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('token_exchange');
    const tokens = (await tokenRes.json()) as { id_token?: string };
    idToken = tokens.id_token ?? null;
  } catch {
    return fail('token_exchange');
  }
  if (!idToken) return fail('no_id_token');

  // supabase 세션 생성 — 쿠키는 응답에 세팅
  const response = clearCookies(NextResponse.redirect(`${origin}${next}`));
  const supabase = createServerClient(supabaseServerUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    nonce,
  });
  if (error) return fail(error.message);

  return response;
}
