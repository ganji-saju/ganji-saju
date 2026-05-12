import Link from 'next/link';
import type { Metadata } from 'next';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { LightSection } from '@/components/moonlight/LightSection';
import { PageIntro } from '@/components/moonlight/PageIntro';
import { PricingRow } from '@/components/moonlight/PricingRow';
import { SafetyNotice } from '@/components/moonlight/SafetyNotice';
import SiteHeader from '@/features/shared-navigation/site-header';
import { PLAN_BLUEPRINT, TASTE_PRODUCTS } from '@/content/moonlight';
import {
  formatPaymentPackagePrice,
  getMembershipPackage,
} from '@/lib/payments/catalog';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

const LIFETIME_REPORT_PACKAGE = getMembershipPackage('lifetime');
const LIFETIME_REPORT_PRICE = LIFETIME_REPORT_PACKAGE
  ? formatPaymentPackagePrice(LIFETIME_REPORT_PACKAGE)
  : '49,000원';

const COLLECTIBLE_REPORTS = [
  {
    slug: 'life-standard',
    title: '보관형 사주 리포트',
    price: LIFETIME_REPORT_PRICE,
    summary: '타고난 성향, 올해 흐름, 선택 힌트를 한 번에 정리합니다.',
    href: '/saju/new?plan=lifetime',
    zodiac: 'dragon' as const,
  },
  {
    slug: 'yearly-2026',
    title: '올해 흐름 리포트',
    price: '준비 중',
    summary: '진행하기 좋은 달, 확인할 달, 쉬어갈 달을 먼저 봅니다.',
    href: '/saju/new?focus=year',
    zodiac: 'tiger' as const,
  },
  {
    slug: 'relationship-standard',
    title: '궁합 보관 리포트',
    price: '준비 중',
    summary: '두 사람의 속도, 거리감, 반복되는 갈등을 정리합니다.',
    href: '/compatibility/input?product=relationship-standard',
    zodiac: 'sheep' as const,
  },
  {
    slug: 'family-report',
    title: '가족 흐름 리포트',
    price: '준비 중',
    summary: '가족 안에서 반복되는 역할과 부딪힘을 함께 봅니다.',
    href: '/membership?focus=family-report',
    zodiac: 'pig' as const,
  },
] as const;

const DIALOGUE_PLANS = PLAN_BLUEPRINT.filter((plan) => plan.slug !== 'lifetime');

export const metadata: Metadata = {
  title: '멤버십',
  description: '달빛인생의 소액 풀이, 보관형 리포트, 대화 멤버십을 한 화면에서 비교하세요.',
  alternates: {
    canonical: '/membership',
  },
};

export default async function MembershipPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const focus = resolvedSearchParams.focus;

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="상품" backHref="/" />

        <PageIntro
          eyebrow="상품 안내"
          title="무료로 시작하고, 필요한 만큼만 깊게 봅니다"
          description="무료 운세를 먼저 보고, 마음에 남는 질문만 990원 깊이보기·보관형 리포트·대화 멤버십으로 이어가세요."
          actions={
            <>
              <Link href="/today-fortune?concern=general" className="gangi-primary-button">
                무료 오늘운세 보기
              </Link>
              <Link href="/pricing" className="gangi-secondary-button">
                가격 한눈보기
              </Link>
            </>
          }
        />

        <LightSection
          eyebrow="소액 풀이"
          title="궁금한 것 하나만 먼저"
          description="큰 결제 전에 오늘 궁금한 질문 하나를 짧게 확인하는 입구입니다."
          surface="soft"
        >
          <div className="grid gap-3">
            {TASTE_PRODUCTS.map((product) => (
              <PricingRow
                key={product.slug}
                href={product.href}
                title={product.title}
                description={product.question}
                price={product.price}
                ctaLabel="열기"
              />
            ))}
          </div>
        </LightSection>

        <LightSection
          eyebrow="보관형 풀이"
          title="오래 다시 볼 내용은 리포트로"
          description="한 번 보고 사라지는 운세보다, 다시 열어볼 수 있는 정리본이 필요할 때 고릅니다."
        >
          <div className="grid gap-3">
            {COLLECTIBLE_REPORTS.map((report) => (
              <PricingRow
                key={report.slug}
                href={report.href}
                title={report.title}
                description={report.summary}
                price={report.price}
                ctaLabel={focus === report.slug ? '선택됨' : '보기'}
                emphasis={focus === report.slug}
              />
            ))}
          </div>
        </LightSection>

        <LightSection
          eyebrow="대화 멤버십"
          title="풀이를 읽고 계속 묻고 싶을 때"
          description="멤버십은 무작정 무제한을 앞세우기보다, 이미 본 풀이를 생활 질문으로 이어가는 용도입니다."
        >
          <div className="grid gap-3">
            {DIALOGUE_PLANS.map((plan) => (
              <PricingRow
                key={plan.slug}
                eyebrow={plan.badge}
                title={plan.title}
                description={plan.summary}
                price={plan.price}
                href={'/membership/checkout?plan=' + plan.slug + '&from=membership'}
                ctaLabel={plan.slug === 'premium' ? '프리미엄' : '라이트'}
                emphasis={plan.slug === 'premium'}
              />
            ))}
          </div>
        </LightSection>

        <SafetyNotice />
      </AppPage>
    </AppShell>
  );
}
