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
import { captureLandingCampaign, readLandingCampaign } from './landing-campaign';
import { CONSENT_GRANTED_EVENT } from './analytics-consent';

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

function sendSanitizedPageView(pathname: string, options: { forceCampaign?: boolean } = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  // 2026-08-26 — 동의 승격 재발사에서는 **최초 랜딩의 캠페인**을 다시 실어 보낸다.
  //   현재 URL 에 UTM 이 없어도(내부 이동 뒤 동의) 캠페인이 유실되지 않게.
  const search = options.forceCampaign
    ? readLandingCampaign() || window.location.search
    : window.location.search;
  const path = sanitizePath(pathname) + sanitizeQuery(search);
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
    // 랜딩 캠페인 보관 — 동의 승격 재발사와 결제 시작 시점에 쓴다(체크아웃 URL 엔 UTM 이 없다).
    captureLandingCampaign(window.location.search);
    sendSanitizedPageView(pathname);
  }, [pathname]);

  // 2026-08-26 — 🔴 캠페인 유실 수정. Consent Mode 기본이 denied 라 첫 page_view 는 저장소
  //   없이 나가고 그 시점 캠페인은 남지 않는다. 사용자가 '동의' 를 누르면 그때 쿠키가 생기며
  //   세션이 시작되는데, 새 page_view 가 없으면 GA4 는 그 세션을 **(direct) 로 처리**한다 —
  //   UTM 을 붙여 들어와도 (direct) 로 찍히던 실제 증상이 이것이다.
  //   동의 직후 랜딩 캠페인을 실은 page_view 를 한 번 더 보내 세션에 출처를 각인한다.
  useEffect(() => {
    const onGranted = () => sendSanitizedPageView(pathname, { forceCampaign: true });
    window.addEventListener(CONSENT_GRANTED_EVENT, onGranted);
    return () => window.removeEventListener(CONSENT_GRANTED_EVENT, onGranted);
  }, [pathname]);

  return null;
}
