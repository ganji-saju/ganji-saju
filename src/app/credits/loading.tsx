// 2026-05-15 handoff PR-I: `/credits` route segment streaming loading.
// 전 카탈로그 + 잔액 fetch race 방지.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export default function CreditsLoading() {
  return (
    <AppShell header={<SiteHeader />} footer={false} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="전 잔액" />
        <GangiLoadingOverlay
          title="전 잔액을 확인하고 있어요"
          description="보유 잔액과 사용 안내를 정리하고 있어요."
          steps={[
            '잔액 확인',
            '사용 내역 정리',
          ]}
        />
      </AppPage>
    </AppShell>
  );
}
