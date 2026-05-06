import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneResultClient } from '@/features/today-fortune/today-fortune-result-client';
import { AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '오늘운세 결과',
  description: '오늘운세 무료 결과를 한 화면에서 확인하고 필요한 부분만 이어서 볼 수 있습니다.',
  alternates: { canonical: '/today-fortune/result' },
};

export default async function TodayFortuneResultPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceSessionId?: string; concern?: string; paid?: string }>;
}) {
  const { sourceSessionId, concern, paid } = await searchParams;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneResultClient
        sourceSessionId={sourceSessionId}
        concern={concern}
        paidProduct={paid}
      />
    </AppShell>
  );
}
