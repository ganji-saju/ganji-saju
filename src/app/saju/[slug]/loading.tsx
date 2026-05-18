// 2026-05-15 handoff PR-I: Next.js App Router loading.tsx route segment.
// `/saju/[slug]` 데이터 fetch race 시 빈 화면 노출 방지 — handoff 51 m-loading
// 모션이 즉시 표시되어 사용자가 "사주 결과를 불러오는 중" 시그널을 받음.
// audit `audit-reports/2026-05-15-handoff-implementation-audit.md §3.E` Risk E 복구.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export default function SajuResultLoading() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="사주 결과를 불러오는 중" />
        <GangiLoadingOverlay
          title="사주 풀이를 준비하고 있어요"
          description="원국과 오늘 흐름을 맞춰보는 중입니다."
          steps={[
            '사주 4기둥 정리',
            '오행 흐름 분석',
            '격국·용신 도출',
            '오늘 운 매칭',
          ]}
        />
      </AppPage>
    </AppShell>
  );
}
