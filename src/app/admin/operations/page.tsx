// 2026-05-15 — 운영 모니터링 대시보드 (admin).
// DAU / 결제 전환율 / 평균 만족도 / 활성 구독 등 핵심 운영 지표 시각화.
//
// 운영 노출 차단: robots noindex + 로그인 필수 (API).
//
// 2026-06-28 — 인라인 ADMIN_NAV 그리드 제거. 섹션 내비는 layout 의 영속 사이드바(AdminNav)로 통일.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { OperationsDashboard } from './operations-dashboard';

export const metadata: Metadata = {
  title: '운영 모니터링',
  description: '간지사주 핵심 운영 지표 — DAU·결제·만족도·구독 활성',
  robots: { index: false, follow: false },
};

export default function OperationsPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="운영 모니터링 (admin)" backHref="/admin" />
        <OperationsDashboard />
      </AppPage>
    </AppShell>
  );
}
