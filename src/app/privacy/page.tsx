// Phase 3-B (2026-05-18): 개인정보처리방침. DB policy_versions.kind='privacy' 우선.
// 기존 hardcoded 본문 → migration 032 의 v1.0.0 seed 로 DB import.
// 운영자가 /admin/policies 에서 v1.0.1+ 갱신 가능.
export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import { PolicyPage, buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'privacy',
    '간지사주에서 수집하는 개인정보 항목, 이용 목적, 보관 및 보호 정책을 안내합니다.'
  );
}

export default async function PrivacyPage() {
  return <PolicyPage kind="privacy" />;
}
