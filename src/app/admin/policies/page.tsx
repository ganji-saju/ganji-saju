// Phase 3-B (2026-05-18): 정책 버전 admin UI.
//
// 운영자가 9 정책 (terms / privacy / refund / digital-content / subscription / coin /
// appointment / ai-disclaimer / commerce-disclosure) 의 신규 버전 본문을 직접 입력.
//
// 권한: admin_users (또는 ADMIN_USER_IDS env). robots noindex.
// 사용 흐름:
//   1. 운영자 로그인 → /admin/policies 진입
//   2. 정책 종류 선택 → 현재 활성 버전 + 이력 확인
//   3. textarea 에 본문 입력 + version (semver) + effective_date 입력 → 저장
//   4. 즉시 해당 정책 페이지 (/terms 등) 에 노출 (effective_date 이 오늘 이전이면)

import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { POLICY_KINDS, getAllActivePolicyVersions } from '@/lib/policies';
import { PoliciesAdminClient } from './policies-admin-client';

export const metadata: Metadata = {
  title: '정책 버전 관리 (admin)',
  description: '간지사주 9 정책의 버전 본문 + 시행일 관리.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PoliciesAdminPage() {
  const active = await getAllActivePolicyVersions();

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="정책 버전 관리 (admin)" backHref="/admin/operations" />
        <PoliciesAdminClient
          kinds={POLICY_KINDS as unknown as string[]}
          initialActive={JSON.parse(JSON.stringify(active))}
        />
      </AppPage>
    </AppShell>
  );
}
