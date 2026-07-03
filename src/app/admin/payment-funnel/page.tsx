// 2026-05-16 — 결제 funnel admin 대시보드 (B1).
// 상품 결제(멤버십·단건) prepare → confirm 의 단계별 진입·차단·성공·실패 추세 + reason breakdown.
import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/admin-page';
import { PaymentFunnelDashboard } from './payment-funnel-dashboard';

export const metadata: Metadata = {
  title: '결제 Funnel 모니터링',
  description: '상품 결제(멤버십·단건) prepare → confirm 단계별 진입·전환·차단·실패 통계',
  robots: { index: false, follow: false },
};

export default function PaymentFunnelPage() {
  return (
    <AdminPage title="결제 Funnel 모니터링">
      <PaymentFunnelDashboard />
    </AdminPage>
  );
}
