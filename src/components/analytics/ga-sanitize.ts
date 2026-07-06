// 2026-07-06 — GA4 page_view 개인정보 정제(순수 함수, React/next 의존 없음 → 단위 테스트 가능).
//   이 앱의 사주/공유 URL 은 경로·쿼리에 생년월일·시간·성별·이름을 담는다(toSlug / a·b·n·d·c).
//   GA 로 URL 을 보낼 때 이 값들을 제거한다.

// 유입 분석에 필요한 비(非)민감 쿼리만 통과. 나머지(a·b·n·d·c 등 이름·생일)는 제거.
const SAFE_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
]);

// 생년월일 슬러그 형태 감지: "YYYY-M-D..." 날짜 또는 "key<hash>" 토큰(둘 다 toSlug 산출물).
//   /saju/1988-3-12-9-female-key.. · /compatibility/share/rel--slug--slug ·
//   /today-fortune/share/<slug> 등 민감 세그먼트를 redacted 로 치환.
const BIRTH_DATE_SEGMENT = /\d{4}-\d{1,2}-\d{1,2}/;
const KEY_TOKEN_SEGMENT = /key[a-z0-9]{4,}/i;

/** 경로에서 생년월일/키해시가 든 세그먼트를 redacted 로 치환. 콘텐츠 슬러그(꿈·별자리 등)는 보존. */
export function sanitizePath(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) =>
      seg && (BIRTH_DATE_SEGMENT.test(seg) || KEY_TOKEN_SEGMENT.test(seg)) ? 'redacted' : seg
    )
    .join('/');
}

/** 화이트리스트(utm 등)만 남기고 나머지 쿼리(이름·생일 등) 제거. 빈 결과면 ''. */
export function sanitizeQuery(search: string): string {
  if (!search || search === '?') return '';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const safe = new URLSearchParams();
  for (const [key, value] of params) {
    if (SAFE_QUERY_KEYS.has(key)) safe.set(key, value);
  }
  const out = safe.toString();
  return out ? `?${out}` : '';
}
