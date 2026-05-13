import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/credits', '/today-fortune', '/tarot/daily', '/zodiac', '/zodiac/', '/star-sign', '/star-sign/', '/dream-interpretation', '/dream-interpretation/'],
        disallow: ['/api/', '/login', '/credits/success', '/saju/', '/my'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
