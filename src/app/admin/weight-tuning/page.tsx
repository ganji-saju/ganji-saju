// 2026-05-15 — 신살 가중치 ML 학습 대시보드 (admin).
// 사용자 피드백 데이터에서 릿지 회귀로 신살별 최적 가중치 산출 → 현재 운영
// 가중치와 비교 → 변경 권고 시각화 → admin 검토 후 draft 저장 + activate.
//
// 운영 노출 차단: robots noindex + 로그인 필수.
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { WeightTuningDashboard } from './weight-tuning-dashboard';

export const metadata: Metadata = {
  title: '가중치 자동 조정',
  description: '사용자 피드백 ML 학습으로 신살 가중치를 데이터 기반으로 자동 조정',
  robots: { index: false, follow: false },
};

export default function WeightTuningPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="신살 가중치 학습 (admin)" backHref="/" />
        <WeightTuningDashboard />
      </AppPage>
    </AppShell>
  );
}
