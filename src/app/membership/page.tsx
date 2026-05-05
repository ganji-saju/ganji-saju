import Link from 'next/link';
import type { Metadata } from 'next';
import { SafetyNotice } from '@/components/common/safety-notice';
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
    summary: '밀어도 되는 달, 확인할 달, 쉬어갈 달을 먼저 봅니다.',
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
const ACTIVE_TEACHERS = GANGI_TEACHERS.filter((teacher) => teacher.price !== '준비 중');

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

        <GangiIntro
          eyebrow="상품 안내"
          title={
            <>
              오늘은 가볍게,
              <br />
              필요하면 깊게 봅니다
            </>
          }
          description="무료 운세를 먼저 보고, 마음에 남는 질문만 소액 풀이·보관형 리포트·대화 멤버십으로 이어가세요."
        >
          <GangiActionRow>
            <Link href="/today-fortune?concern=general" className="gangi-primary-button">
              무료 오늘운세 보기
            </Link>
            <Link href="/pricing" className="gangi-secondary-button">
              가격 한눈보기
            </Link>
          </GangiActionRow>
        </GangiIntro>

        <GangiSection
          eyebrow="소액 풀이"
          title="궁금한 것 하나만 먼저"
          description="큰 결제 전에 오늘 궁금한 질문 하나를 짧게 확인하는 입구입니다."
          tone="pink"
        >
          <div className="grid gap-3">
            {TASTE_PRODUCTS.map((product, index) => {
              const teacher = ACTIVE_TEACHERS[index % ACTIVE_TEACHERS.length] ?? GANGI_TEACHERS[0];
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
          eyebrow="보관형 풀이"
          title="오래 다시 볼 내용은 리포트로"
          description="한 번 보고 사라지는 운세보다, 다시 열어볼 수 있는 정리본이 필요할 때 고릅니다."
        >
          <div className="grid gap-3">
            {COLLECTIBLE_REPORTS.map((report) => (
              <Link
                key={report.slug}
                href={report.href}
                className="gangi-list-link"
                data-active={focus === report.slug ? 'true' : undefined}
              >
                <span className="gangi-list-copy">
                  <strong>{report.title}</strong>
                  <em>{report.summary}</em>
                </span>
                <span className="gangi-list-price">{report.price}</span>
              </Link>
            ))}
          </div>
        </GangiSection>

        <GangiSection
          eyebrow="대화 멤버십"
          title="풀이를 읽고 계속 묻고 싶을 때"
          description="멤버십은 무작정 무제한을 앞세우기보다, 이미 본 풀이를 생활 질문으로 이어가는 용도입니다."
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
                  href={'/membership/checkout?plan=' + plan.slug + '&from=membership'}
                  className={plan.slug === 'premium' ? 'gangi-primary-button mt-4' : 'gangi-secondary-button mt-4'}
                >
                  {plan.slug === 'premium' ? '프리미엄 보기' : '라이트 보기'}
                </Link>
              </article>
            ))}
          </div>
        </GangiSection>

        <section className="mx-4">
          <SafetyNotice variant="general" />
        </section>
      </AppPage>
    </AppShell>
  );
}
