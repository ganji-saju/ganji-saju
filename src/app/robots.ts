import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/credits', '/today-fortune', '/tarot/daily', '/zodiac', '/zodiac/', '/star-sign', '/star-sign/', '/dream-interpretation', '/dream-interpretation/'],
        // 2026-05-15 PR-H/L: SHELL 라우트 lock-screen 만 노출 제외. onboarding 은 PR-L 에서 first-visit redirect 활성화 되어 검색 인입 허용.
        disallow: ['/api/', '/login', '/credits/success', '/saju/', '/my', '/admin', '/lock-screen'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
