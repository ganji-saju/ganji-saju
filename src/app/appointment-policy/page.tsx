// Phase 3-B (2026-05-18): 예약상담 정책. DB policy_versions.kind='appointment' 우선.
export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'appointment',
    '간지사주 예약상담의 취소·변경·노쇼·상담사 불참 시 환불 기준 안내.'
  );
}

export default async function AppointmentPolicyPage() {
  return <PolicyPage kind="appointment" />;
}
