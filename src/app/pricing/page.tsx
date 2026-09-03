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
import { ReportTrustNotes } from '@/components/trust/report-trust-notes';
import SiteHeader from '@/features/shared-navigation/site-header';
import { PLAN_BLUEPRINT, TASTE_PRODUCTS } from '@/content/moonlight';
import { isPaywallLockdown } from '@/lib/paywall-lockdown';
import { getPriceDisplayMap } from '@/lib/payments/price-display';
import {
  priceLabelFromMap,
  compareLabelFromMap,
  tasteProductPriceKey,
  planPriceKey,
} from '@/lib/payments/price-display-shared';
// 2026-05-16 — 활성 멤버십 plan 을 표시해 중복 결제 진입 차단.
import { getManagedSubscription } from '@/lib/subscription';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

export async function generateMetadata(): Promise<Metadata> {
  const entry = priceLabelFromMap(await getPriceDisplayMap(), 'saju_entry');
  return {
    title: '가격 한눈보기',
    description: isPaywallLockdown()
      ? `간지사주의 ${entry} 단품 풀이와 멤버십을 한 화면에서 비교합니다.`
      : `간지사주의 무료 운세, ${entry} 단품 풀이, 멤버십을 한 화면에서 비교합니다.`,
    alternates: {
      canonical: '/pricing',
    },
  };
}

const DIALOGUE_PLANS = PLAN_BLUEPRINT.filter((plan) => plan.slug !== 'lifetime');
// 2026-06-07 — 선생 12명 전원 활성(dialogue/전용 기능 연결). 과거 '출시 예정'
//   필터는 coming-soon 선생이 사라져 불필요 → 전체 사용.
const FALLBACK_TEACHERS = GANGI_TEACHERS;

function getProductTeacher(index: number) {
  return FALLBACK_TEACHERS[index % FALLBACK_TEACHERS.length] ?? GANGI_TEACHERS[0];
}

export default async function PricingPage() {
  const priceMap = await getPriceDisplayMap();
  const entryLabel = priceLabelFromMap(priceMap, 'saju_entry');
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

        {/* 2026-08-11 — /pricing 은 잠긴 무료 경로가 전부 착지하는 곳이다. 여기에 "무료로
            먼저 보기" 히어로가 남아 있으면 눌러도 다시 이 페이지로 되돌아오는 루프가 된다. */}
        {isPaywallLockdown() ? (
          <GangiIntro
            eyebrow="가격 한눈보기"
            title={
              <>
                필요한 풀이만
                <br />
                하나씩 열어요
              </>
            }
            description={`궁금한 질문 하나부터 ${entryLabel} 단품으로 확인하고, 자주 보신다면 멤버십으로 이어가실 수 있습니다.`}
          >
            <GangiActionRow>
              <Link href="/saju/new?product=today-detail" className="gangi-primary-button">
                내 사주 풀이 시작
              </Link>
              <Link href="/membership" className="gangi-secondary-button">
                멤버십 보기
              </Link>
            </GangiActionRow>
          </GangiIntro>
        ) : (
          <GangiIntro
            eyebrow="가격 한눈보기"
            title={
              <>
                가볍게 먼저 보고
                <br />
                필요한 풀이만 열어요
              </>
            }
            // 2026-08-31 — 오늘운세·타로는 당일권 유료(8/25~28 전환). "무료" 카피는 거짓이라 제거.
            description={`오늘운세와 타로는 당일권으로 가볍게 시작하고, 더 궁금한 질문만 ${entryLabel} 단품으로 이어볼 수 있습니다.`}
          >
            <GangiActionRow>
              <Link href="/today-fortune?concern=general" className="gangi-primary-button">
                오늘운세 보기
              </Link>
              <Link href="/tarot/daily" className="gangi-secondary-button">
                타로 보기
              </Link>
            </GangiActionRow>
          </GangiIntro>
        )}

        {/* 2026-08-26 — 잠금 중 모든 잠긴 경로가 여기 착지하는데 '왜 여기서 사야 하나'가
            한 줄도 없었다(자격·환불·샘플 0건). 가격 카드보다 먼저 답한다. */}
        <ReportTrustNotes />

        <GangiSection
          eyebrow="작게 열어보기"
          title="지금 질문 하나만 짧게 확인"
          description={
            isPaywallLockdown()
              ? '전문 상품명보다 사용자가 실제로 묻는 질문으로 정리했습니다. 궁금한 질문 하나만 골라 여실 수 있습니다.'
              : '전문 상품명보다 사용자가 실제로 묻는 질문으로 정리했습니다. 무료 결과를 본 뒤 자연스럽게 이어지는 상품입니다.'
          }
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
                  price={priceLabelFromMap(priceMap, tasteProductPriceKey(product.slug))}
                  compareLabel={compareLabelFromMap(priceMap, tasteProductPriceKey(product.slug))}
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
                  <strong className="shrink-0 text-base font-bold text-[var(--app-pink-strong)]">
                    {priceLabelFromMap(priceMap, planPriceKey(plan.slug))}
                  </strong>
                </div>
                <div className="gangi-mini-grid">
                  {plan.opens.slice(0, 3).map((item, index) => (
                    <GangiMiniCard key={item} label={String(index + 1).padStart(2, '0')} desc={item} />
                  ))}
                </div>
                {(() => {
                  // 2026-09-03 — `w-full` 필수. 전역 버튼에서 `width: 100%` 를 뺐고
                  //   이 CTA 의 부모(.gangi-card-panel)는 블록이라, 안 붙이면 결제 버튼이
                  //   글자 폭(~102px)으로 쪼그라든다. 그리드/flex-column 안 버튼들과 달리
                  //   여기만 stretch 가 안 걸린다.
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
                        className={plan.slug === 'premium' ? 'gangi-primary-button mt-4 w-full' : 'gangi-secondary-button mt-4 w-full'}
                      >
                        ✓ 이용 중 · 결제 내역
                      </Link>
                    );
                  }
                  return (
                    <Link
                      href="/membership/checkout?plan=premium&from=pricing"
                      className="gangi-primary-button mt-4 w-full"
                    >
                      프리미엄 보기
                    </Link>
                  );
                })()}
              </article>
            ))}
          </div>
        </GangiSection>
      </AppPage>
    </AppShell>
  );
}
