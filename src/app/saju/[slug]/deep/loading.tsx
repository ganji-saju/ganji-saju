// 2026-06-29 — 상세(깊은) 풀이 진입 시 로딩 표시(없으면 멈춘 듯 보여 이탈 위험).
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader, GangiLoadingOverlay } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';

export default function SajuDeepLoading() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="상세 풀이를 불러오는 중" />
        <GangiLoadingOverlay
          title="상세 사주 풀이를 준비하고 있어요"
          description="평생 흐름을 깊이 있게 정리하는 중입니다. 잠시만 기다려 주세요."
          steps={['원국·격국 정리', '용신·대운 흐름 분석', '장단점·시기 도출', '풀이 문장 정리']}
        />
      </AppPage>
    </AppShell>
  );
}
