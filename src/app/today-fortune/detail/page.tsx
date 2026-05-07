import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneDetailClient } from '@/features/today-fortune/today-fortune-detail-client';
import { AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '오늘 자세히 보기',
  description: '구매하거나 코인으로 연 오늘 상세 풀이를 별도 화면에서 확인합니다.',
  alternates: { canonical: '/today-fortune/detail' },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TodayFortuneDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceSessionId?: string; concern?: string; paid?: string }>;
}) {
  const { sourceSessionId, concern, paid } = await searchParams;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneDetailClient
        sourceSessionId={sourceSessionId}
        concern={concern}
        paidProduct={paid}
      />
    </AppShell>
  );
}
