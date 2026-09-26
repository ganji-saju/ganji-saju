// 2026-09-27 — 신년운세 PDF 로딩. print/page.tsx 는 서버에서 풀이를 통째로 기다린다 — 캐시가 없으면(처음 여는 사람) 수십 초.
//   이 파일이 없어서 그동안 아무것도 안 보였다(사용자 제보). 평생 PDF 로딩(premium/print/loading.tsx)과 같은 방식.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiLoadingOverlay } from '@/components/gangi/gangi-ui';

export default function NewYearPrintLoading() {
  return (
    <AppShell className="gangi-subpage-shell">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiLoadingOverlay
          title="2027 신년운세를 PDF 로 만들고 있어요"
          description="처음 한 번만 오래 걸려요. 화면에서 본 풀이와 같은 내용으로 만듭니다."
          steps={['사주팔자·오행 정리', '2027 풀이 불러오기', '분기·월별 흐름 배치', '문서 형태로 정리']}
          estimateMs={35_000}
          revealAfterMs={6_000}
        />
      </AppPage>
    </AppShell>
  );
}
