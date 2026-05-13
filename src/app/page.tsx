import type { Metadata } from 'next';
import { GangiHomeClient } from '@/features/home/gangi-home-client';
import { getHomeBanners } from '@/server/home/home-banners';
import { DEFAULT_DESCRIPTION, SITE_NAME, buildOpenGraph, buildTwitter } from '@/lib/site';

export const dynamic = 'force-dynamic';

// P1-5 fix (audit 2026-05-13): 홈 canonical 누락 보강.
// P1-4 fix (audit 2026-05-13): 홈도 페이지별 openGraph/Twitter 명시 (layout 의 default 를 replace).
const HOME_TITLE = `${SITE_NAME} — 무료 사주·타로·오늘운세·궁합·띠운세`;
const HOME_DESC = DEFAULT_DESCRIPTION;

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESC,
  alternates: { canonical: '/' },
  openGraph: buildOpenGraph({ title: HOME_TITLE, description: HOME_DESC, path: '/' }),
  twitter: buildTwitter({ title: HOME_TITLE, description: HOME_DESC }),
};

export default async function HomePage() {
  const banners = await getHomeBanners();

  return <GangiHomeClient initialBanners={banners} />;
}
