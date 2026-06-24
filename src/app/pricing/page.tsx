// Redesign 2026-05-17 — design system component (GangiIntro / GangiListLink / GangiMiniCard /
// GangiPageHeader / GangiSection / GangiActionRow) 기반 가격 비교 페이지. design system
// component 안에 시각 일관성 있는 token 적용 — sibling /credits / /membership 페이지와 통일.
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
// 2026-05-16 — 활성 멤버십 plan 을 표시해 중복 결제 진입 차단.
import { getManagedSubscription } from '@/lib/subscription';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export const metadata: Metadata = {
  title: '가격 한눈보기',
  description: '간지사주의 무료 운세, 9,900원 단품 풀이, 코인팩, 멤버십을 한 화면에서 비교합니다.',
  alternates: {
    canonical: '/pricing',
  },
};

const CREDIT_PACKAGES = PAYMENT_PACKAGES.filter((item) => item.kind === 'credits' || item.id === 'subscription_30');
const DIALOGUE_PLANS = PLAN_BLUEPRINT.filter((plan) => plan.slug !== 'lifetime');
// 2026-06-07 — 선생 12명 전원 활성(dialogue/전용 기능 연결). 과거 '출시 예정'
//   필터는 coming-soon 선생이 사라져 불필요 → 전체 사용.
const FALLBACK_TEACHERS = GANGI_TEACHERS;

function getProductTeacher(index: number) {
  return FALLBACK_TEACHERS[index % FALLBACK_TEACHERS.length] ?? GANGI_TEACHERS[0];
}

export default async function PricingPage() {
  // 2026-05-16 — 활성 멤버십 plan 조회. plan 카드에 "이용 중" + 결제 링크 비활성.
  let activeMembershipPlan: string | null = null;
  if (hasSupabaseServerEnv && hasSupabaseServiceEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const subscription = await getManagedSubscription(user.id);
      if (subscription && subscription.status === 'active') {
        activeMembershipPlan = subscription.plan;
      }
    }
  }
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
          description="오늘운세와 타로는 무료로 시작하고, 더 궁금한 질문만 9,900원 단품으로 이어볼 수 있습니다."
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
                    <h2 className="mt-2 text-xl font-bold leading-7 text-[var(--app-ink)]">{plan.title}</h2>
                    <p className="mt-2 text-base font-medium leading-6 text-[rgba(17,17,20,0.64)]">{plan.summary}</p>
                  </div>
                  <strong className="shrink-0 text-base font-bold text-[var(--app-pink-strong)]">{plan.price}</strong>
                </div>
                <div className="gangi-mini-grid">
                  {plan.opens.slice(0, 3).map((item, index) => (
                    <GangiMiniCard key={item} label={String(index + 1).padStart(2, '0')} desc={item} />
                  ))}
                </div>
                {(() => {
                  // 2026-05-16 — 활성 멤버십 plan 이면 결제 link 대신 결제내역 link.
                  const subscriptionPlanId =
                    plan.slug === 'premium'
                      ? 'premium_monthly'
                      : plan.slug === 'basic'
                        ? 'plus_monthly'
                        : null;
                  const isActive =
                    subscriptionPlanId !== null &&
                    activeMembershipPlan === subscriptionPlanId;
                  if (isActive) {
                    return (
                      <Link
                        href="/my/billing"
                        className={plan.slug === 'premium' ? 'gangi-primary-button mt-4' : 'gangi-secondary-button mt-4'}
                      >
                        ✓ 이용 중 · 결제 내역
                      </Link>
                    );
                  }
                  return (
                    <Link
                      href="/membership/checkout?plan=premium&from=pricing"
                      className="gangi-primary-button mt-4"
                    >
                      프리미엄 보기
                    </Link>
                  );
                })()}
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
