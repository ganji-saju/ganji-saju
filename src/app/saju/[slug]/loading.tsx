// 2026-05-15 handoff PR-I: Next.js App Router loading.tsx route segment.
// `/saju/[slug]` 데이터 fetch race 시 빈 화면 노출 방지 — handoff 51 m-loading
// 모션이 즉시 표시되어 사용자가 "사주 결과를 불러오는 중" 시그널을 받음.
// audit `audit-reports/2026-05-15-handoff-implementation-audit.md §3.E` Risk E 복구.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { SAJU_RESULT_LOADING } from '@/components/saju/loading-copy';

export default function SajuResultLoading() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="사주 결과를 불러오는 중" />
        {/* 제출 화면(/saju/new)과 **같은 문구**를 쓴다 — 문구가 다르면 로딩이 두 번 뜬 것처럼
            읽힌다. 실제로는 대기가 둘(POST → 서버 렌더)이라 화면 자체는 합칠 수 없다. */}
        <GangiLoadingOverlay
          {...SAJU_RESULT_LOADING}
          steps={[...SAJU_RESULT_LOADING.steps]}
          estimateMs={6000}
        />
      </AppPage>
    </AppShell>
  );
}
