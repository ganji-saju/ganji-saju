// 2026-05-15 — 택일(좋은 날) 페이지 신규.
// 사용자 피드백: "05-3 좋은날 택일 -> 이 화면 구성은 없는 거 같은데 적용 가능할까?"
// 기존 /taekil 은 정적 placeholder (하드코드 11월 12·18·25일 샘플) 였음.
// 이제 사용자 사주 + 다음 60일 일진 기반 길일 산출 페이지로 작동.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { TaekilClient } from '@/features/taekil/taekil-client';
import { PaidFunnelGrid } from '@/components/seo/paid-funnel-grid';

export const metadata: Metadata = {
  title: '좋은 날 택일',
  description: '결혼·이사·개업·계약·여행 등 중요한 일을 위해 본인 사주로 다음 60일 길일을 찾아드립니다.',
  alternates: { canonical: '/taekil' },
};

// 2026-08-28 — 택일은 **부분 유료**다: 페이지는 열어 두고 상위 3일까지 보여준 뒤
//   나머지를 잠근다(자르는 곳은 /api/taekil/find-good-days). 전면 게이트를 걸었다가
//   되돌린 이유 — /taekil 은 sitemap priority 0.78 의 검색 유입 페이지라,
//   첫 화면이 결제창이면 유입이 그대로 이탈이 된다.
export default function TaekilPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="좋은 날 택일" backHref="/" />
        <TaekilClient />
        {/* 2026-07-19 — 하단 추천을 8개 메뉴 전 화면에 동일 노출(사용자 요청).
            from="taekil" 이 목록에서 택일 자신을 제외한다. */}
        <PaidFunnelGrid from="taekil" tone="light" />
      </AppPage>
    </AppShell>
  );
}
