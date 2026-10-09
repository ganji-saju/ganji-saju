// 로그인 후 돌아갈 곳 — 올해운 노트 흐름(/partner/…) 안으로만. 브라우저가 정규화한 경로로 판정한다('/partner/../admin' → '/admin').
const FALLBACK = '/partner/start';

export function safePartnerNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return FALLBACK;
  try {
    const url = new URL(raw, 'https://ganjisaju.kr');
    if (url.origin !== 'https://ganjisaju.kr' || !url.pathname.startsWith('/partner/')) return FALLBACK;
    return `${url.pathname}${url.search}`;
  } catch {
    return FALLBACK;
  }
}
