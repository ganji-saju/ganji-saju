// 2026-06-29 — 카카오 OAuth 콜백(인가코드 → 토큰교환 → supabase 세션). 구글과 동일 패턴.
//   code → kauth.kakao.com/oauth/token → id_token → supabase.auth.signInWithIdToken('kakao').
// 2026-07-03 — 동의항목 심사 승인(이름·전화번호 필수) 후속: access_token 으로 user/me 를
//   조회해 전화번호→user_contact(알림톡 대상), 이름→profiles.display_name(비어있을 때만)
//   자동 저장. 전부 best-effort — 실패해도 로그인은 진행.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { CANONICAL_SITE_URL } from '@/lib/site';
import {
  createServiceClient,
  hasSupabaseServiceEnv,
  supabaseAnonKey,
  supabaseServerUrl,
} from '@/lib/supabase/server';
import { normalizeKoreanMobile } from '@/lib/kakao/phone';

export const dynamic = 'force-dynamic';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_ME_URL = 'https://kapi.kakao.com/v2/user/me';

// user/me 에서 전화번호·이름 추출(스코프 미동의/미제공 시 null).
async function fetchKakaoContact(
  accessToken: string
): Promise<{ phone: string | null; name: string | null }> {
  try {
    const res = await fetch(KAKAO_USER_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { phone: null, name: null };
    const me = (await res.json()) as {
      kakao_account?: { phone_number?: string; name?: string };
    };
    // 카카오 형식 "+82 10-1234-5678" → normalizeKoreanMobile 이 01012345678 로 정규화.
    return {
      phone: normalizeKoreanMobile(me.kakao_account?.phone_number),
      name: me.kakao_account?.name?.trim() || null,
    };
  } catch {
    return { phone: null, name: null };
  }
}

// 전화번호는 user_contact 에(수동 입력값 있으면 보존 — 비어있을 때만 채움, ad_consent 불변),
// 이름은 profiles.display_name 이 비어있을 때만. 로그인 흐름을 절대 막지 않는다.
async function saveKakaoContact(
  userId: string,
  contact: { phone: string | null; name: string | null }
): Promise<void> {
  if (!hasSupabaseServiceEnv) return;
  try {
    const service = await createServiceClient();

    if (contact.phone) {
      const { data: existing } = await service
        .from('user_contact')
        .select('user_id, phone')
        .eq('user_id', userId)
        .maybeSingle();
      if (!existing) {
        await service
          .from('user_contact')
          .insert({ user_id: userId, phone: contact.phone, ad_consent: false });
      } else if (!existing.phone) {
        await service.from('user_contact').update({ phone: contact.phone }).eq('user_id', userId);
      }
    }

    if (contact.name) {
      const { data: profile } = await service
        .from('profiles')
        .select('user_id, display_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (profile && !profile.display_name) {
        await service
          .from('profiles')
          .update({ display_name: contact.name })
          .eq('user_id', userId);
      }
    }
  } catch {
    // best-effort — 실패 시 설정/온보딩에서 재수집.
  }
}

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
  let accessToken: string | null = null;
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
    const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    idToken = tokens.id_token ?? null;
    accessToken = tokens.access_token ?? null;
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

  const { data: signInData, error } = await supabase.auth.signInWithIdToken({
    provider: 'kakao',
    token: idToken,
    nonce,
  });
  if (error) return fail(error.message);

  // 2026-07-03 — 전화번호(알림톡 대상)·이름 자동 수집. 실패해도 로그인은 그대로 진행.
  if (accessToken && signInData?.user?.id) {
    const contact = await fetchKakaoContact(accessToken);
    if (contact.phone || contact.name) {
      await saveKakaoContact(signInData.user.id, contact);
    }
  }

  return response;
}
