// 2026-07-04 — "카카오 계정과 함께 로그아웃".
// 앱 로그아웃(supabase signOut)만으로는 브라우저의 카카오 SSO 세션이 남아
// 다음 "카카오 로그인" 클릭 시 동의 화면 없이 즉시 재로그인됨(공용 PC 보안 취약).
// 이 라우트는 kauth 로그아웃 엔드포인트로 302 → 카카오 세션 종료 → 홈 복귀.
// ⚠️ 선행: 카카오 콘솔 [카카오 로그인 > 로그아웃 리다이렉트 URI]에
//   https://ganjisaju.kr/ (+로컬 http://localhost:3000/) 등록 필요.
import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

const KAKAO_LOGOUT_URL = 'https://kauth.kakao.com/oauth/logout';

// start/callback 라우트와 동일 패턴 — 로컬 개발은 localhost 유지, 그 외 canonical.
function resolveOrigin(req: NextRequest): string {
  try {
    const url = new URL(req.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return url.origin;
  } catch {
    // fall through
  }
  return CANONICAL_SITE_URL;
}

export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const clientId = process.env.KAKAO_REST_API_KEY;

  // 키 미설정이면 그냥 홈으로(앱 로그아웃은 클라이언트에서 이미 완료된 상태).
  if (!clientId) {
    return NextResponse.redirect(`${origin}/`);
  }

  const logoutUrl = new URL(KAKAO_LOGOUT_URL);
  logoutUrl.searchParams.set('client_id', clientId.trim());
  logoutUrl.searchParams.set('logout_redirect_uri', `${origin}/`);

  const res = NextResponse.redirect(logoutUrl.toString());
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
