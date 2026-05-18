/**
 * 정책 페이지 공통 shell — Phase 3-B (2026-05-18).
 *
 * 9 정책 페이지가 공유: SiteHeader + AppShell + 본문 영역.
 * DB 의 PolicyVersion 이 있으면 PolicyContent, 없으면 PolicyNotReady.
 */

import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import {
  POLICY_LABELS,
  getCurrentPolicyVersion,
  type PolicyKind,
} from '@/lib/policies';
import { PolicyContent } from './policy-content';
import { PolicyNotReady } from './policy-not-ready';

/**
 * 정책 페이지의 generateMetadata helper.
 * 본문 없으면 noindex/nofollow (검색엔진 노출 차단).
 */
export async function buildPolicyMetadata(
  kind: PolicyKind,
  descriptionFallback: string
): Promise<Metadata> {
  const policy = await getCurrentPolicyVersion(kind);
  return {
    title: POLICY_LABELS[kind],
    description: descriptionFallback,
    robots: policy
      ? undefined
      : {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        },
  };
}

interface PolicyPageProps {
  kind: PolicyKind;
}

export async function PolicyPage({ kind }: PolicyPageProps) {
  const policy = await getCurrentPolicyVersion(kind);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title={POLICY_LABELS[kind]} backHref="/" />
        {policy ? <PolicyContent policy={policy} /> : <PolicyNotReady kind={kind} />}
      </AppPage>
    </AppShell>
  );
}
