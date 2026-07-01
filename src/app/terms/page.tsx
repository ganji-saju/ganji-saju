// Phase 3-B (2026-05-18): 이용약관. DB policy_versions.kind='terms' 우선.
// 기존 hardcoded 본문 → migration 032 의 v1.0.0 seed 로 DB import.
// 운영자가 /admin/policies 에서 v1.0.1+ 갱신 가능.
export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'terms',
    '간지사주 이용 조건, 재화(전) 정책, 결제 및 책임 제한에 대한 안내입니다.'
  );
}

export default async function TermsPage() {
  return <PolicyPage kind="terms" />;
}
