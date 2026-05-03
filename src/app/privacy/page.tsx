import type { Metadata } from 'next';
import SiteHeader from '@/features/shared-navigation/site-header';
import { SectionSurface } from '@/components/layout/section-surface';
import { Badge } from '@/components/ui/badge';
import { AppPage, AppShell, PageHero } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description:
    '달빛인생에서 수집하는 개인정보 항목, 이용 목적, 보관 및 보호 정책을 안내합니다.',
  alternates: {
    canonical: '/privacy',
  },
};

const sections = [
  {
    title: '1. 수집하는 정보',
    body: [
      '로그인 과정에서 카카오 또는 Google을 통해 제공되는 계정 식별 정보와 이메일 등 인증에 필요한 최소한의 정보를 처리할 수 있습니다.',
      '서비스 이용 과정에서 사용자가 입력한 생년월일시, 성별, 코인 사용 이력, 결제 결과 정보가 저장될 수 있습니다.',
    ],
  },
  {
    title: '2. 이용 목적',
    body: [
      '사주 분석 결과 제공, 유료 기능 이용 처리, 코인 잔액 관리, 결제 확인 및 고객 문의 대응을 위해 정보를 이용합니다.',
      '서비스 안정성 확보와 부정 이용 방지를 위해 최소한의 로그 및 이용 기록을 활용할 수 있습니다.',
    ],
  },
  {
    title: '3. 보관 및 삭제',
    body: [
      '법령상 보관 의무가 있는 정보를 제외한 개인정보는 서비스 운영 목적 달성 후 지체 없이 파기하는 것을 원칙으로 합니다.',
      '사용자가 계정 삭제 또는 정보 삭제를 요청하는 경우, 관련 법령과 결제 분쟁 대응에 필요한 범위를 제외하고 삭제 절차를 진행할 수 있습니다.',
    ],
  },
  {
    title: '4. 제3자 제공 및 처리 위탁',
    body: [
      '로그인 기능을 위해 외부 인증 제공자와 연동되며, 결제 처리를 위해 결제대행사 및 관련 인프라 서비스가 사용될 수 있습니다.',
      '서비스 운영에 필요한 범위를 넘어 개인정보를 임의로 판매하거나 제공하지 않습니다.',
    ],
  },
  {
    title: '5. 이용자 권리',
    body: [
      '이용자는 본인의 개인정보 열람, 정정, 삭제, 처리 정지 등을 요청할 수 있습니다.',
      '요청이 있는 경우 법령상 제한 사유가 없는 범위에서 합리적인 기간 내 처리합니다.',
    ],
  },
  {
    title: '6. 보호 조치',
    body: [
      '운영자는 접근 통제, 인증 정보 보호, 최소 권한 원칙 등 합리적인 수준의 보호 조치를 적용하기 위해 노력합니다.',
      '다만 인터넷 환경의 특성상 절대적인 보안을 보장할 수는 없으므로, 이용자도 계정 보안에 주의해야 합니다.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <AppShell header={<SiteHeader />} className="pb-24 md:pb-12">
      <AppPage className="max-w-3xl space-y-6">
        <PageHero
          badges={
            <Badge className="border-[var(--app-pink-line)] bg-[var(--app-pink-soft)] text-[var(--app-pink-strong)]">
              Privacy
            </Badge>
          }
          title="개인정보처리방침"
          description="달빛인생이 어떤 정보를 수집하고, 어떤 기준으로 보관·이용하는지 안내합니다."
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
