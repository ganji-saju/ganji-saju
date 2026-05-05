import Link from 'next/link';
import type { Metadata } from 'next';
import {
  GANGI_TEACHERS,
  GangiActionRow,
  GangiIntro,
  GangiListLink,
  GangiMiniCard,
  GangiPageHeader,
  GangiSection,
} from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { PLAN_BLUEPRINT, TASTE_PRODUCTS } from '@/content/moonlight';
import {
  PAYMENT_PACKAGES,
  formatWon,
} from '@/lib/payments/catalog';
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
const FALLBACK_TEACHERS = GANGI_TEACHERS.filter((teacher) => teacher.price !== '준비 중');

function getProductTeacher(index: number) {
  return FALLBACK_TEACHERS[index % FALLBACK_TEACHERS.length] ?? GANGI_TEACHERS[0];
}

export default function PricingPage() {
  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-5">
        <GangiPageHeader title="가격" backHref="/" />

        <GangiIntro
          eyebrow="가격 한눈보기"
          title={
            <>
              무료로 먼저 보고
              <br />
              필요한 풀이만 열어요
            </>
          }
          description="오늘운세와 타로는 무료로 시작하고, 더 궁금한 질문만 550원/990원 단위로 가볍게 이어볼 수 있습니다."
        >
          <GangiActionRow>
            <Link href="/today-fortune?concern=general" className="gangi-primary-button">
              무료 오늘운세 보기
            </Link>
            <Link href="/tarot/daily" className="gangi-secondary-button">
              무료 타로 보기
            </Link>
          </GangiActionRow>
        </GangiIntro>

        <GangiSection
          eyebrow="작게 열어보기"
          title="지금 질문 하나만 짧게 확인"
          description="전문 상품명보다 사용자가 실제로 묻는 질문으로 정리했습니다. 무료 결과를 본 뒤 자연스럽게 이어지는 상품입니다."
          tone="pink"
        >
          <div className="grid gap-3">
            {TASTE_PRODUCTS.map((product, index) => {
              const teacher = getProductTeacher(index);
              return (
                <GangiListLink
                  key={product.slug}
                  href={product.href}
                  zodiac={teacher.zodiac}
                  title={product.title}
                  desc={product.question}
                  price={product.price}
                />
              );
            })}
          </div>
        </GangiSection>

        <GangiSection
          eyebrow="대화 멤버십"
          title="풀이를 본 뒤 계속 묻고 싶을 때"
          description="멤버십은 결과를 대신하는 상품이 아니라, 이미 본 풀이를 생활 질문으로 이어가는 선택지입니다."
        >
          <div className="grid gap-3">
            {DIALOGUE_PLANS.map((plan) => (
              <article key={plan.slug} className="gangi-card-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="gangi-sub-eyebrow">{plan.badge}</p>
                    <h2 className="mt-2 text-lg font-black leading-7 text-[var(--app-ink)]">{plan.title}</h2>
                    <p className="mt-2 text-sm font-bold leading-6 text-[rgba(17,17,20,0.64)]">{plan.summary}</p>
                  </div>
                  <strong className="shrink-0 text-sm font-black text-[var(--app-pink-strong)]">{plan.price}</strong>
                </div>
                <div className="gangi-mini-grid">
                  {plan.opens.slice(0, 3).map((item, index) => (
                    <GangiMiniCard key={item} label={String(index + 1).padStart(2, '0')} desc={item} />
                  ))}
                </div>
                <Link
                  href={
                    plan.slug === 'premium'
                      ? '/membership/checkout?plan=premium&from=pricing'
                      : '/membership/checkout?plan=basic&from=pricing'
                  }
                  className={plan.slug === 'premium' ? 'gangi-primary-button mt-4' : 'gangi-secondary-button mt-4'}
                >
                  {plan.slug === 'premium' ? '프리미엄 보기' : '라이트 보기'}
                </Link>
              </article>
            ))}
          </div>
        </GangiSection>

        <GangiSection
          eyebrow="코인팩"
          title="필요한 만큼만 충전"
          description="코인은 일부 깊이보기와 달력 기능에 사용합니다. 이미 연 항목은 다시 결제하지 않는 흐름으로 이어갑니다."
        >
          <div className="grid gap-3">
            {CREDIT_PACKAGES.map((pack, index) => {
              const teacher = GANGI_TEACHERS[(index + 2) % GANGI_TEACHERS.length];
              return (
                <GangiListLink
                  key={pack.id}
                  href="/credits"
                  zodiac={teacher.zodiac}
                  title={pack.name}
                  desc={String(pack.credits) + '코인 충전권'}
                  price={formatWon(pack.price)}
                />
              );
            })}
          </div>
        </GangiSection>
      </AppPage>
    </AppShell>
  );
}
