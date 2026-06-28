// 2026-05-15 — 신살 룰 검증 대시보드 (admin).
// PR #109 today_fortune_feedback 의 detected_sinsals + overall_rating 으로
// 각 신살별 "실제 효과" 를 통계 검증. spec doc 03 §6 의 t-test 분석을 admin UI 화.
//
// 운영 노출 차단: robots noindex + 로그인 필수 (API).
import type { Metadata } from 'next';
import { AdminPage } from '@/components/admin/admin-page';
import { ValidationDashboard } from './validation-dashboard';

export const metadata: Metadata = {
  title: '신살 룰 검증',
  description: '사용자 피드백 데이터로 신살별 실제 효과를 t-test 검증하는 admin 도구',
  robots: { index: false, follow: false },
};

export default function MyungriValidationPage() {
  return (
    <AdminPage title="신살 룰 검증">
      <ValidationDashboard />
    </AdminPage>
  );
}
