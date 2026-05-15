// 2026-05-15 — 택일(좋은 날) 페이지 신규.
// 사용자 피드백: "05-3 좋은날 택일 -> 이 화면 구성은 없는 거 같은데 적용 가능할까?"
// 기존 /taekil 은 정적 placeholder (하드코드 11월 12·18·25일 샘플) 였음.
// 이제 사용자 사주 + 다음 60일 일진 기반 길일 산출 페이지로 작동.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { TaekilClient } from '@/features/taekil/taekil-client';

export const metadata: Metadata = {
  title: '좋은 날 택일',
  description: '결혼·이사·개업·계약·여행 등 중요한 일을 위해 본인 사주로 다음 60일 길일을 찾아드립니다.',
  alternates: { canonical: '/taekil' },
};

export default function TaekilPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="좋은 날 택일" backHref="/" />
        <TaekilClient />
      </AppPage>
    </AppShell>
  );
}
