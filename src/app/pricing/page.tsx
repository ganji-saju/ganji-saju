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
  PAYMENT_PACKAGES,
  formatWon,
} from '@/lib/payments/catalog';
import { PERSONALITY_COMPATIBILITY_MINI_PRICE } from '@/lib/payments/personality-compatibility';
import { SAJU_PERSONALITY_MINI_PRICE } from '@/lib/payments/saju-personality';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '가격 한눈보기',
  description: '달빛인생의 무료 운세, 550원/990원 소액 풀이, 코인팩, 멤버십을 한 화면에서 비교합니다.',
  alternates: {
    canonical: '/pricing',
  },
};

const CREDIT_PACKAGES = PAYMENT_PACKAGES.filter((item) => item.kind === 'credits' || item.id === 'subscription_30');
const DIALOGUE_PLANS = PLAN_BLUEPRINT.filter((plan) => plan.slug !== 'lifetime');

export default function PricingPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="가격" backHref="/" />

        <PageIntro
          eyebrow="가격 한눈보기"
          title="무료로 먼저 보고 필요한 풀이만 열어요"
          description="오늘운세와 타로는 무료로 시작하고, 더 궁금한 질문만 550원/990원 단위로 가볍게 이어볼 수 있습니다."
          actions={
            <>
              <Link href="/today-fortune?concern=general" className="gangi-primary-button">
                무료 오늘운세 보기
              </Link>
              <Link href="/tarot/daily" className="gangi-secondary-button">
                무료 타로 보기
              </Link>
            </>
          }
        />

        <LightSection
          eyebrow="Flow"
          title="무료 → 990원 깊이보기 → 멤버십"
          description="가격표를 상품 나열보다 사용 흐름 중심으로 정리했습니다."
          surface="soft"
        >
          <div className="grid gap-3">
            <PricingRow
              eyebrow="Free"
              title="오늘운세 · 타로 한 장"
              description="먼저 가볍게 확인하고, 필요한 경우에만 이어봅니다."
              price="무료"
              href="/free"
              ctaLabel="무료 시작"
            />
            <PricingRow
              eyebrow="Mini"
              badge="NEW"
              title="달빛 성향사주 깊이보기"
              description="사주 네 기둥과 16유형 성향을 함께 본 개인 리포트입니다."
              price={formatWon(SAJU_PERSONALITY_MINI_PRICE)}
              href="/saju/personality"
              ctaLabel="미리보기"
              emphasis
            />
            <PricingRow
              eyebrow="Mini"
              badge="HOT"
              title="달빛 성향궁합 깊이보기"
              description="두 사람의 사주와 성향을 함께 본 관계 리포트입니다."
              price={formatWon(PERSONALITY_COMPATIBILITY_MINI_PRICE)}
              href="/compatibility/personality"
              ctaLabel="미리보기"
              emphasis
            />
            <PricingRow
              eyebrow="Membership"
              title="대화 멤버십"
              description="풀이를 본 뒤 생활 질문으로 계속 이어 묻고 싶을 때 선택합니다."
              price="월 구독"
              href="/membership"
              ctaLabel="비교"
            />
          </div>
        </LightSection>

        <LightSection
          eyebrow="소액 풀이"
          title="그 밖의 짧은 깊이보기"
          description="무료 결과를 본 뒤 특정 질문만 더 열어볼 때 사용합니다."
        >
          <div className="grid gap-3">
            {TASTE_PRODUCTS.map((product) => (
              <PricingRow
                key={product.slug}
                title={product.title}
                description={product.question}
                price={product.price}
                href={product.href}
                ctaLabel="열기"
              />
            ))}
          </div>
        </LightSection>

        <LightSection
          eyebrow="대화 멤버십"
          title="풀이를 본 뒤 계속 묻고 싶을 때"
          description="멤버십은 결과를 대신하는 상품이 아니라, 이미 본 풀이를 생활 질문으로 이어가는 선택지입니다."
        >
          <div className="grid gap-3">
            {DIALOGUE_PLANS.map((plan) => (
              <PricingRow
                key={plan.slug}
                eyebrow={plan.badge}
                title={plan.title}
                description={plan.summary}
                price={plan.price}
                href={
                  plan.slug === 'premium'
                    ? '/membership/checkout?plan=premium&from=pricing'
                    : '/membership/checkout?plan=basic&from=pricing'
                }
                ctaLabel={plan.slug === 'premium' ? '프리미엄' : '라이트'}
                emphasis={plan.slug === 'premium'}
              />
            ))}
          </div>
        </LightSection>

        <LightSection
          eyebrow="코인팩"
          title="필요한 만큼만 충전"
          description="코인은 일부 깊이보기와 달력 기능에 사용합니다. 이미 연 항목은 다시 결제하지 않는 흐름으로 이어갑니다."
        >
          <div className="grid gap-3">
            {CREDIT_PACKAGES.map((pack) => (
              <PricingRow
                key={pack.id}
                href="/credits"
                title={pack.name}
                description={String(pack.credits) + '코인 충전권'}
                price={formatWon(pack.price)}
                ctaLabel="충전"
              />
            ))}
          </div>
        </LightSection>

        <SafetyNotice />
      </AppPage>
    </AppShell>
  );
}
