// Phase 3-B (2026-05-18): 디지털 콘텐츠 제공·철회 안내. DB policy_versions.kind='digital-content' 우선.
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'digital-content',
    '간지사주의 디지털 콘텐츠 제공 시점과 청약철회 제한 안내 (전자상거래법 §17 기준).'
  );
}

export default async function DigitalContentPolicyPage() {
  return <PolicyPage kind="digital-content" />;
}
