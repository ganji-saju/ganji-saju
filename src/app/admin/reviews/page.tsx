// 2026-05-18 Phase 7b — admin moderation 페이지. pending / approved / rejected 필터 + approve/reject.
import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/admin-page';
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
    <AdminPage title="후기 검수">
      <ReviewsModerationClient initialStatus={initialStatus} />
    </AdminPage>
  );
}
