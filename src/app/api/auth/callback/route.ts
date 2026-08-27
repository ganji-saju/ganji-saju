import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { supabaseAnonKey, supabaseServerUrl } from '@/lib/supabase/server';

const CANONICAL_SITE_ORIGIN = CANONICAL_SITE_URL;

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, CANONICAL_SITE_ORIGIN);
    if (url.pathname === '/login' && url.searchParams.get('mode') === 'reset-password') {
      return '/reset-password';
    }
  } catch {
    // Keep the original safe relative path below.
  }
  return value;
}

function getSafeProvider(value: string | null) {
  if (value === 'google' || value === 'kakao') return value;
  return null;
}

function getConfiguredOrigin() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (!configuredUrl?.startsWith('http')) return null;

  try {
    const url = new URL(configuredUrl);
    if (url.hostname.endsWith('.supabase.co')) return null;
    if (isLegacyAuthHost(url.hostname) || isVercelAutoDomain(url)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isVercelAutoDomain(url: URL) {
  return url.hostname.endsWith('.vercel.app');
}

function isLegacyAuthHost(hostname: string) {
  return (
    hostname === 'ganjisaju.kr' ||
    hostname === 'www.ganjisaju.kr' ||
    hostname === 'ganji-saju.vercel.app' ||
    hostname === 'ganji-saju-ganji-sajus-projects.vercel.app' ||
    hostname === 'ganji-saju-ganji-saju.vercel.app'
  );
}

function getRedirectOrigin(requestOrigin: string) {
  try {
    const url = new URL(requestOrigin);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (isLocal) return url.origin;

    const isVercelAutoDomain =
      url.hostname.endsWith('.vercel.app') && url.origin !== CANONICAL_SITE_ORIGIN;
    if (!isVercelAutoDomain && !isLegacyAuthHost(url.hostname)) return url.origin;
  } catch {
    // Fall back to the configured origin below.
  }

  return getConfiguredOrigin() ?? CANONICAL_SITE_ORIGIN;
}

function buildLoginRedirect({
  origin,
  next,
  error,
  provider,
  reason,
}: {
  origin: string;
  next: string;
  error: string;
  provider?: string | null;
  reason?: string | null;
}) {
  const params = new URLSearchParams({
    next,
    error,
  });
  if (provider) params.set('provider', provider);
  if (reason) params.set('reason', reason.slice(0, 120));
  return `${origin}/login?${params.toString()}`;
}

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const { searchParams } = requestUrl;
  const origin = getRedirectOrigin(requestUrl.origin);
  const code = searchParams.get('code');
  const next = getSafeNext(searchParams.get('next'));
  const provider = getSafeProvider(searchParams.get('provider'));
  const providerError = searchParams.get('error');
  const providerErrorDescription = searchParams.get('error_description');

  if (providerError && !code) {
    return NextResponse.redirect(
      buildLoginRedirect({
        origin,
        next,
        error: 'oauth_provider',
        provider,
        reason: providerErrorDescription ?? providerError,
      })
    );
  }

  if (code) {
    if (!supabaseServerUrl || !supabaseAnonKey) {
      return NextResponse.redirect(
        buildLoginRedirect({ origin, next, error: 'oauth_config', provider })
      );
    }

    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      supabaseServerUrl,
      supabaseAnonKey,
      {
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
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        buildLoginRedirect({
          origin,
          next,
          error: 'oauth_exchange',
          provider,
          reason: error.message,
        })
      );
    }

    // 2026-08-27 — GTM 로그인/가입 이벤트 마커.
    //   OAuth 는 전체 리다이렉트라 클라이언트가 성공 시점을 알 방법이 없다. 복귀 URL 에
    //   파라미터를 붙이면 목적지 쿼리가 오염되므로 단명 쿠키로 넘긴다
    //   (AuthEventTracker 가 읽고 즉시 지운다). httpOnly 아님 — JS 가 읽어야 한다.
    //   가입/로그인 구분은 계정 생성 시각으로 본다. 판단이 안 서면 login 으로 둔다 —
    //   신규를 재방문으로 세는 쪽이, 재방문을 신규로 부풀리는 쪽보다 덜 해롭다.
    const createdAt = data?.user?.created_at ? Date.parse(data.user.created_at) : NaN;
    const isNewUser = Number.isFinite(createdAt) && Date.now() - createdAt < 60_000;
    response.cookies.set(
      'gj_auth_event',
      `${isNewUser ? 'sign_up' : 'login'}:${provider ?? 'oauth'}`,
      { path: '/', maxAge: 120, sameSite: 'lax', httpOnly: false }
    );

    return response;
  }

  return NextResponse.redirect(
    buildLoginRedirect({ origin, next, error: 'oauth', provider })
  );
}
