// 2026-07-04 — 공용 로그아웃 헬퍼(클라이언트 전용).
// 카카오 가입자는 앱 세션 종료 후 /api/auth/kakao/logout 으로 풀 내비게이션해
// 카카오 SSO 세션까지 함께 끊는다(카카오 → 홈 복귀). 구글/이메일은 기존 동작.
import { createClient, hasSupabaseBrowserEnv } from '@/lib/supabase/client';

export type SignOutResult =
  | 'kakao-redirect' // 카카오 함께 로그아웃으로 풀 내비게이션 시작 — 호출측 라우팅 불필요
  | 'local'; // 앱 세션만 종료 — 호출측이 기존 라우팅(홈 이동 등) 수행

/**
 * 앱 로그아웃 + (카카오 가입자면) 카카오 계정 함께 로그아웃.
 * 반드시 signOut "전에" provider 를 조회해야 함(종료 후엔 user=null).
 */
export async function signOutWithProviderCleanup(): Promise<SignOutResult> {
  if (!hasSupabaseBrowserEnv) return 'local';
  const supabase = createClient();

  let isKakao = false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isKakao = user?.app_metadata?.provider === 'kakao';
  } catch {
    isKakao = false;
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // 네트워크 실패해도 클라이언트 세션은 비움 — 진행.
  }

  if (isKakao && typeof window !== 'undefined') {
    window.location.href = '/api/auth/kakao/logout';
    return 'kakao-redirect';
  }
  return 'local';
}
