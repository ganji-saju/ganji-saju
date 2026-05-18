// Phase 3-B (2026-05-18): 환불·청약철회 정책. DB policy_versions.kind='refund' 우선.
export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'refund',
    '간지사주의 환불 및 청약철회 정책 안내. 디지털 콘텐츠/구독/코인/예약상담별 환불 기준.'
  );
}

export default async function RefundPolicyPage() {
  return <PolicyPage kind="refund" />;
}
