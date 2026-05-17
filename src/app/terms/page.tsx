import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '이용약관',
  description:
    '간지사주 이용 조건, 코인 정책, 결제 및 책임 제한에 대한 안내입니다.',
  alternates: {
    canonical: '/terms',
  },
};

const sections = [
  {
    title: '1. 서비스 개요',
    body: [
      '간지사주은 사용자가 입력한 생년월일시를 바탕으로 사주 분석 결과와 부가 콘텐츠를 제공하는 웹 서비스입니다.',
      '서비스는 무료 기능과 코인 기반 유료 기능으로 구성되며, 운영상 필요에 따라 기능과 가격 정책은 변경될 수 있습니다.',
    ],
  },
  {
    title: '2. 계정 및 로그인',
    body: [
      '로그인은 카카오 또는 Google 계정을 통해 진행되며, 사용자는 본인 명의의 계정으로만 서비스를 이용해야 합니다.',
      '부정확한 계정 정보 사용, 타인 계정 도용, 서비스 운영 방해 행위가 확인되면 이용이 제한될 수 있습니다.',
    ],
  },
  {
    title: '3. 코인 및 결제',
    body: [
      '코인은 분야별 깊이보기, AI 상담, 궁합 분석 등 유료 기능 이용 시 차감됩니다.',
      '결제는 외부 결제대행사를 통해 처리되며, 환불 및 취소는 관련 법령과 결제수단 정책, 그리고 서비스 운영 기준에 따라 처리됩니다.',
      '프로모션 또는 가입 혜택으로 지급된 무료 코인은 별도 고지 없이 만료되거나 정책 변경 대상이 될 수 있습니다.',
    ],
  },
  {
    title: '4. 사용자 입력 정보와 결과 이용',
    body: [
      '사용자는 본인이 입력한 생년월일시 정보에 대한 책임을 부담하며, 오입력으로 인한 결과 차이는 서비스 책임 범위에 포함되지 않습니다.',
      '서비스에서 제공하는 사주 해석과 운세 정보는 참고용 콘텐츠이며, 의료·법률·투자 등 전문 판단을 대체하지 않습니다.',
    ],
  },
  {
    title: '5. 이용 제한 및 면책',
    body: [
      '자동화된 비정상 요청, 결제 시스템 악용, 콘텐츠 무단 복제·재판매 등은 금지됩니다.',
      '천재지변, 외부 인증/결제 서비스 장애, 통신 환경 문제 등 회사가 통제하기 어려운 사유로 발생한 손해에 대해서는 책임이 제한될 수 있습니다.',
    ],
  },
  {
    title: '6. 문의',
    body: [
      '약관 관련 문의나 서비스 운영 문의가 있는 경우, 서비스 내 별도 안내 채널 또는 운영자가 고지한 연락 수단을 통해 접수할 수 있습니다.',
    ],
  },
];

export default function TermsPage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="max-w-3xl space-y-6">
        <PageHero
          badges={
            <Badge className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
              Legal
            </Badge>
          }
          title="이용약관"
          description="간지사주 이용과 코인 결제, 계정 사용, 책임 제한에 관한 기본 조건을 안내합니다."
        />

        <div className="space-y-5">
          {sections.map(section => (
            <SectionSurface
              key={section.title}
              size="md"
            >
              <h2 className="mb-3 text-lg font-semibold text-[var(--app-ink)]">{section.title}</h2>
              <div className="space-y-3 text-sm leading-6 text-[var(--app-copy)]">
                {section.body.map(paragraph => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </SectionSurface>
          ))}
        </div>
      </AppPage>
    </AppShell>
  );
}
