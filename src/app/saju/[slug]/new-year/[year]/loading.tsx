// 2026-09-27 — 신년운세 화면 전환 로딩(사용자 제보: 화면 전환 뒤 풀이가 나올 때까지 빈 화면처럼 보인다).
//   풀이 생성 자체의 로딩은 YearlyReportPanel(mode="new-year")이 띄운다 — 여기는 서버 판정(이용권·미리보기) 구간.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiLoadingOverlay } from '@/components/gangi/gangi-ui';

export default function NewYearLoading() {
  return (
    <AppShell className="gangi-subpage-shell">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiLoadingOverlay
          title="2027 신년운세를 여는 중이에요"
          description="사주와 이용권을 확인하고 있어요."
          steps={['사주 확인', '이용권 확인', '2027 흐름 준비', '화면 정리']}
          // 서버 판정만이라 짧다(풀이 생성 로딩은 패널이 따로 띄운다).
          estimateMs={3_000}
        />
      </AppPage>
    </AppShell>
  );
}
