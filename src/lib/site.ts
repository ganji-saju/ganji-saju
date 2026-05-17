/**
 * 사이트 전역 설정 — Phase 1 (도메인 canonical 통일).
 *
 * canonical: `https://ganjisaju.kr` (영문 ASCII)
 * legacy (301 대상): 간지사주.kr (xn-- punycode), www.ganjisaju.kr, Vercel preview 자동 도메인
 *
 * 변경 이력:
 * 2026-05-18 — Phase 1: canonical = ganjisaju.kr 로 반전 (이전: xn--s39at50bo6fmwa.kr)
 *               브랜드명 = 간지사주 로 통일 (이전: 달빛인생)
 *               LEGACY 목록에 punycode 호스트 + www.ganjisaju.kr 추가
 *               SITE_CONFIG export + getCanonicalUrl helper 신설
 */

export const SITE_CONFIG = {
  canonicalHost: 'ganjisaju.kr',
  canonicalOrigin: 'https://ganjisaju.kr',
  serviceName: '간지사주',
  defaultLocale: 'ko-KR',
  timezone: 'Asia/Seoul',
} as const;

export const SITE_NAME = SITE_CONFIG.serviceName;
export const DEFAULT_DESCRIPTION =
  '오늘의 운세와 타로부터 사주, 궁합, 띠운세까지 가볍게 확인하는 모바일 운세 서비스 간지사주입니다.';
export const DEFAULT_OG_IMAGE = '/og-image.png';
export const CANONICAL_SITE_URL = SITE_CONFIG.canonicalOrigin;

const FALLBACK_SITE_URL = CANONICAL_SITE_URL;

// 301 redirect 대상 (= canonical 아님). production 환경에서 proxy.ts 가 이 목록 + Vercel 자동 도메인을 canonical 로 308 redirect.
const LEGACY_SITE_HOSTS = new Set([
  // 한글 도메인 punycode (간지사주.kr) — UTF-8 직접 입력 시 브라우저가 자동 변환
  'xn--s39at50bo6fmwa.kr',
  'www.xn--s39at50bo6fmwa.kr',
  // www → non-www 통일
  'www.ganjisaju.kr',
  // Vercel 자동 / legacy 도메인 (운영 도메인 등록 전 사용했던 alias)
  'ganji-saju.vercel.app',
  'ganji-saju-ganji-sajus-projects.vercel.app',
  'ganji-saju-ganji-saju.vercel.app',
]);

function isVercelAutoDomain(url: URL) {
  return url.hostname.endsWith('.vercel.app');
}

function isLegacySiteDomain(url: URL) {
  return LEGACY_SITE_HOSTS.has(url.hostname);
}

function normalizeSiteUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.hostname.endsWith('.supabase.co')) return null;
    if (isLegacySiteDomain(url)) return null;
    if (isVercelAutoDomain(url)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getSiteUrl(): string {
  return (
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeSiteUrl(process.env.VERCEL_URL) ??
    FALLBACK_SITE_URL
  );
}

/**
 * 페이지 절대 URL — `<link rel="canonical">`, `og:url`, sitemap, JSON-LD 등에 사용.
 *
 * @param path 절대 경로 (예: `/today-fortune`, `/saju/abc/overview`)
 *             선두 `/` 없으면 자동 prefix.
 *             query / hash 포함 그대로 보존.
 */
export function getCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${CANONICAL_SITE_URL}${cleanPath}`;
}

/**
 * 호스트가 canonical 인지 판정 (proxy.ts redirect 판단용).
 */
export function isCanonicalHost(hostname: string): boolean {
  return hostname === SITE_CONFIG.canonicalHost;
}

/**
 * 호스트가 LEGACY (301 redirect 대상) 인지 판정.
 * Vercel 자동 도메인 (*.vercel.app) 도 포함.
 */
export function shouldRedirectHost(hostname: string): boolean {
  if (isCanonicalHost(hostname)) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (hostname.endsWith('.vercel.app')) return true;
  return LEGACY_SITE_HOSTS.has(hostname);
}
