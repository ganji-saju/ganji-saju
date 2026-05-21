import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_REDIRECT_STATUS, CANONICAL_SITE_URL, shouldRedirectHost } from '@/lib/site';

const CANONICAL_SITE_ORIGIN = CANONICAL_SITE_URL;
const supabaseProxyUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseProxyKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function shouldForwardAuthCallback(req: NextRequest) {
  if (req.nextUrl.pathname !== '/') return false;

  const params = req.nextUrl.searchParams;
  return (
    (params.has('error') && (params.has('error_code') || params.has('error_description')))
  );
}

function buildAuthCallbackUrl(req: NextRequest) {
  const callbackUrl = new URL('/api/auth/callback', req.nextUrl.origin);

  req.nextUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });

  if (!callbackUrl.searchParams.has('next')) {
    callbackUrl.searchParams.set('next', '/');
  }

  return callbackUrl;
}

function shouldRedirectToCanonicalHost(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return false;

  // Vercel preview/development 배포는 canonical redirect 대상에서 제외한다.
  // (PR preview URL 이 운영 도메인으로 튕기면 디자인 리뷰가 불가능)
  // VERCEL_ENV 는 production / preview / development 중 하나.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return false;

  // 2026-05-18 hotfix: hardcoded host list 대신 src/lib/site.ts 의 shouldRedirectHost 사용 —
  // LEGACY_SITE_HOSTS (간지사주.kr punycode / apex / Vercel auto 등) 와 단일 source of truth.
  // 기존 hardcoded 가 punycode 누락 → 간지사주.kr 진입 시 canonical 정규화 안 되던 회귀 fix.
  return shouldRedirectHost(req.nextUrl.hostname);
}

function buildCanonicalUrl(req: NextRequest) {
  const canonicalUrl = new URL(req.nextUrl.pathname, CANONICAL_SITE_ORIGIN);
  canonicalUrl.search = req.nextUrl.search;
  return canonicalUrl;
}

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const { pathname } = req.nextUrl;

  if (shouldRedirectToCanonicalHost(req)) {
    return NextResponse.redirect(buildCanonicalUrl(req), CANONICAL_REDIRECT_STATUS);
  }

  if (shouldForwardAuthCallback(req)) {
    return NextResponse.redirect(buildAuthCallbackUrl(req));
  }

  if (process.env.NODE_ENV !== 'production') {
    return response;
  }

  if (
    !supabaseProxyUrl ||
    !supabaseProxyKey
  ) {
    return response;
  }

  if (!pathname.startsWith('/dashboard')) {
    return response;
  }

  const { createServerClient } = await import('@supabase/ssr');

  const supabase = createServerClient(
    supabaseProxyUrl,
    supabaseProxyKey,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
