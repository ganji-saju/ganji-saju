import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TodayFortuneDetailClient } from '@/features/today-fortune/today-fortune-detail-client';
import { createClient } from '@/lib/supabase/server';
import { getTodayFortuneResultSnapshotById } from '@/lib/today-fortune/result-snapshots';
import { AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '보관된 오늘운세 다시보기',
  description: '결제하거나 전으로 열었던 오늘운세 상세 풀이를 보관함에서 다시 확인합니다.',
  robots: {
    index: false,
    follow: false,
  },
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TodayFortuneSnapshotPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/today-fortune/snapshots/${id}`)}`);
  }

  const snapshot = await getTodayFortuneResultSnapshotById(user.id, id);
  if (!snapshot) notFound();

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <TodayFortuneDetailClient
        sourceSessionId={snapshot.sourceSessionId ?? snapshot.sourceSlug ?? undefined}
        concern={snapshot.concernId}
        paidProduct="today-detail"
        backHref="/my/results"
        initialFreeResult={snapshot.freeResult}
        initialResult={snapshot.premiumResult}
        initialNotice={`${snapshot.occurredOn}에 보관된 오늘 자세히 보기입니다.`}
      />
    </AppShell>
  );
}
