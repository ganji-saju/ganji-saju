import type { MetadataRoute } from 'next';
import { DREAM_ENTRIES, STAR_SIGN_FORTUNES, ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { ENGINE_METHOD_ENTRIES } from '@/lib/engine-method-pages';
import { CANONICAL_SITE_URL } from '@/lib/site';

/**
 * Phase 1 (2026-05-18): sitemap URL 은 항상 canonical 도메인 (`https://ganjisaju.kr`).
 * env (NEXT_PUBLIC_SITE_URL) 잘못 설정돼도 sitemap 은 정합 유지.
 *
 * lastmod 동결 (빌드 시점) 은 Phase 10 (SEO 확장) 에서 KST 동적화 예정.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = CANONICAL_SITE_URL;
  const now = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/credits`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/today-fortune`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/saju/new`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${siteUrl}/tarot/daily`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85,
    },
    {
      url: `${siteUrl}/zodiac`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/star-sign`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/dream-interpretation`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/membership`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${siteUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.68,
    },
    {
      url: `${siteUrl}/sample-report`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.72,
    },
    {
      url: `${siteUrl}/guide`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.74,
    },
    {
      url: `${siteUrl}/about-engine`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.76,
    },
    {
      url: `${siteUrl}/method`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.74,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    ...ZODIAC_FORTUNES.map((item) => ({
      url: `${siteUrl}/zodiac/${item.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.72,
    })),
    ...STAR_SIGN_FORTUNES.map((item) => ({
      url: `${siteUrl}/star-sign/${item.slug}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.72,
    })),
    ...DREAM_ENTRIES.map((item) => ({
      url: `${siteUrl}/dream-interpretation/${item.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...ENGINE_METHOD_ENTRIES.map((item) => ({
      url: `${siteUrl}/method/${item.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.72,
    })),
  ];
}
