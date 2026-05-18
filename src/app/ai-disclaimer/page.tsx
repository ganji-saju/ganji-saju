// Phase 3-B (2026-05-18): AI 상담·운세 콘텐츠 한계 고지. DB policy_versions.kind='ai-disclaimer' 우선.
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'ai-disclaimer',
    '간지사주의 AI 상담·운세 콘텐츠 한계와 의료·법률·투자 등 고위험 판단에 대한 안내.'
  );
}

export default async function AiDisclaimerPage() {
  return <PolicyPage kind="ai-disclaimer" />;
}
