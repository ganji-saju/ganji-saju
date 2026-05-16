// 2026-05-16 — 첫 방문자 온보딩.
// 이전: 시작 가이드 (vertical 4 카드 list, AppShell + GangiPageHeader).
// 변경 (사용자 mockup `26 _ _ _4 _.html`): 풀스크린 carousel · 12간지 wheel hero ·
//   건너뛰기/다음 controls · pagination dots. 라우팅·쿠키 정책은 그대로.
import type { Metadata } from 'next';
import { finishOnboardingAndStart, skipOnboarding } from './actions';
import { OnboardingCarousel } from './onboarding-carousel';

export const metadata: Metadata = {
  title: '간지사주 온보딩',
  description:
    '간지사주 첫 사용자를 위한 4 슬라이드 온보딩 — 달빛 운세 / 오늘 흐름 / 대화 / 시작하기.',
  alternates: { canonical: '/onboarding' },
};

export default function OnboardingShellPage() {
  return (
    <OnboardingCarousel
      finishAction={finishOnboardingAndStart}
      skipAction={skipOnboarding}
    />
  );
}
