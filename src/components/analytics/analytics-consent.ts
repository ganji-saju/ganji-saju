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
}
