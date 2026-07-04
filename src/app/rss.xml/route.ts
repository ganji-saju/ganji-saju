// 2026-07-05 SEO — /rss.xml RSS 2.0 피드. 네이버 서치어드바이저 RSS 제출용.
//   콘텐츠: 꿈해몽(95) + 띠운세(12) + 별자리(12). sitemap 과 보완 관계.
//   revalidate 로 캐시(콘텐츠는 정적이라 자주 안 바뀜).
import { DREAM_ENTRIES, STAR_SIGN_FORTUNES, ZODIAC_FORTUNES } from '@/lib/free-content-pages';
import { buildRssFeed, type RssItem } from '@/lib/seo/rss-feed';

export const revalidate = 86_400; // 1일

export function GET(): Response {
  const items: RssItem[] = [
    ...DREAM_ENTRIES.map((d) => ({
      path: `/dream-interpretation/${d.slug}`,
      title: `${d.title} — 꿈해몽`,
      description: d.summary,
    })),
    ...ZODIAC_FORTUNES.map((z) => ({
      path: `/zodiac/${z.slug}`,
      title: `${z.label} 오늘의 운세`,
      description: z.summary,
    })),
    ...STAR_SIGN_FORTUNES.map((s) => ({
      path: `/star-sign/${s.slug}`,
      title: `${s.label} 오늘의 별자리 운세`,
      description: s.summary,
    })),
  ];

  // buildDate 는 라우트에서 주입(빌더는 순수 유지). revalidate 캐시 경계와 일치.
  const xml = buildRssFeed({ items, buildDate: new Date().toUTCString() });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
