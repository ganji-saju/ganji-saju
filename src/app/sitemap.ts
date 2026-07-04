import type { MetadataRoute } from 'next';
import { DREAM_ENTRIES, STAR_SIGN_FORTUNES, ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { CANONICAL_SITE_URL } from '@/lib/site';

/**
 * Phase 1 (2026-05-18): sitemap URL 은 항상 canonical 도메인 (`https://ganjisaju.kr`).
 * env (NEXT_PUBLIC_SITE_URL) 잘못 설정돼도 sitemap 은 정합 유지.
 *
 * 2026-07-04 SEO 전수감사 반영:
 *   - 리다이렉트 스텁 제거: /guide·/about-engine·/method(→/interpretation),
 *     /method/[slug](→/interpretation), /dream-interpretation 허브(→/dream).
 *     ⚠️ 리다이렉트 URL 을 sitemap 에 넣으면 GSC 오류 — 실서빙 URL 만 제출.
 *   - 폐지 제거: /credits (코인 sunset 후 개인 잔액 페이지 — robots disallow 로 이동).
 *   - Phase 1 이후 신규 공개 라우트 추가: /interpretation, /dream, /daewoon, /taekil,
 *     /free, /compatibility(+input), /myeongri(+ten-gods), /support/faq, /dialogue,
 *     /star-sign/compat(+12×12 조합 — [a]/[b] 페이지는 유효 slug 면 자기쌍도 서빙).
 *
 * lastmod 동결 (빌드 시점) 은 Phase 10 (SEO 확장) 에서 KST 동적화 예정.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = CANONICAL_SITE_URL;
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/today-fortune`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/saju/new`, lastModified: now, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${siteUrl}/tarot/daily`, lastModified: now, changeFrequency: 'daily', priority: 0.85 },
    { url: `${siteUrl}/compatibility`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${siteUrl}/compatibility/input`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/daewoon`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/taekil`, lastModified: now, changeFrequency: 'weekly', priority: 0.78 },
    { url: `${siteUrl}/dream`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/free`, lastModified: now, changeFrequency: 'daily', priority: 0.78 },
    { url: `${siteUrl}/zodiac`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/star-sign`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/star-sign/compat`, lastModified: now, changeFrequency: 'weekly', priority: 0.72 },
    { url: `${siteUrl}/interpretation`, lastModified: now, changeFrequency: 'monthly', priority: 0.74 },
    { url: `${siteUrl}/myeongri`, lastModified: now, changeFrequency: 'monthly', priority: 0.72 },
    { url: `${siteUrl}/dialogue`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${siteUrl}/support/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/membership`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.68 },
    { url: `${siteUrl}/sample-report`, lastModified: now, changeFrequency: 'monthly', priority: 0.72 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ];

  return [
    ...staticEntries,
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
    // 별자리 궁합 12×12 조합 — [a]/[b] 페이지는 유효 slug 조합(자기쌍 포함) 전부 서빙.
    ...STAR_SIGN_FORTUNES.flatMap((a) =>
      STAR_SIGN_FORTUNES.map((b) => ({
        url: `${siteUrl}/star-sign/compat/${a.slug}/${b.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    ),
    ...DREAM_ENTRIES.map((item) => ({
      url: `${siteUrl}/dream-interpretation/${item.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
