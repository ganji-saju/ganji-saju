// 2026-05-15 PR-M: TermsConsentModal QA showcase.
import type { Metadata } from 'next';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { TermsModalShowcaseClient } from './showcase-client';

export const metadata: Metadata = {
  title: '약관 동의 모달 · QA',
  description: '간지사주 풀스크린 약관 동의 모달 showcase.',
  robots: { index: false, follow: false },
};

export default function TermsModalShowcasePage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-4">
        <GangiPageHeader title="약관 동의 모달 · QA" backHref="/admin/design/push-modal" />

        <article
          className="rounded-[18px] border p-5"
          style={{
            background: 'var(--app-pink-soft)',
            borderColor: 'var(--app-pink-line)',
          }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            design QA · 운영 노출 X
          </div>
          <h1
            className="mt-1.5 text-[23px] font-extrabold leading-[1.4] text-[var(--app-ink)]"
            style={{ wordBreak: 'keep-all' }}
          >
            <code className="text-[20.7px]">TermsConsentModal</code>
          </h1>
          <p className="mt-2 text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
            전체 동의 row + 항목별 체크 + 필수 항목 검사 + 마케팅 선택 항목. GDPR / 14세 미만 보호자 동의 등 강한 동의 시점에 caller 가 mount.
          </p>
        </article>

        <TermsModalShowcaseClient />

        <article
          className="rounded-[14px] border bg-white p-4"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-copy-muted)]">
            source of truth
          </div>
          <ul className="mt-2 grid gap-1 text-[13.2px] leading-[1.55] text-[var(--app-copy)]">
            <li>· component: <code>src/components/notifications/terms-consent-modal.tsx</code></li>
            <li>· spec: <code>docs/design/ganji-redesign/source/02_BOARD_MANIFEST.md</code> (board `terms-modal` 28)</li>
            <li>· motion: m-modal (dim fade + sheet 슬라이드)</li>
          </ul>
        </article>
      </AppPage>
    </AppShell>
  );
}
