// 2026-07-07 — 누적 일별 지표 그래프 (admin). 방문자·전환율·유입·결제를 매일 롤업한
//   metrics_daily 시계열을 30/90/365일 그래프로. 데이터 source: /api/admin/analytics.
//   운영 노출 차단: robots noindex + admin 가드(API).
import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/admin-page';
import { AnalyticsDashboard } from './analytics-dashboard';

export const metadata: Metadata = {
  title: '누적 지표 분석',
  description: '간지사주 일별 누적 지표 — 방문자·전환율·유입·결제 시계열 그래프',
  robots: { index: false, follow: false },
};

export default function AnalyticsPage() {
  return (
    <AdminPage title="누적 지표 분석">
      <AnalyticsDashboard />
    </AdminPage>
  );
}
