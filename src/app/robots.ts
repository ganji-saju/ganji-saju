import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  // P1-3 fix (audit 2026-05-13): `/saju/new` 는 결제 전환의 핵심 입구이므로
  // Allow 를 disallow 앞에 명시한다. 개별 풀이 결과(`/saju/<slug>`)는 계속 비공개.
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/credits',
          '/today-fortune',
          '/tarot/daily',
          '/zodiac',
          '/zodiac/',
          '/star-sign',
          '/star-sign/',
          '/dream-interpretation',
          '/dream-interpretation/',
          '/saju/new',
          '/saju/new/',
        ],
        disallow: ['/api/', '/login', '/credits/success', '/saju/', '/my'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
