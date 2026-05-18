// 2026-05-15 handoff PR-I: `/today-fortune` route segment streaming loading.
// 사용자가 concern picker 진입 시 빈 화면 노출 방지.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export default function TodayFortuneLoading() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="오늘 흐름을 불러오는 중" />
        <GangiLoadingOverlay
          title="오늘 흐름을 준비하고 있어요"
          description="고민과 사주를 맞춰보는 중입니다."
          steps={[
            '고민 컨셉 정리',
            '오늘 일진 확인',
            '핵심 한 줄 정리',
          ]}
        />
      </AppPage>
    </AppShell>
  );
}
