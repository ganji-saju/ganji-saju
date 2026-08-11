import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneExperience } from '@/features/today-fortune/today-fortune-experience';
import { isPaywallLockdown } from '@/lib/paywall-lockdown';
import { guardLockedFreeEntry } from '@/lib/paywall-lockdown.server';
import { AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '오늘의 운세',
  description: isPaywallLockdown()
    ? '오늘 연락, 돈, 미팅, 관계, 컨디션 가운데 가장 걸리는 고민을 먼저 고르고 오늘 흐름을 확인하세요.'
    : '오늘 연락, 돈, 미팅, 관계, 컨디션 가운데 가장 걸리는 고민을 먼저 고르고 무료 결과를 바로 확인하세요.',
  alternates: { canonical: '/today-fortune' },
};

export default async function TodayFortunePage({
  searchParams,
}: {
  searchParams: Promise<{ concern?: string; paid?: string; sourceSessionId?: string }>;
}) {
  const { concern, paid, sourceSessionId } = await searchParams;

  if (paid === 'today-detail' && sourceSessionId) {
    const params = new URLSearchParams({
      sourceSessionId,
      concern: concern || 'general',
      paid,
    });
    redirect(`/today-fortune/detail?${params.toString()}`);
  }

  // 전면 유료화 잠금 — 무료 요약 진입 차단(결제 이력 있으면 통과).
  //   ⚠️ 위 `paid=today-detail` 복귀 리다이렉트 **뒤**에 있어야 한다.
  await guardLockedFreeEntry();

  return (
    <AppShell header={<SiteHeader />} footer={false} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneExperience initialConcernId={concern} />
    </AppShell>
  );
}
