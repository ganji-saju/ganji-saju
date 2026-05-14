// 2026-05-15 handoff PR-I: `/credits` route segment streaming loading.
// 코인 카탈로그 + 잔액 fetch race 방지.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export default function CreditsLoading() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="코인 정보 준비 중" />
        <GangiLoadingOverlay
          title="결제 정보를 불러오고 있어요"
          description="코인 잔액과 패키지를 확인하는 중입니다."
          steps={[
            '잔액 확인',
            '결제 이력 정리',
            '패키지 옵션 정렬',
          ]}
        />
      </AppPage>
    </AppShell>
  );
}
