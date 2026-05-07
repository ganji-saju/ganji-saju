import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneExperience } from '@/features/today-fortune/today-fortune-experience';
import { AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '오늘의 운세',
  description: '오늘 연락, 돈, 미팅, 관계, 컨디션 가운데 가장 걸리는 고민을 먼저 고르고 무료 결과를 바로 확인하세요.',
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

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneExperience initialConcernId={concern} />
    </AppShell>
  );
}
