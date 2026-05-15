import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MyStarSignCard } from '@/components/star-sign/my-star-sign-card';
import { GangiHomeClient } from '@/features/home/gangi-home-client';
import { getOptionalSignedInProfile } from '@/lib/profile';
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

  // 2026-05-16 PR #132 — 프로필 있으면 MY 별자리 카드를 home 에 server-render 하여
  // GangiHomeClient (client) 에 slot 으로 전달. (profile 자체를 client 로 보내면
  // profile-personalization.ts → profile.ts → supabase/server.ts 트리거됨.)
  const [banners, profile] = await Promise.all([
    getHomeBanners(),
    getOptionalSignedInProfile(),
  ]);
  const myStarSignSlot = profile ? <MyStarSignCard profile={profile} /> : null;

  return (
    <GangiHomeClient
      initialBanners={banners}
      myStarSignSlot={myStarSignSlot}
    />
  );
}
