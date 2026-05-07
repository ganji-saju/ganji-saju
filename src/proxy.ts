import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SITE_URL } from '@/lib/site';

const CANONICAL_SITE_ORIGIN = CANONICAL_SITE_URL;
const CANONICAL_SITE_HOST = new URL(CANONICAL_SITE_ORIGIN).hostname;
const supabaseProxyUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseProxyKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function shouldForwardAuthCallback(req: NextRequest) {
  if (req.nextUrl.pathname !== '/') return false;

  const params = req.nextUrl.searchParams;
  return (
    params.has('code') ||
    (params.has('error') && (params.has('error_code') || params.has('error_description')))
  );
}

function buildCanonicalAuthCallback(req: NextRequest) {
  const callbackUrl = new URL('/api/auth/callback', CANONICAL_SITE_ORIGIN);

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

  const host = req.nextUrl.hostname;
  if (host === CANONICAL_SITE_HOST) return false;
  if (host === 'localhost' || host === '127.0.0.1') return false;

  return (
    host.endsWith('.vercel.app') ||
    host === 'ganjisaju.kr' ||
    host === 'www.ganjisaju.kr'
  );
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
    return NextResponse.redirect(buildCanonicalUrl(req), 308);
  }

  if (shouldForwardAuthCallback(req)) {
    return NextResponse.redirect(buildCanonicalAuthCallback(req));
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
