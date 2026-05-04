export const SITE_NAME = '달빛인생';
export const DEFAULT_DESCRIPTION =
  '오늘의 운세와 타로부터 사주, 궁합, 띠운세까지 가볍게 확인하는 모바일 운세 서비스 달빛인생입니다.';
export const DEFAULT_OG_IMAGE = '/og-image.png';

const FALLBACK_SITE_URL = 'https://ganji-saju.vercel.app';

function isVercelAutoDomain(url: URL) {
  return url.hostname.endsWith('.vercel.app') && url.origin !== FALLBACK_SITE_URL;
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
