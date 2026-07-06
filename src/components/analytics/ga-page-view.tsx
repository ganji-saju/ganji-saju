'use client';

// 2026-07-06 — 개인정보 안전 GA4 page_view.
//   이 앱의 사주/공유 URL 은 경로·쿼리에 생년월일·태어난시간·성별·이름을 담는다
//   (toSlug / 공유 쿼리 a·b·n·d·c). GA4 자동 page_view 는 전체 URL 을 구글로 보내므로
//   layout 에서 send_page_view:false 로 끄고, 여기서 "민감정보를 제거한 경로"만
//   수동 page_view 로 보낸다. 방문/페이지뷰 통계는 정상 수집, 민감정보만 미전송.
//
//   ⚠️ 이 보호는 '직접 심은 gtag' 경로에만 적용된다. GTM 컨테이너가 별도 GA4 태그로
//   자동 page_view 를 쏘면 그건 GTM UI 설정이라 코드로 못 막는다(layout 주석 참고).

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { sanitizePath, sanitizeQuery } from './ga-sanitize';

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

/** 같은 출처 referrer 는 경로를 정제, 외부 referrer 는 유입분석용으로 유지. */
function sanitizeReferrer(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined;
  try {
    const url = new URL(document.referrer);
    if (url.origin === window.location.origin) {
      return url.origin + sanitizePath(url.pathname) + sanitizeQuery(url.search);
    }
    return document.referrer;
  } catch {
    return undefined;
  }
}

function sendSanitizedPageView(pathname: string) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  const path = sanitizePath(pathname) + sanitizeQuery(window.location.search);
  const isRedacted = path.includes('/redacted');
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.origin + path,
    // 개인 페이지 제목엔 이름이 들어갈 수 있으므로 정제 경로로 대체, 그 외엔 실제 제목.
    page_title: isRedacted ? path : document.title,
    page_referrer: sanitizeReferrer(),
  });
}

/**
 * 라우트 변경마다 정제된 page_view 를 전송. searchParams 훅은 정적 렌더를 깨뜨릴 수
 * 있어 쓰지 않고(usePathname 만 사용 — Suspense 불필요), 쿼리는 effect 안에서
 * window.location.search 로 읽는다.
 */
export function GaPageView() {
  const pathname = usePathname();
  useEffect(() => {
    sendSanitizedPageView(pathname);
  }, [pathname]);
  return null;
}
