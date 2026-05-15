// 2026-05-16 — 결제 funnel admin 대시보드 (B1).
// /credits → prepare → confirm 의 단계별 진입·차단·성공·실패 추세 + reason breakdown.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { PaymentFunnelDashboard } from './payment-funnel-dashboard';

export const metadata: Metadata = {
  title: '결제 Funnel 모니터링',
  description: '/credits → prepare → confirm 단계별 진입·전환·차단·실패 통계',
  robots: { index: false, follow: false },
};

export default function PaymentFunnelPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="결제 Funnel (admin)" backHref="/admin/operations" />
        <PaymentFunnelDashboard />
      </AppPage>
    </AppShell>
  );
}
