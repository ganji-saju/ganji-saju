export const SITE_NAME = '달빛인생';
export const DEFAULT_DESCRIPTION =
  '오늘의 운세와 타로부터 사주, 궁합, 띠운세까지 가볍게 확인하는 모바일 운세 서비스 달빛인생입니다.';
export const DEFAULT_OG_IMAGE = '/og-image.png';
export const CANONICAL_SITE_URL = 'https://xn--s39at50bo6fmwa.kr';

const FALLBACK_SITE_URL = CANONICAL_SITE_URL;
const LEGACY_SITE_HOSTS = new Set([
  'ganji-saju.vercel.app',
  'ganji-saju-ganji-sajus-projects.vercel.app',
  'ganji-saju-ganji-saju-vercel.app',
  'ganjisaju.kr',
  'www.ganjisaju.kr',
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
