// Phase 3-B (2026-05-18): 사업자·통신판매 통합 고지. DB policy_versions.kind='commerce-disclosure' 우선.
export const dynamic = 'force-dynamic';
// 본 페이지는 사업자 정보 (BUSINESS_INFO) + 정책 본문 결합 — 운영자가 admin 에서 본문 입력 시 사업자 정보 위에 정책 본문 노출.
import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { BUSINESS_INFO } from '@/lib/business-info';
import {
  POLICY_LABELS,
  getCurrentPolicyVersion,
} from '@/lib/policies';
import { PolicyContent } from '@/components/policies/policy-content';
import { buildPolicyMetadata } from '@/components/policies/policy-page-shell';

export async function generateMetadata(): Promise<Metadata> {
  return buildPolicyMetadata(
    'commerce-disclosure',
    '간지사주의 사업자 정보, 통신판매업 신고, 결제·환불 통합 고지.'
  );
}

export default async function CommerceDisclosurePage() {
  const policy = await getCurrentPolicyVersion('commerce-disclosure');

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title={POLICY_LABELS['commerce-disclosure']} backHref="/" />

        <section
          className="space-y-2 rounded-[14px] border bg-white p-4 text-[14px] leading-[1.8] text-[var(--app-copy)]"
          style={{ borderColor: 'var(--app-line)' }}
        >
          <h2 className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
            사업자 정보
          </h2>
          {BUSINESS_INFO.companyName && <div>상호명 : {BUSINESS_INFO.companyName}</div>}
          {BUSINESS_INFO.ceoName && <div>대표자 : {BUSINESS_INFO.ceoName}</div>}
          {BUSINESS_INFO.businessRegistrationNumber && (
            <div>사업자등록번호 : {BUSINESS_INFO.businessRegistrationNumber}</div>
          )}
          {BUSINESS_INFO.mailOrderRegistrationNumber && (
            <div>통신판매업 신고번호 : {BUSINESS_INFO.mailOrderRegistrationNumber}</div>
          )}
          {BUSINESS_INFO.address && <div>사업장 주소 : {BUSINESS_INFO.address}</div>}
          {BUSINESS_INFO.phone && <div>고객센터 : {BUSINESS_INFO.phone}</div>}
          {BUSINESS_INFO.email && <div>이메일 : {BUSINESS_INFO.email}</div>}
          {BUSINESS_INFO.csHours && <div>운영시간 : {BUSINESS_INFO.csHours}</div>}
          {BUSINESS_INFO.privacyOfficerName && (
            <div>
              개인정보보호책임자 : {BUSINESS_INFO.privacyOfficerName}
              {BUSINESS_INFO.privacyOfficerEmail
                ? ` (${BUSINESS_INFO.privacyOfficerEmail})`
                : ''}
            </div>
          )}
          {BUSINESS_INFO.businessInfoVerificationUrl && (
            <div>
              사업자정보 공시 :{' '}
              <a
                href={BUSINESS_INFO.businessInfoVerificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                공정거래위원회 사업자정보 확인
              </a>
            </div>
          )}
        </section>

        {policy ? (
          <PolicyContent policy={policy} />
        ) : (
          <p className="text-[13px] leading-[1.7] text-[var(--app-copy-muted)]">
            결제 및 환불 통합 정책 본문은 운영자 입력 후 게시됩니다. 상세 문의는 위
            고객센터로 연락 부탁드립니다.
          </p>
        )}
      </AppPage>
    </AppShell>
  );
}
