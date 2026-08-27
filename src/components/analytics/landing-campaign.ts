// 2026-08-26 — 최초 랜딩 URL 의 캠페인 파라미터를 세션 동안 보관.
//
//   두 곳에서 필요하다:
//   ① 동의 승격 시 page_view 재발사 — 기본 denied 라 첫 page_view 는 저장소 없이 나가고
//      그 시점의 캠페인은 어디에도 안 남는다. '동의' 를 누른 순간 쿠키가 생기며 세션이
//      시작되는데, 그때 URL 에 UTM 이 없으면 **캠페인이 유실되고 (direct) 로 잡힌다.**
//   ② 결제 시작 시점 — 체크아웃 URL 에는 이미 UTM 이 없다(계측 설계 문서 §07).
//
//   ⚠️ sessionStorage 를 쓴다. localStorage 면 몇 달 전 캠페인이 오늘 유입에 붙는다.

const KEY = 'ganji:landing-campaign:v1';

/** GA4 가 page_location 에서 파싱하는 캠페인 파라미터. */
const CAMPAIGN_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
] as const;

/** 검색 문자열에서 캠페인 파라미터만 추린다. 없으면 ''. */
export function extractCampaignQuery(search: string): string {
  if (!search || search === '?') return '';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const out = new URLSearchParams();
  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key);
    if (value) out.set(key, value);
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

/**
 * 현재 URL 에 캠페인이 있으면 저장. 이미 저장된 값이 있으면 **덮어쓰지 않는다** —
 * 세션의 유입 출처는 처음 들어온 그 링크다(내부 이동 중 붙은 파라미터가 이기면 안 된다).
 */
export function captureLandingCampaign(search: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;
    const q = extractCampaignQuery(search);
    if (q) window.sessionStorage.setItem(KEY, q);
    return q;
  } catch {
    return extractCampaignQuery(search);
  }
}

export function readLandingCampaign(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}
