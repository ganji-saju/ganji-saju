import type { Metadata } from 'next';
import { MyStarSignCard } from '@/components/star-sign/my-star-sign-card';
import { GangiHomeClient } from '@/features/home/gangi-home-client';
// Task 8 — 카카오 친구추가 무료쿠폰 CTA(메인 배너 진입점). slug 없이 렌더 —
// 휴면(KAKAO_FRIEND_COUPON_ENABLED off)이면 컴포넌트 자체가 아무것도 렌더하지 않는다.
import { KakaoFriendCouponCta } from '@/features/coupons/kakao-friend-coupon-cta';
import { isPaywallLockdown } from '@/lib/paywall-lockdown';
import { getOptionalSignedInProfile } from '@/lib/profile';
import { getHomeBanners } from '@/server/home/home-banners';

export const dynamic = 'force-dynamic';

// 2026-07-04 SEO — 홈이 루트 layout 기본 title('간지사주' 단독)만 노출하던 문제.
// 핵심 검색 키워드(오늘의 운세·사주풀이·궁합·꿈해몽·타로)를 홈 title/description 에 반영.
// 2026-08-11 — 잠금 중엔 '무료 타로/무료로 시작'이 사실이 아니다(표시 내용과 실제 불일치).
export const metadata: Metadata = isPaywallLockdown()
  ? {
      title: { absolute: '간지사주 — 사주풀이 · 오늘의 운세 · 궁합 · 대운 · 택일' },
      description:
        '생년월일로 보는 내 사주풀이와 오늘의 운세, 두 사람의 궁합, 10년 대운과 택일까지. 명리 기반 해석을 바로 확인하세요.',
      alternates: { canonical: '/' },
    }
  : {
      title: { absolute: '간지사주 — 오늘의 운세 · 사주풀이 · 궁합 · 꿈해몽 · 무료 타로' },
      description:
        '생년월일로 보는 내 사주풀이와 오늘의 운세, 두 사람의 궁합, 꿈해몽 사전, 무료 타로 3장까지. 명리 기반 해석을 매일 무료로 시작하세요.',
      alternates: { canonical: '/' },
    };

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
  // 잠금 중에는 /star-sign/[slug] 가 막혀 있어 카드가 /pricing 으로만 튕긴다 → 아예 숨김.
  const myStarSignSlot =
    profile && !isPaywallLockdown() ? <MyStarSignCard profile={profile} /> : null;

  return (
    <GangiHomeClient
      initialBanners={banners}
      myStarSignSlot={myStarSignSlot}
      couponCtaSlot={<KakaoFriendCouponCta />}
    />
  );
}
