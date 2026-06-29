// 2026-06-29 — 프리미엄 풀이 진입 로딩 표시.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export default function SajuPremiumLoading() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="상세 풀이를 불러오는 중" />
        <GangiLoadingOverlay
          title="프리미엄 풀이를 준비하고 있어요"
          description="평생 리포트와 깊은 풀이를 정리하는 중입니다. 잠시만 기다려 주세요."
          steps={['원국·격국 정리', '용신·대운 흐름 분석', '영역별 풀이 도출', '리포트 정리']}
        />
      </AppPage>
    </AppShell>
  );
}
