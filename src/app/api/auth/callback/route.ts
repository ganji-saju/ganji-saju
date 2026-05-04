import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const CANONICAL_SITE_ORIGIN = 'https://ganji-saju.vercel.app';

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
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
    return url.origin;
  } catch {
    return null;
  }
}

function getRedirectOrigin(requestOrigin: string) {
  const configuredOrigin = getConfiguredOrigin();
  if (configuredOrigin) return configuredOrigin;

  try {
    const url = new URL(requestOrigin);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (isLocal) return url.origin;

    const isVercelAutoDomain =
      url.hostname.endsWith('.vercel.app') && url.origin !== CANONICAL_SITE_ORIGIN;
    if (isVercelAutoDomain) return CANONICAL_SITE_ORIGIN;

    return url.origin;
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(
        buildLoginRedirect({ origin, next, error: 'oauth_config', provider })
      );
    }

    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      supabaseUrl,
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);
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

    return response;
  }

  return NextResponse.redirect(
    buildLoginRedirect({ origin, next, error: 'oauth', provider })
  );
}
