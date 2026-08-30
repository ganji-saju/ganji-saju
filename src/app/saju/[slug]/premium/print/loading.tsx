// 2026-08-30 #715 — PDF 인쇄 화면 전용 로딩.
//
//   제보: "PDF 로 보기 전에 로딩이 너무 길어서 풀이가 안 나오는 건가 오류가 난 건가
//   오해하기 쉽다."
//
//   원인: print/page.tsx 는 서버 컴포넌트에서 generateLifetimeInterpretation 을 통째로
//   await 한다. 그 안에서 챕터를 **직렬로** 돈다(앞 챕터를 봐야 같은 문장 반복을 피한다 —
//   의도된 설계). 캐시 미스면 챕터 지연의 합이라 수십 초가 걸리고, **캐시 히트면 즉시**다.
//   즉 오래 기다리는 건 **그 리포트를 처음 만드는 사람뿐**이다 — 문구가 그렇게 말한다.
//
//   ⚠️ premium/loading.tsx 를 그대로 쓰면 안 된다. 그건 /premium(빠름)도 덮기 때문에
//      긴 예상 시간을 걸면 빠른 화면에서 거짓말이 된다. 그래서 print 전용으로 둔다.
//
//   ⚠️ estimateMs 는 **코드에서 유도한 값이지 실측이 아니다**(챕터 직렬 × 챕터당 수 초).
//      실제 소요를 재면 이 숫자부터 갱신해라.
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiLoadingOverlay } from '@/components/gangi/gangi-ui';

export default function SajuPremiumPrintLoading() {
  return (
    <AppShell className="gangi-subpage-shell">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiLoadingOverlay
          title="깊은 풀이를 PDF 로 만들고 있어요"
          description="처음 한 번만 오래 걸려요. 한 번 만들어두면 다음엔 바로 열립니다."
          steps={[
            '원국·격국 정리',
            '대운 흐름 분석',
            '장별 풀이 작성',
            '문서 형태로 정리',
          ]}
          estimateMs={50_000}
        />
      </AppPage>
    </AppShell>
  );
}
