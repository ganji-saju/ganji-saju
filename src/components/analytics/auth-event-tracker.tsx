'use client';
// 2026-08-27 — OAuth(카카오·구글) 로그인/가입의 GTM 이벤트 발사.
//
//   OAuth 는 **전체 페이지 리다이렉트**라 로그인 화면에서 dataLayer 를 push 할 수 없다
//   — 성공 시점엔 브라우저가 이미 그 페이지를 떠났다.
//   그렇다고 복귀 URL 에 파라미터를 붙이면 목적지(체크아웃 등) 쿼리를 오염시킨다.
//   그래서 콜백 라우트가 **단명 쿠키**(gj_auth_event, 120초)에 결과를 남기고,
//   여기서 한 번 읽어 push 한 뒤 즉시 지운다. URL 은 건드리지 않는다.
//
//   이메일 경로는 이 컴포넌트를 쓰지 않는다 — 로그인 페이지가 그 자리에서 직접 push 한다.
import { useEffect } from 'react';
import { gtmLogin, gtmSignUp } from '@/lib/analytics/gtm';

const COOKIE = 'gj_auth_event';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function parseMethod(value: string): 'kakao' | 'google' | 'email' {
  if (value === 'kakao' || value === 'google') return value;
  return 'email';
}

export function AuthEventTracker() {
  useEffect(() => {
    const raw = readCookie(COOKIE);
    if (!raw) return;
    // 읽는 즉시 지운다 — 남겨 두면 이후 라우트 이동마다 같은 로그인이 다시 세어진다.
    clearCookie(COOKIE);

    const [kind, provider = ''] = raw.split(':');
    const method = parseMethod(provider);
    if (kind === 'sign_up') gtmSignUp(method);
    else if (kind === 'login') gtmLogin(method);
  }, []);

  return null;
}
