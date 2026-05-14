import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GangiHomeClient } from '@/features/home/gangi-home-client';
import { getHomeBanners } from '@/server/home/home-banners';

export const dynamic = 'force-dynamic';

// 2026-05-15 PR-L: 첫 방문자 자동 onboarding redirect.
// `moonlight:onboarded` cookie 가 없으면 `/onboarding` 으로 1회 redirect.
// onboarding 페이지에서 "사주 입력하고 시작" 또는 "나중에" 클릭 시 cookie set.
const ONBOARD_COOKIE = 'moonlight:onboarded';

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasOnboarded = cookieStore.get(ONBOARD_COOKIE)?.value === '1';
  if (!hasOnboarded) {
    redirect('/onboarding');
  }

  const banners = await getHomeBanners();

  return <GangiHomeClient initialBanners={banners} />;
}
