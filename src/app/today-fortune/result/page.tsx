import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneResultClient } from '@/features/today-fortune/today-fortune-result-client';
import { guardLockedFreeEntry } from '@/lib/paywall-lockdown.server';
import { guardMenuPassEntry } from '@/lib/payments/menu-pass.server';
import { AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '오늘운세 결과',
  description: '오늘운세 무료 결과를 한 화면에서 확인하고 필요한 부분만 이어서 볼 수 있습니다.',
  alternates: { canonical: '/today-fortune/result' },
  // 개인 결과 화면 — meta noindex(공유 스냅샷과 동일 정책).
  robots: { index: false, follow: false },
};

export default async function TodayFortuneResultPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceSessionId?: string; concern?: string; paid?: string }>;
}) {
  const { sourceSessionId, concern, paid } = await searchParams;

  if (paid === 'today-detail' && sourceSessionId) {
    const params = new URLSearchParams({
      sourceSessionId,
      concern: concern || 'general',
      paid,
    });
    redirect(`/today-fortune/detail?${params.toString()}`);
  }

  // 전면 유료화 잠금 — 무료 요약 결과 차단(결제 이력 있으면 통과).
  //   ⚠️ 위 `paid=today-detail` 복귀 리다이렉트 **뒤**에 있어야 한다.
  await guardLockedFreeEntry();
  // 2026-08-25 — 990원 당일권(간단운세). 복귀 좌표(sourceSessionId·concern)를 실어
  //   결제 후 이 결과 화면으로 곧장 돌아온다(입력창 재진입 제보 수정).
  await guardMenuPassEntry('today', 'today-fortune-result', {
    slug: sourceSessionId ?? null,
    scope: concern ?? null,
  });

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneResultClient
        sourceSessionId={sourceSessionId}
        concern={concern}
      />
    </AppShell>
  );
}
