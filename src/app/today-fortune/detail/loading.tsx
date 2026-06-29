// 2026-06-29 — 오늘운세 자세히 진입 로딩 표시(없으면 멈춘 듯 보여 이탈 위험).
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export default function TodayDetailLoading() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-0">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="오늘 자세히 풀이를 불러오는 중" />
        <GangiLoadingOverlay
          title="오늘 자세히 풀이를 준비하고 있어요"
          description="오늘 흐름과 시간대별 신호를 정리하는 중입니다. 잠시만 기다려 주세요."
          steps={['오늘 일진 매칭', '시간대 흐름 분석', '조심·유리한 점 도출', '풀이 정리']}
        />
      </AppPage>
    </AppShell>
  );
}
