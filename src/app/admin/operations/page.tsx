// 2026-05-15 — 운영 모니터링 대시보드 (admin).
// DAU / 결제 전환율 / 평균 만족도 / 활성 구독 등 핵심 운영 지표 시각화.
//
// 운영 노출 차단: robots noindex + 로그인 필수 (API).
//
// 2026-05-20 V2-5 PR T — admin sub-nav grid 추가. 다른 admin 페이지 진입점 통일.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { OperationsDashboard } from './operations-dashboard';

export const metadata: Metadata = {
  title: '운영 모니터링',
  description: '간지사주 핵심 운영 지표 — DAU·결제·만족도·구독 활성',
  robots: { index: false, follow: false },
};

interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  badge?: string;
}

const ADMIN_NAV: AdminNavItem[] = [
  {
    href: '/admin/users',
    label: '사용자 조회',
    description: '이메일·UUID 검색 → 회원·결제·LLM 상세',
    badge: 'NEW',
  },
  {
    href: '/admin/llm-cost',
    label: 'LLM 비용',
    description: '영역별 호출·토큰·비용·캐시 hit률 추이',
    badge: 'NEW',
  },
  {
    href: '/admin/saju-feedback',
    label: '챕터 피드백',
    description: 'LLM 풀이 별점·helpful 비율·부정 응답 챕터',
    badge: 'NEW',
  },
  {
    href: '/admin/reviews',
    label: '후기 검수',
    description: 'pending / approved / rejected 모더레이션',
  },
  {
    href: '/admin/policies',
    label: '약관·정책',
    description: '정책 버전 + 게시 상태',
  },
  {
    href: '/admin/payment-funnel',
    label: '결제 퍼널',
    description: '진입 → 결제 단계별 이탈률',
  },
  {
    href: '/admin/push-ctr',
    label: '알림 CTR',
    description: '푸시 전송 / 클릭 / CTR 추이',
  },
  {
    href: '/admin/myungri-validation',
    label: '명리 검증',
    description: 'KASI 비교 / 사주 산출 정합성',
  },
  {
    href: '/admin/saju-verify',
    label: '사주 검증',
    description: '슬러그별 사주 계산 traces',
  },
  {
    href: '/admin/weight-tuning',
    label: '신살 가중치',
    description: 'ML 가중치 튜닝 / 학습 fixture',
  },
];

function AdminNavGrid() {
  return (
    <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
      <h2 className="text-[15px] font-extrabold text-[var(--app-ink)]">관리자 메뉴</h2>
      <p className="mt-1 text-[13.2px] text-[var(--app-copy-soft)]">
        각 영역의 admin 페이지로 바로 이동합니다.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col gap-1 rounded-[12px] border border-[var(--app-line)] bg-white p-3 transition-colors hover:bg-[var(--app-pink-soft)]"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[14.4px] font-extrabold text-[var(--app-ink)]">
                {item.label}
              </span>
              {item.badge && (
                <span
                  className="rounded-full bg-[var(--app-pink-strong)] px-1.5 py-0.5 text-[10.4px] font-extrabold text-white"
                  aria-label={`${item.label} ${item.badge} 표시`}
                >
                  {item.badge}
                </span>
              )}
            </div>
            <div className="text-[12.6px] text-[var(--app-copy-soft)]">{item.description}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function OperationsPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="운영 모니터링 (admin)" backHref="/" />
        <AdminNavGrid />
        <OperationsDashboard />
      </AppPage>
    </AppShell>
  );
}
