// 2026-05-18 Phase 7b — admin moderation 페이지. pending / approved / rejected 필터 + approve/reject.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { ReviewsModerationClient } from './reviews-moderation-client';

export const metadata: Metadata = {
  title: '후기 검수 (admin)',
  description: '후기 moderation queue — 승인 / 비공개 처리.',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ReviewsAdminPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const initialStatus =
    sp.status === 'approved' || sp.status === 'rejected' || sp.status === 'all'
      ? sp.status
      : 'pending';
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="후기 검수 (admin)" backHref="/admin/operations" />
        <ReviewsModerationClient initialStatus={initialStatus} />
      </AppPage>
    </AppShell>
  );
}
