// 2026-05-18: 통합 정책 hub — 9 정책 탭으로 한 페이지에서 전환.
// 사용자 요청: "9개 별도 메뉴보다 하나의 페이지에서 탭으로". 푸터 단축 (정책 모아보기 → /legal).
//
// 기존 9 정책 URL (/terms, /privacy, /refund-policy 등) 도 유지 — SEO 보존.
// 본 hub 는 모바일 친화 가로 스크롤 chip 탭.

import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { getAllActivePolicyVersions } from '@/lib/policies';
import { POLICY_KINDS, POLICY_LABELS, type PolicyKind } from '@/shared/policies/types';
import { LegalTabsClient } from './legal-tabs-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '정책 모아보기',
  description:
    '간지사주 이용약관·개인정보처리방침·환불정책·구독·전·예약상담·AI 콘텐츠 한계·사업자 고지 통합 안내.',
};

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

function normalizeTab(raw: string | undefined): PolicyKind {
  if (raw && (POLICY_KINDS as readonly string[]).includes(raw)) {
    return raw as PolicyKind;
  }
  return 'terms';
}

export default async function LegalHubPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const initialTab = normalizeTab(tab);
  const active = await getAllActivePolicyVersions();

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-4">
        <GangiPageHeader title="정책 모아보기" backHref="/" />
        <p className="text-[14.4px] leading-[1.7] text-[var(--app-copy-muted)]">
          이용약관·개인정보처리방침·환불·구독·전 등 9 정책을 한 페이지에서 탭으로 확인하실
          수 있습니다. 각 정책은 별도 URL (예: <code className="text-[13.2px]">/terms</code>) 로
          직접 접근도 가능합니다.
        </p>
        <LegalTabsClient
          kinds={POLICY_KINDS as unknown as PolicyKind[]}
          labels={POLICY_LABELS}
          initialTab={initialTab}
          initialActive={JSON.parse(JSON.stringify(active))}
        />
      </AppPage>
    </AppShell>
  );
}
