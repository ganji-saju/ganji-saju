import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { ExternalReportClient } from './external-report-client';

export const metadata: Metadata = {
  title: '외부 주문 PDF 생성 (admin)',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ExternalReportPage() {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');

  return (
    <AdminPage
      title="외부 주문 PDF 생성"
      description="스마트스토어 등 외부 구매자의 깊은 사주풀이를 생성하고 PDF로 저장합니다."
      className="external-report-workspace"
    >
      <ExternalReportClient />
    </AdminPage>
  );
}
