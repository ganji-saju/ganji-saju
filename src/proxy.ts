import { NextRequest, NextResponse } from 'next/server';
import { isFreeEntryPath, isLockedPath } from '@/lib/paywall-lockdown';
import {
  CANONICAL_REDIRECT_STATUS,
  CANONICAL_SITE_URL,
  isCanonicalRedirectExemptPath,
  shouldRedirectHost,
} from '@/lib/site';

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

/**
 * Supabase 세션 쿠키가 하나라도 있는가(= 로그인했을 가능성).
 * 이름은 `sb-<projectRef>-auth-token`(+ 청크 `.0`/`.1`)이지만, 이름 규칙이 바뀌어도
 * 로그인 사용자를 잘못 막지 않도록 **`sb-` 접두사 존재만** 본다(fail-open).
 */
function hasSupabaseSessionCookie(req: NextRequest) {
  return req.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));
}

function buildCanonicalUrl(req: NextRequest) {
  const canonicalUrl = new URL(req.nextUrl.pathname, CANONICAL_SITE_ORIGIN);
  canonicalUrl.search = req.nextUrl.search;
  return canonicalUrl;
}

/**
 * 🔴 2026-08-29 — staging 접근 차단(Basic 인증).
 *
 *   Vercel Deployment Protection 은 Pro 전용($150/월)이라 쓰지 않는다. 같은 목적을
 *   미들웨어에서 무료로 달성한다: staging 호스트로 들어오면 비밀번호를 요구한다.
 *
 *   왜 필요한가 — staging 은 프로덕션과 **같은 Supabase** 를 쓴다. 실사용자가 흘러들어와
 *   결제하면 그 주문이 실매출 원장에 남고(#696 이 집계에서 걸러주지만 원장은 더러워진다),
 *   크롤러가 훑으면 staging URL 이 색인된다(robots.txt 는 Allow: / 로 열려 있다).
 *
 *   ⚠️ env 미설정이면 **잠그지 않는다.** 비밀번호 없이 잠그면 아무도 못 들어간다 —
 *   빈 값으로 자물쇠를 채우는 것보다 열어두고 눈에 띄게 두는 편이 낫다(opt-in).
 *   ⚠️ `/api/` 는 제외한다. PG 웹훅·크론은 브라우저 프롬프트를 이해하지 못하고,
 *   각 라우트가 이미 CRON_SECRET·HMAC·세션으로 스스로를 지킨다.
 */
const STAGING_HOSTS = new Set(['staging.ganjisaju.kr']);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function stagingGateResponse(req: NextRequest): NextResponse | null {
  const password = process.env.STAGING_ACCESS_PASSWORD;
  if (!password) return null; // opt-in — 미설정이면 무동작
  if (!STAGING_HOSTS.has(req.nextUrl.hostname)) return null;
  if (req.nextUrl.pathname.startsWith('/api/')) return null;

  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      // user 는 무엇이든 좋다 — 비밀번호만 본다(브라우저 프롬프트에 아이디 칸이 있을 뿐).
      const supplied = decoded.slice(decoded.indexOf(':') + 1);
      if (timingSafeEqual(supplied, password)) return null;
    } catch {
      // 잘못된 base64 → 아래에서 재요구
    }
  }

  return new NextResponse('staging — 관리자 전용', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ganjisaju staging", charset="UTF-8"',
      // 401 이라도 색인 시도를 확실히 끊는다.
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}

export async function proxy(req: NextRequest) {
  // staging 접근 차단은 **가장 먼저** — 잠금 리다이렉트·canonical 보다 앞이어야
  //   비인증 요청이 내부 경로를 한 걸음도 밟지 않는다.
  const gate = stagingGateResponse(req);
  if (gate) return gate;

  let response = NextResponse.next({ request: req });
  const { pathname } = req.nextUrl;

  // Vercel Cron 은 프로덕션 배포의 *.vercel.app URL 로 호출된다. canonical 301 이 그걸 튕기면
  //   크론은 리다이렉트를 따라가지 않아 핸들러가 영영 실행되지 않는다(2026-07-10 발견).
  //   API 는 SEO 정규화 대상이 아니므로 제외한다 — 각 라우트가 CRON_SECRET·서명으로 보호된다.
  if (!isCanonicalRedirectExemptPath(pathname) && shouldRedirectToCanonicalHost(req)) {
    return NextResponse.redirect(buildCanonicalUrl(req), CANONICAL_REDIRECT_STATUS);
  }

  if (shouldForwardAuthCallback(req)) {
    return NextResponse.redirect(buildAuthCallbackUrl(req));
  }

  // 2026-08-11 — 전면 유료화 잠금. 무료 전용 콘텐츠 라우트를 결제 안내로 보낸다.
  //   · 307(임시)인 이유: 잠금은 되돌릴 수 있어야 한다. 301 은 브라우저·CDN 이 영구
  //     캐시해서 env 를 꺼도 사용자 단말에서 계속 튕긴다.
  //   · /api 는 제외 — 각 라우트가 자체 권한·무료할당량으로 판정한다(결제 사용자 열람 보존).
  if (!pathname.startsWith('/api/') && isLockedPath(pathname)) {
    return NextResponse.redirect(new URL('/pricing', req.nextUrl.origin), 307);
  }

  // (B)갈래 무료 진입 경로 — **비로그인 방문자·크롤러만** 여기서 끊는다.
  //   결제엔 로그인이 필요하므로 비로그인은 결제 이력이 있을 수 없다 = DB 조회 없이 확정 판정.
  //   로그인 사용자는 통과시키고, 페이지의 guardLockedFreeEntry() 가 결제 이력을 판정한다.
  //   ⚠️ 세션 쿠키가 조금이라도 보이면 통과(fail-open) — 결제자를 잘못 막는 쪽이 훨씬 비싸다.
  //   ⚠️ 결제 복귀(`?paid=…`)는 무조건 통과 — 결제 직후 사용자를 튕기면 안 된다.
  if (
    isFreeEntryPath(pathname) &&
    !req.nextUrl.searchParams.has('paid') &&
    !hasSupabaseSessionCookie(req)
  ) {
    return NextResponse.redirect(new URL('/pricing', req.nextUrl.origin), 307);
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
