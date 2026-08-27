// 2026-07-06 — 자체 동의(Consent Mode v2) 공유 로직.
//   layout 의 인라인 스크립트(기본 denied + 재방문 복원)와 배너가 같은 키를 쓴다.
//   GA4/GTM 는 이 consent 상태를 존중한다: denied 면 쿠키·식별자 없이 익명 모델링,
//   granted 면 전량 수집. (개인정보 정제 page_view 는 별도로 항상 적용됨 — ga-sanitize.)

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

export const ANALYTICS_CONSENT_KEY = 'ganji:analytics-consent:v1';

// 저장된 선택을 이미 한 사용자가 나중에 변경(철회 포함)할 수 있도록, 푸터 '쿠키 설정'이
//   이 이벤트를 쏘면 배너가 다시 뜬다. PIPA: 동의 철회는 동의만큼 쉬워야 한다.
export const CONSENT_REOPEN_EVENT = 'ganji:analytics-consent-reopen';

/**
 * 2026-08-26 — 동의가 'granted' 로 승격된 순간. GaPageView 가 이걸 듣고 최초 랜딩 URL 의
 * UTM 을 실은 page_view 를 다시 보낸다.
 *
 * 왜: 기본이 denied 라 첫 page_view 는 저장소 없이 나간다. 그 시점의 캠페인은 어디에도
 * 남지 않는다. '동의' 를 누르면 그때 쿠키가 생기며 세션이 시작되는데, 같은 라우트라 새
 * page_view 가 발사되지 않아 **캠페인이 유실되고 (direct) 로 잡힌다.**
 */
export const CONSENT_GRANTED_EVENT = 'ganji:analytics-consent-granted';

export type ConsentChoice = 'granted' | 'denied';

/** 저장된 선택과 무관하게 동의 배너를 다시 노출(재선택·철회용). */
export function openConsentBanner(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT));
}

/** 저장된 선택 읽기. 미선택(배너 노출 대상)이면 null. */
export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** 선택을 저장하고 Consent Mode 를 즉시 갱신. */
export function applyConsent(choice: ConsentChoice): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, choice);
  } catch {
    // localStorage 차단(시크릿/설정)이어도 consent 갱신은 진행 — 세션 한정 적용.
  }
  if (typeof window.gtag === 'function') {
    const v = choice; // 'granted' | 'denied'
    window.gtag('consent', 'update', {
      ad_storage: v,
      ad_user_data: v,
      ad_personalization: v,
      analytics_storage: v,
    });
  }
  if (choice === 'granted') {
    // consent update 가 gtag 큐에 반영된 뒤 재발사되도록 이벤트로 넘긴다.
    window.dispatchEvent(new Event(CONSENT_GRANTED_EVENT));
  }
}
