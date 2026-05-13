export const SITE_NAME = '달빛인생';
export const DEFAULT_DESCRIPTION =
  '오늘의 운세와 타로부터 사주, 궁합, 띠운세까지 가볍게 확인하는 모바일 운세 서비스 달빛인생입니다.';
// P1-4 fix (audit 2026-05-13): 기존 `/og-image.png` 는 public 에 부재 — 운영 hero 이미지로
// 임시 대체. 디자이너가 1200x630 전용 OG 이미지를 만들면 이 상수만 교체하면 됨.
export const DEFAULT_OG_IMAGE = '/images/moonlight-teacher-hero-poster.jpg';
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const CANONICAL_SITE_URL = 'https://xn--s39at50bo6fmwa.kr';

/**
 * P1-4 fix (audit 2026-05-13): 페이지별 og:title / og:description 미적용 문제.
 * 각 page.tsx 에서 openGraph 를 매번 직접 쓰는 부담을 줄이기 위해 단일 헬퍼를 제공한다.
 * Next.js metadata 상속에서 페이지의 openGraph 는 layout 의 openGraph 를 replace
 * (merge X) 하므로 images / locale / siteName 등 공통 필드는 매번 포함되어야 한다.
 */
export function buildOpenGraph(input: {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
}) {
  return {
    type: input.type ?? ('website' as const),
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title: input.title,
    description: input.description,
    url: input.path ?? '/',
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: DEFAULT_OG_IMAGE_WIDTH,
        height: DEFAULT_OG_IMAGE_HEIGHT,
        alt: SITE_NAME,
      },
    ],
  };
}

/** Twitter card 도 페이지별로 동일 패턴 (replace 규칙). */
export function buildTwitter(input: { title: string; description: string }) {
  return {
    card: 'summary_large_image' as const,
    title: input.title,
    description: input.description,
    images: [DEFAULT_OG_IMAGE],
  };
}

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
