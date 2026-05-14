import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/credits', '/today-fortune', '/tarot/daily', '/zodiac', '/zodiac/', '/star-sign', '/star-sign/', '/dream-interpretation', '/dream-interpretation/'],
        // 2026-05-15 PR-H: SHELL 라우트(lock-screen, onboarding) 도 노출 제외 (준비 중).
        disallow: ['/api/', '/login', '/credits/success', '/saju/', '/my', '/admin', '/lock-screen', '/onboarding'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
