// 2026-08-25 전면 개편 Phase 2 — 푸터 압축(도령 벤치마크, 사용자 지시 "푸터 내용이 너무 많다").
//   구 다크 풀 푸터(브랜드 소개문 + 4칼럼 내비 20링크 + 아코디언)를 걷어내고
//   도령 수준으로: 브랜드 1줄 → 법정 표기 → 면책 → 필수 링크 1줄 → ©.
//   · 4칼럼 내비 제거 근거: 헤더 메가내브 + 모바일 dock 과 전량 중복이었다.
//   · 회사 정보(사업자번호/주소/대표자)와 면책 문구는 **법적 고지 — 절대 수정 X**
//     (전자상거래법 표시 의무). 압축은 표현·구조만, 항목은 전부 유지한다.
//   · 배경: 흑색 → 한지 톤(B안). globals.css 의 footer override 와 한 몸으로 움직인다.
//   · className "site-footer-redesign" 은 유지 — app-shell.css 의 dock-clearance
//     :has() 셀렉터가 이 클래스를 조준한다(바꾸면 모바일 하단 여백 회귀).
//
// 2026-05-18 Phase 3-A: 사업자 정보는 BUSINESS_INFO env 기반(누락 시 빌드 가드).

'use client';

import Link from 'next/link';
import { BUSINESS_INFO } from '@/lib/business-info';
// 동의 배너 재노출(재선택·철회 경로). PIPA: 철회는 동의만큼 쉬워야 한다.
import { openConsentBanner } from '@/components/analytics/analytics-consent';

interface CompanyItem {
  label: string;
  value: string;
  href?: string;
}

function buildCompanyItems(): CompanyItem[] {
  const items: CompanyItem[] = [
    { label: '상호', value: BUSINESS_INFO.companyName },
    { label: '대표', value: BUSINESS_INFO.ceoName },
    { label: '사업자등록번호', value: BUSINESS_INFO.businessRegistrationNumber },
    { label: '통신판매업', value: BUSINESS_INFO.mailOrderRegistrationNumber },
    { label: '주소', value: BUSINESS_INFO.address },
    {
      label: '고객센터',
      value: BUSINESS_INFO.phone,
      href: BUSINESS_INFO.phone ? `tel:${BUSINESS_INFO.phone}` : undefined,
    },
    {
      label: '이메일',
      value: BUSINESS_INFO.email,
      href: BUSINESS_INFO.email ? `mailto:${BUSINESS_INFO.email}` : undefined,
    },
    { label: '운영시간', value: BUSINESS_INFO.csHours },
    {
      label: '개인정보보호책임자',
      value: BUSINESS_INFO.privacyOfficerName
        ? `${BUSINESS_INFO.privacyOfficerName}${
            BUSINESS_INFO.privacyOfficerEmail ? ` (${BUSINESS_INFO.privacyOfficerEmail})` : ''
          }`
        : '',
    },
  ];
  if (BUSINESS_INFO.businessInfoVerificationUrl) {
    items.push({
      label: '사업자정보',
      value: '공시 확인',
      href: BUSINESS_INFO.businessInfoVerificationUrl,
    });
  }
  return items.filter((item) => item.value);
}

/** 필수 링크 한 줄 — 내비가 아니라 법정/정책 접근 경로만 남긴다. */
const ESSENTIAL_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['이용약관', '/terms'],
  ['개인정보처리방침', '/privacy'],
  ['정책 모아보기', '/legal'],
  ['가격 안내', '/pricing'],
];

const MUTED = 'rgba(28, 26, 23, 0.6)';
const FAINT = 'rgba(28, 26, 23, 0.48)';

export default function SiteFooter() {
  const companyItems = buildCompanyItems();

  return (
    <footer
      className="site-footer-redesign mt-auto"
      aria-label="회사 및 서비스 안내"
      style={{
        color: MUTED,
        padding: '24px 20px 20px',
        fontSize: 10,
        lineHeight: 1.6,
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        {/* 브랜드 — 로고 칩 + 이름 한 줄. 소개 문단·중복 표기는 제거(도령식). */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-5 w-5 place-items-center rounded-[6px] text-white"
            style={{
              background: 'var(--app-pink)',
              fontFamily: 'var(--font-han)',
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            干
          </span>
          <span style={{ color: 'var(--app-ink)', fontSize: 11.5, fontWeight: 800 }}>
            간지사주
          </span>
        </div>

        {/* 회사 정보 — 법적 고지(항목 전부 유지). 한 칼럼 라벨/값 행. */}
        <dl className="m-0 mt-4 grid gap-y-1">
          {companyItems.map((item) => (
            <div key={item.label} className="flex min-w-0 gap-2.5">
              <dt style={{ color: FAINT, minWidth: 84, whiteSpace: 'nowrap' }}>
                {item.label}
              </dt>
              <dd className="m-0 min-w-0" style={{ overflowWrap: 'anywhere' }}>
                {item.href ? (
                  <a href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* 면책 — 법적 고지 문구, 무수정 유지. */}
        <div className="mt-4 grid gap-1.5" style={{ color: FAINT, fontSize: 9.5 }}>
          <p className="m-0">
            결제, 환불, 보관함, 계정 관련 문의는 위 연락처로 접수해 주세요. 유료
            풀이와 전 이용 내역은 로그인 계정별로 확인됩니다.
          </p>
          <p className="m-0">
            간지사주의 사주·타로·띠운세 콘텐츠는 삶의 흐름을 참고하기 위한 운세
            콘텐츠입니다. 의료, 법률, 투자, 위기상황 판단은 전문가 판단과 즉각적인
            도움을 우선해 주세요.
          </p>
        </div>

        {/* 필수 링크 + 쿠키 설정 — 한 줄. */}
        <nav
          aria-label="약관 및 정책"
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3"
          style={{ borderTop: '1px solid rgba(28, 26, 23, 0.12)' }}
        >
          {ESSENTIAL_LINKS.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="hover:underline"
              style={{ color: MUTED, textDecoration: 'none' }}
            >
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={openConsentBanner}
            className="hover:underline"
            style={{
              color: MUTED,
              background: 'none',
              border: 0,
              padding: 0,
              cursor: 'pointer',
              fontSize: 'inherit',
            }}
          >
            쿠키 설정
          </button>
        </nav>

        <p className="m-0 mt-4" style={{ color: FAINT, fontSize: 9.5 }}>
          © 2026 {BUSINESS_INFO.companyName || '간지사주'}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
