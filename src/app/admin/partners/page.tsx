// 인플루언서(파트너) 등록·실적·수수료 — super_admin. 데이터는 /api/admin/partners.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { PartnersAdminClient } from './partners-admin-client';

export const metadata: Metadata = {
  title: '인플루언서 (admin)',
  description: '인플루언서 등록과 방문·판매·환불·수수료 현황.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PartnersAdminPage() {
  const guard = await getCurrentAdminRole(await createClient());
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');
  return (
    <AdminPage title="인플루언서" description="등록·실적·수수료(정산은 수동). 구매자 개인정보는 표시하지 않습니다.">
      <PartnersAdminClient />
    </AdminPage>
  );
}
