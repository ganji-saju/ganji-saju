// 2026-05-16 PR #146 — Push CTR 분석 대시보드 (admin).
// /api/admin/push-ctr (CTR 집계) + /api/admin/push-ab-policy (현재 winner) 두 endpoint
// 를 묶어 시각화. 별자리 push 의 variant A/B/C 성능 + 현재 정책 확인.
//
// 운영 노출 차단: robots noindex + 로그인 필수 (admin layout 가드).
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { PushCtrDashboard } from './push-ctr-dashboard';

export const metadata: Metadata = {
  title: 'Push CTR 분석',
  description: '별자리 push variant 별 클릭률 + 현재 winner 정책',
  robots: { index: false, follow: false },
};

export default function PushCtrPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="Push CTR (admin)" backHref="/" />
        <PushCtrDashboard />
      </AppPage>
    </AppShell>
  );
}
