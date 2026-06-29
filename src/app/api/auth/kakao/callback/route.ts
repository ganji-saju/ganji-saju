// 2026-06-29 — 카카오 OAuth 콜백(인가코드 → 토큰교환 → supabase 세션). 구글과 동일 패턴.
//   code → kauth.kakao.com/oauth/token → id_token → supabase.auth.signInWithIdToken('kakao').
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { supabaseAnonKey, supabaseServerUrl } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';

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

  const cookieState = req.cookies.get('k_oauth_state')?.value;
  const nonce = req.cookies.get('k_oauth_nonce')?.value;
  const next = getSafeNext(req.cookies.get('k_oauth_next')?.value);

  const clearCookies = (res: NextResponse) => {
    res.cookies.delete('k_oauth_state');
    res.cookies.delete('k_oauth_nonce');
    res.cookies.delete('k_oauth_next');
    return res;
  };
  const fail = (reason: string) =>
    clearCookies(
      NextResponse.redirect(
        `${origin}/login?error=oauth_provider&provider=kakao&reason=${encodeURIComponent(reason.slice(0, 120))}`
      )
    );

  if (providerError && !code) return fail(providerError);
  if (!code || !state || !cookieState || state !== cookieState) return fail('state_mismatch');

  const clientId = process.env.KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET; // 콘솔에서 활성화한 경우에만
  if (!clientId || !supabaseServerUrl || !supabaseAnonKey) {
    return fail('config');
  }

  // 인가코드 → 토큰 교환
  let idToken: string | null = null;
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: `${origin}/api/auth/kakao/callback`,
      code,
    });
    if (clientSecret) body.set('client_secret', clientSecret);

    const tokenRes = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    });
    if (!tokenRes.ok) return fail('token_exchange');
    const tokens = (await tokenRes.json()) as { id_token?: string };
    idToken = tokens.id_token ?? null;
  } catch {
    return fail('token_exchange');
  }
  if (!idToken) return fail('no_id_token'); // 콘솔 OpenID Connect 미활성 시 id_token 없음

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
    provider: 'kakao',
    token: idToken,
    nonce,
  });
  if (error) return fail(error.message);

  return response;
}
