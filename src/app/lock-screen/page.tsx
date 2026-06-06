// 2026-05-18 Phase 5-B: 락스크린 위젯 페이지 — FeatureUnavailable 으로 교체.
// 기존 SHELL (mock data + "준비 중" badge + disabled button) 제거.
// 사용자 directive: "준비 중" 표시 금지 + 출시 예정 기능은 명확한 출시예정 컴포넌트로 분리.
import type { Metadata } from 'next';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { FeatureUnavailable } from '@/components/state/feature-unavailable';

export const metadata: Metadata = {
  title: '락스크린 위젯',
  description: '간지사주 락스크린 푸시 위젯 — 곧 출시 예정인 기능 안내.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/lock-screen' },
};

export default function LockScreenPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="락스크린 위젯" backHref="/my" />
        <FeatureUnavailable
          featureName="잠금 화면 푸시 위젯"
          reason="coming_soon"
          detail="아침·점심·저녁 시간대에 짧은 오늘 흐름 안내를 잠금 화면에서 받아보는 기능입니다. iOS Safari / Android Chrome PWA 전환과 함께 열릴 예정입니다."
        />
      </AppPage>
    </AppShell>
  );
}
