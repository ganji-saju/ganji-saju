// 2026-07-07 — 전상품 가격 관리(super_admin). 현재/과거/변경가 입력 + 확인창.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { listProductPrices } from '@/lib/admin/product-pricing';
import { PricingAdminClient } from './pricing-admin-client';

export const metadata: Metadata = {
  title: '가격 관리 (admin)',
  description: '전 상품 가격 변경(즉시 청구 반영).',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PricingAdminPage() {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');

  const service = await createServiceClient();
  const items = await listProductPrices(service);

  return (
    <AdminPage
      title="가격 관리"
      description="전 상품 가격을 변경합니다. 저장 즉시 신규 결제 청구액에 반영됩니다."
    >
      <PricingAdminClient initialItems={JSON.parse(JSON.stringify(items))} />
    </AdminPage>
  );
}
