import { GangiHomeClient } from '@/features/home/gangi-home-client';
import { getHomeBanners } from '@/server/home/home-banners';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const banners = await getHomeBanners();

  return <GangiHomeClient initialBanners={banners} />;
}
