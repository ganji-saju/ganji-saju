// Phase 3-B (2026-05-18): 정기결제·구독 정책. DB policy_versions.kind='subscription' 우선.
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'subscription',
    '간지사주 멤버십 정기결제·무료체험·해지·환불 정책 안내.'
  );
}

export default async function SubscriptionPolicyPage() {
  return <PolicyPage kind="subscription" />;
}
