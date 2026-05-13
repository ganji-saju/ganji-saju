import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_SITE_ORIGIN = 'https://www.ganjisaju.kr';

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

export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const { pathname } = req.nextUrl;

  if (shouldForwardAuthCallback(req)) {
    return NextResponse.redirect(buildCanonicalAuthCallback(req));
  }

  if (process.env.NODE_ENV !== 'production') {
    return response;
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  if (!pathname.startsWith('/dashboard')) {
    return response;
  }

  const { createServerClient } = await import('@supabase/ssr');

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
