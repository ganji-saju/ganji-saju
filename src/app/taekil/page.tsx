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
import { guardMenuPassEntry } from '@/lib/payments/menu-pass.server';

export const metadata: Metadata = {
  title: '좋은 날 택일',
  description: '결혼·이사·개업·계약·여행 등 중요한 일을 위해 본인 사주로 다음 60일 길일을 찾아드립니다.',
  alternates: { canonical: '/taekil' },
};

export default async function TaekilPage() {
  // 2026-08-28 — 택일 3,300원 당일권 게이트. 멤버십·당일권이 없으면 체크아웃으로 보낸다.
  //   (990원 4종과 같은 자리·같은 방식 — 값만 단품 라인 3,300원.)
  await guardMenuPassEntry('taekil', 'taekil');

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
