// Redesign 2026-05-13 (Claude Design / 가이드 §4): 다크 풀 푸터.
// 모든 라우팅(`href`) 은 사이트 기존 라우트만 사용 — 신규 URL 0건.
// 회사 정보(사업자번호 / 주소 / 대표자) 및 면책 문구는 법적 고지 — 절대 수정 X.
// 모바일은 4 column nav 를 accordion (옵션 D) 으로 collapse 가능.
//
// 2026-05-18 Phase 3-A: hardcoded 사업자 정보 → BUSINESS_INFO env 기반.
//   통신판매업 신고번호 + CS 이메일/운영시간 + 개인정보보호책임자 신규 노출.
//   production 빌드 시 누락 env 검출 → throw (src/lib/business-info.ts 가드).

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BUSINESS_INFO } from '@/lib/business-info';

interface CompanyItem {
  label: string;
  value: string;
  href?: string;
}

function buildCompanyItems(): CompanyItem[] {
  const items: CompanyItem[] = [
    { label: '회사명', value: BUSINESS_INFO.companyName },
    { label: '대표자', value: BUSINESS_INFO.ceoName },
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

const FOOTER_NAV: { title: string; items: ReadonlyArray<readonly [string, string]> }[] = [
  {
    title: '운세',
    items: [
      ['오늘의 운세', '/today-fortune'],
      ['타로 한 장', '/tarot/daily'],
      ['띠운세', '/zodiac'],
      ['별자리', '/star-sign'],
      ['꿈해몽', '/dream-interpretation'],
    ],
  },
  {
    title: '사주',
    items: [
      ['내 사주 풀이', '/saju/new'],
      ['궁합', '/compatibility/input'],
      ['올해 흐름', '/daewoon'],
      ['좋은 날 택일', '/taekil'],
      ['대화 상담', '/dialogue'],
    ],
  },
  {
    title: '계정',
    items: [
      ['로그인', '/login'],
      ['MY', '/my'],
      ['보관함', '/my/results'],
      ['결제내역', '/my/billing'],
      ['멤버십', '/membership'],
    ],
  },
  {
    title: '고객센터',
    items: [
      ['알림 설정', '/notifications'],
      ['이용약관', '/terms'],
      ['개인정보처리방침', '/privacy'],
      ['가격 안내', '/pricing'],
    ],
  },
];

function buildContactNavItem(): readonly [string, string] | null {
  if (BUSINESS_INFO.phone) return [`☎ ${BUSINESS_INFO.phone}`, `tel:${BUSINESS_INFO.phone}`];
  if (BUSINESS_INFO.email) return [`✉ ${BUSINESS_INFO.email}`, `mailto:${BUSINESS_INFO.email}`];
  return null;
}

const LINK_STYLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.62)',
  textDecoration: 'none',
  display: 'block',
  padding: '4px 0',
};

function NavLink({ label, href }: { label: string; href: string }) {
  if (href.startsWith('tel:') || href.startsWith('mailto:')) {
    return (
      <a href={href} style={LINK_STYLE}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} style={LINK_STYLE}>
      {label}
    </Link>
  );
}

export default function SiteFooter() {
  // 모바일 accordion: 한 번에 한 column 만 열림. 기본은 모두 닫힘 (사용자 의도: 짧게)
  const [openSection, setOpenSection] = useState<string | null>(null);

  const companyItems = buildCompanyItems();
  const contactNavItem = buildContactNavItem();
  const navWithContact = FOOTER_NAV.map((col) =>
    col.title === '고객센터' && contactNavItem
      ? { ...col, items: [contactNavItem, ...col.items] as ReadonlyArray<readonly [string, string]> }
      : col
  );

  return (
    <footer
      className="site-footer-redesign mt-auto"
      aria-label="회사 및 서비스 안내"
      style={{
        // 사용자 피드백 (2026-05-14): 완전한 흑색 #000 으로.
        background: '#000',
        color: 'rgba(255,255,255,0.72)',
        padding: '48px 24px 28px',
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 1180 }}>
        {/* 사용자 피드백 (2026-05-13): column gap 36px → 24/28px 로 축소 */}
        <div className="grid gap-6 lg:gap-7 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          {/* 브랜드 lockup */}
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-[10px] text-white"
                style={{
                  background:
                    'linear-gradient(135deg, var(--app-pink), var(--app-pink-strong))',
                  fontFamily: 'var(--font-han)',
                  fontWeight: 700,
                  fontSize: 20,
                  letterSpacing: '-0.02em',
                  boxShadow: '0 4px 12px rgba(216,27,114,0.32)',
                }}
              >
                干
              </span>
              <div className="leading-tight">
                <div
                  style={{
                    color: 'var(--app-pink)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  간지사주
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    color: '#fff',
                  }}
                >
                  간지사주
                </div>
              </div>
            </div>
            <p style={{ maxWidth: 280, color: 'rgba(255,255,255,0.62)' }}>
              오늘운세, 사주, 타로, 궁합을 쉽고 빠르게 보는 운세 서비스입니다.
            </p>
          </div>

          {/* 4 column nav — desktop: 항상 펼침 / mobile: accordion */}
          {navWithContact.map((col) => {
            const isOpen = openSection === col.title;
            return (
              <div key={col.title} className="border-b border-white/8 sm:border-b-0">
                {/* Mobile: 클릭 가능한 헤더 (accordion trigger) */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenSection((prev) => (prev === col.title ? null : col.title))
                  }
                  aria-expanded={isOpen}
                  aria-controls={`footer-nav-${col.title}`}
                  className="flex w-full items-center justify-between py-3 text-left sm:hidden"
                >
                  <h4
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#fff',
                      margin: 0,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {col.title}
                  </h4>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isOpen && 'rotate-180'
                    )}
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                    aria-hidden="true"
                  />
                </button>

                {/* Desktop: 정적 헤더 */}
                <h4
                  className="hidden sm:block"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#fff',
                    margin: '0 0 14px',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {col.title}
                </h4>

                {/* nav 컨텐츠 — desktop 항상 보임 / mobile 은 isOpen 시만 */}
                <nav
                  id={`footer-nav-${col.title}`}
                  aria-label={col.title}
                  className={cn(
                    'sm:block',
                    isOpen ? 'block pb-3' : 'hidden'
                  )}
                >
                  {col.items.map(([label, href]) => (
                    <NavLink key={label} label={label} href={href} />
                  ))}
                </nav>
              </div>
            );
          })}
        </div>

        {/* 회사 정보 — 법적 고지 */}
        <dl
          className="mt-6 grid gap-x-6 gap-y-2 pt-5 sm:grid-cols-2 lg:grid-cols-3"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            fontSize: 12,
          }}
        >
          {companyItems.map((item) => (
            <div key={item.label} className="flex gap-2">
              <dt
                style={{
                  color: 'rgba(255,255,255,0.46)',
                  minWidth: 92,
                  fontWeight: 600,
                }}
              >
                {item.label}
              </dt>
              <dd className="m-0" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {item.href ? (
                  <a
                    href={item.href}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* 면책 */}
        <div
          className="mt-6 grid gap-2 pt-6"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.46)',
            fontSize: 11.5,
            lineHeight: 1.7,
          }}
        >
          <p className="m-0">
            결제, 환불, 보관함, 계정 관련 문의는 위 연락처로 접수해 주세요. 유료
            풀이와 코인 이용 내역은 로그인 계정 기준으로 확인됩니다.
          </p>
          <p className="m-0">
            간지사주의 사주·타로·띠운세 콘텐츠는 삶의 흐름을 참고하기 위한 운세
            콘텐츠입니다. 의료, 법률, 투자, 위기상황 판단은 전문 기준과 즉각적인
            도움을 우선해 주세요.
          </p>
        </div>

        {/* Bottom */}
        <div
          className="mt-6 flex flex-wrap items-center justify-between gap-2"
          style={{ color: 'rgba(255,255,255,0.42)', fontSize: 11.5 }}
        >
          <span>
            © 2026 {BUSINESS_INFO.companyName || '간지사주'}. All rights reserved.
          </span>
          <span>서비스명 간지사주</span>
        </div>
      </div>
    </footer>
  );
}
