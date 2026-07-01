// Phase 3-B (2026-05-18): 전 정책. DB policy_versions.kind='coin' 우선.
export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'coin',
    '간지사주 전의 유료/무료 구분, 유효기간, 환불 제한 안내.'
  );
}

export default async function CoinPolicyPage() {
  return <PolicyPage kind="coin" />;
}
