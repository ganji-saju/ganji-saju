import { MyStarSignCard } from '@/components/star-sign/my-star-sign-card';
import { GangiHomeClient } from '@/features/home/gangi-home-client';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { getHomeBanners } from '@/server/home/home-banners';

export const dynamic = 'force-dynamic';

// 2026-05-24 — 첫 방문 강제 온보딩 redirect 제거(분리). 매 첫 방문마다 4슬라이드
//   인트로 carousel 로 보내 사이트 진입을 가로막아 불편하다는 사용자 피드백.
//   온보딩은 필수 데이터 수집이 아닌 소개라 제거해도 기능 영향 없음.
//   /onboarding 라우트·컴포넌트는 그대로 유지 — 직접 접근/추후 재도입 가능.

export default async function HomePage() {
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
