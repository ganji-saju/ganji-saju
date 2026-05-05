import Link from 'next/link';
import type { Metadata } from 'next';
import TossMembershipCheckout from '@/components/membership/toss-membership-checkout';
import { ActionCluster } from '@/components/layout/action-cluster';
import { BulletList } from '@/components/layout/bullet-list';
import { FeatureCard } from '@/components/layout/feature-card';
import { ProductGrid } from '@/components/layout/product-grid';
import { SectionHeader } from '@/components/layout/section-header';
import { SectionSurface } from '@/components/layout/section-surface';
import {
  GangiIntro,
  GangiPageHeader,
  GangiPurchaseSummary,
} from '@/components/gangi/gangi-ui';
import {
  CHECKOUT_PLAN_GUIDE,
  CHECKOUT_METHODS,
  MEMBERSHIP_REASSURANCE,
  type PlanSlug,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  formatPaymentPackagePrice,
  getMembershipPackage,
  getTasteProductPackage,
  isTasteProductId,
  isTasteProductPackage,
  type TasteProductId,
} from '@/lib/payments/catalog';
import {
  buildMonthlyCalendarScopeKey,
  buildReadingProductScopeKey,
  buildTodayDetailScopeKey,
  getTasteProductEntitlement,
} from '@/lib/product-entitlements';
import { toSlug } from '@/lib/saju/pillars';
import { resolveReading } from '@/lib/saju/readings';
import {
  createClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';
import { AppPage, AppShell } from '@/shared/layout/app-shell';

interface Props {
  searchParams: Promise<{
    plan?: string;
    product?: string;
    slug?: string;
    scope?: string;
    error?: string;
    from?: string;
  }>;
}

const CHECKOUT_FLOW_POINTS = [
  '선택한 상품이 대화형 멤버십인지, 보관형 리포트인지 먼저 다시 확인합니다.',
  '결제 방법은 카드와 계좌이체 중에서 고르실 수 있고, 승인 뒤 이용권이 바로 반영됩니다.',
  '결과와 연결되는 상품은 해당 결과 식별자가 있는지 마지막으로 살펴봅니다.',
] as const;

function normalizePlanSlug(value?: string): PlanSlug {
  if (value === 'plus') return 'basic';
  if (value === 'basic' || value === 'premium' || value === 'lifetime') return value;
  return 'premium';
}

type CheckoutGuide = {
  title: string;
  price: string;
  reassurance: string;
  nextRange: string;
  opens: string[];
  notices: string[];
};

const TASTE_PRODUCT_GUIDE: Record<TasteProductId, CheckoutGuide> = {
  'today-detail': {
    title: '오늘 자세히 보기',
    price: '550원',
    reassurance: '오늘 만든 무료 결과에서 걸리는 부분만 조금 더 여는 소액 풀이입니다. 같은 오늘운을 다시 열 때 중복 차감하지 않습니다.',
    nextRange: '오늘 핵심, 조심할 것, 바로 할 행동까지 짧게 열립니다.',
    opens: ['오늘 자세히 보기', '이미 구매한 오늘운 재열람', '대화로 이어 묻기'],
    notices: ['오늘 자세히 보기는 현재 결과 식별자와 연결됩니다.', '다시 열 때는 구매 여부를 먼저 확인합니다.'],
  },
  'love-question': {
    title: '연애 마음 확인',
    price: '990원',
    reassurance: '상대의 마음, 내 마음, 다시 말 걸 타이밍을 부담 없이 먼저 열 수 있는 소액 풀이입니다.',
    nextRange: '상대와의 거리감, 연락 타이밍, 오늘의 말투를 봅니다.',
    opens: ['연애 질문 풀이', '궁합 입력 화면', '대화 연결'],
    notices: ['로그인하지 않아도 입력은 가능하지만, 구매 저장은 로그인 기준으로 남습니다.', '구매 후에는 checkout에서 중복 결제를 막습니다.'],
  },
  'money-pattern': {
    title: '돈이 새는 패턴',
    price: '990원',
    reassurance: '재물운을 크게 말하기보다 오늘부터 줄일 수 있는 지출 습관을 먼저 봅니다.',
    nextRange: '돈이 새는 장면, 조심할 소비, 지킬 행동을 짧게 봅니다.',
    opens: ['재물 질문 풀이', '사주 입력 흐름', '대화 연결'],
    notices: ['소액 풀이 구매 상태는 로그인 기준으로 저장됩니다.', '같은 상품을 다시 열 때 구매 여부를 먼저 확인합니다.'],
  },
  'work-flow': {
    title: '일/직장 흐름',
    price: '990원',
    reassurance: '직장운을 길게 풀기보다 오늘의 말, 역할, 움직일 타이밍을 짧게 봅니다.',
    nextRange: '오늘 일에서 조심할 말, 유리한 태도, 다음 선택을 봅니다.',
    opens: ['일 질문 풀이', '사주 입력 흐름', '대화 연결'],
    notices: ['소액 풀이 구매 상태는 로그인 기준으로 저장됩니다.', '같은 상품을 다시 열 때 구매 여부를 먼저 확인합니다.'],
  },
  'monthly-calendar': {
    title: '월간 달력',
    price: '1,900원',
    reassurance: '선택한 사주 결과와 월에 붙는 달력형 해금입니다. 이미 연 달은 다시 코인을 쓰지 않습니다.',
    nextRange: '좋은 날, 확인할 날, 결정일을 달력으로 봅니다.',
    opens: ['선택한 월간 달력', '해당 월 재열람', '긴 사주풀이로 이어보기'],
    notices: ['월간 달력은 결과와 월 정보가 있어야 연결됩니다.', '보관형 리포트 권한이 있으면 별도 결제 없이 열립니다.'],
  },
  'year-core': {
    title: '올해 핵심 3줄',
    price: '3,900원',
    reassurance: '선택한 사주 결과에 붙는 올해 요약 상품입니다. 결제 뒤 올해 전략 흐름으로 바로 이동합니다.',
    nextRange: '올해 핵심 주제, 주의 패턴, 밀어도 되는 달을 먼저 봅니다.',
    opens: ['올해 전략 요약', '연간 흐름 보기', '긴 사주풀이로 이어보기'],
    notices: ['올해 핵심은 특정 사주 결과에 연결됩니다.', '전체 보관형 리포트와는 별도 상품입니다.'],
  },
};

function parseYearMonthScope(scope?: string) {
  const match = scope?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  return { year, month };
}

async function resolveTasteScopeKey(product: TasteProductId, slug?: string, scope?: string) {
  if (product === 'love-question' || product === 'money-pattern' || product === 'work-flow') return null;
  if (!slug) return null;
  if (product === 'today-detail') return buildTodayDetailScopeKey(slug);

  const reading = await resolveReading(slug);
  const readingKey = reading ? toSlug(reading.input) : slug;

  if (product === 'monthly-calendar') {
    const yearMonth = parseYearMonthScope(scope);
    return yearMonth
      ? buildMonthlyCalendarScopeKey(readingKey, yearMonth.year, yearMonth.month)
      : buildReadingProductScopeKey(readingKey);
  }

  return buildReadingProductScopeKey(readingKey);
}

function buildAlreadyPurchasedHref(product: TasteProductId, slug?: string) {
  if (product === 'today-detail') return `/today-fortune?paid=${product}`;
  if (product === 'love-question') return '/compatibility/input?relationship=lover&paid=love-question';
  if (product === 'money-pattern') return '/saju/new?focus=wealth&paid=money-pattern';
  if (product === 'work-flow') return '/saju/new?focus=career&paid=work-flow';
  if (slug && product === 'monthly-calendar') return `/saju/${encodeURIComponent(slug)}/premium#fortune-calendar`;
  if (slug && product === 'year-core') return `/saju/${encodeURIComponent(slug)}/premium#yearly-report`;
  return '/membership';
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '결제',
    description: '선택한 플랜의 결제 정보를 마지막으로 확인하는 화면입니다.',
  };
}

export default async function MembershipCheckoutPage({ searchParams }: Props) {
  const { plan, product, slug, scope, error, from } = await searchParams;
  const selectedProduct = isTasteProductId(product) ? product : null;
  const selectedPlan = normalizePlanSlug(plan);
  const selected = selectedProduct
    ? TASTE_PRODUCT_GUIDE[selectedProduct]
    : CHECKOUT_PLAN_GUIDE[selectedPlan] ?? CHECKOUT_PLAN_GUIDE.premium;
  const paymentPackage = selectedProduct
    ? getTasteProductPackage(selectedProduct)
    : getMembershipPackage(selectedPlan);
  const displayPrice = paymentPackage
    ? formatPaymentPackagePrice(paymentPackage)
    : selected.price;
  let alreadyPurchasedHref: string | null = null;

  if (
    selectedProduct &&
    paymentPackage &&
    isTasteProductPackage(paymentPackage) &&
    hasSupabaseServerEnv &&
    hasSupabaseServiceEnv
  ) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const scopeKey = await resolveTasteScopeKey(selectedProduct, slug, scope);
      const entitlement = await getTasteProductEntitlement(user.id, selectedProduct, scopeKey);
      if (entitlement) alreadyPurchasedHref = buildAlreadyPurchasedHref(selectedProduct, slug);
    }
  }

  const needsResultFirst = Boolean(paymentPackage?.requiresSlug && !slug);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage space-y-6">
        <GangiPageHeader title="결제" backHref="/membership" />
        <GangiIntro
          eyebrow="결제 확인"
          title={
            <>
              결제 전에
              <br />
              열리는 내용을 확인해요
            </>
          }
          description="가격과 바로 열리는 내용을 먼저 확인하고, 실제 결제는 아래 버튼에서 진행합니다."
        />

        <section className="px-4 sm:px-0">
          <GangiPurchaseSummary
            title={selected.title}
            price={displayPrice}
            description={selected.reassurance}
            opens={selected.opens}
          />
          <div className="gangi-card-panel mt-4 p-4">
            <SectionHeader
              eyebrow="결제 전 체크"
              title="한 번 더 확인할 내용"
              titleClassName="text-2xl"
              description="결제 버튼을 누르기 전에 상품 성격과 다시 볼 위치만 짧게 확인합니다."
              descriptionClassName="text-[var(--app-copy)]"
            />
            <BulletList items={CHECKOUT_FLOW_POINTS} />
            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="안심 안내"
              description={MEMBERSHIP_REASSURANCE.join(' ')}
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="결제 방법"
              title="카드와 계좌이체 중에서 고르실 수 있습니다"
              titleClassName="text-3xl"
              description="기본으로 가장 많이 쓰는 방법을 먼저 보여드리고, 결제창 안에서 다시 바꾸실 수도 있습니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            <ProductGrid columns={2} className="mt-6">
              {CHECKOUT_METHODS.map((method, index) => (
                <FeatureCard
                  key={method}
                  surface="soft"
                  eyebrow={index === 0 ? '기본 선택' : '선택 가능'}
                  title={method}
                />
              ))}
            </ProductGrid>

            {error === 'payment' ? (
              <FeatureCard
                className="mt-5 border-rose-400/25 bg-rose-400/10"
                surface="soft"
                eyebrow="다시 확인"
                description="결제가 완료되지 않았습니다. 결제창을 닫으셨거나 승인에 실패했을 수 있습니다."
              />
            ) : null}

            <FeatureCard
              className="mt-5"
              surface="soft"
              eyebrow="한 번 더 살펴보실 것"
              description={
                <BulletList
                  items={selected.notices}
                  className="mt-0"
                  itemClassName="text-[var(--app-copy)]"
                />
              }
            />
          </SectionSurface>

          <SectionSurface surface="panel" size="lg">
            <SectionHeader
              eyebrow="결제 진행"
              title="이제 결제를 열면 됩니다"
              titleClassName="text-3xl"
              description="결과에 연결되는 상품은 필요한 식별자가 있는지 먼저 확인한 뒤 결제를 엽니다."
              descriptionClassName="max-w-3xl text-[var(--app-copy)]"
            />

            {paymentPackage?.kind === 'lifetime_report' && !slug ? (
              <FeatureCard
                className="mt-6"
                surface="soft"
                eyebrow="결과 식별자가 필요합니다"
                description="보관형 사주 리포트는 특정 사주 결과에 붙는 소장권입니다. 먼저 사주 결과를 만든 뒤, 해당 결과의 긴 풀이 보기 버튼으로 오시면 결제 직후 바로 전체 리포트가 열립니다."
                footer={
                  <ActionCluster>
                    <Link
                      href="/saju/new"
                      className="gangi-primary-button"
                    >
                      사주 결과 먼저 만들기
                    </Link>
                  </ActionCluster>
                }
              />
            ) : needsResultFirst && selectedProduct ? (
              <FeatureCard
                className="mt-6"
                surface="soft"
                eyebrow="결과 식별자가 필요합니다"
                description="이 소액 상품은 특정 사주 결과나 오늘운 결과에 연결됩니다. 먼저 결과를 만든 뒤, 해당 화면의 구매 버튼으로 오시면 중복 결제 없이 바로 연결됩니다."
                footer={
                  <ActionCluster>
                    <Link
                      href={`/saju/new?product=${selectedProduct}`}
                      className="gangi-primary-button"
                    >
                      사주 결과 먼저 만들기
                    </Link>
                    <Link
                      href="/membership"
                      className="gangi-secondary-button"
                    >
                      상품 목록으로
                    </Link>
                  </ActionCluster>
                }
              />
            ) : alreadyPurchasedHref ? (
              <FeatureCard
                className="mt-6 border-emerald-400/25 bg-emerald-400/10"
                surface="soft"
                eyebrow="이미 구매한 상품"
                description="이 상품은 이미 구매되어 있습니다. 결제창을 다시 열지 않고 바로 열람 화면으로 이동하실 수 있습니다."
                footer={
                  <ActionCluster>
                    <Link
                      href={alreadyPurchasedHref}
                      className="gangi-primary-button"
                    >
                      구매한 상품 열기
                    </Link>
                    <Link
                      href="/my/billing"
                      className="gangi-secondary-button"
                    >
                      결제 상태 확인
                    </Link>
                  </ActionCluster>
                }
              />
            ) : paymentPackage ? (
              <div className="mt-6">
                <TossMembershipCheckout
                  packageId={paymentPackage.id}
                  plan={selectedPlan}
                  product={selectedProduct ?? undefined}
                  amount={paymentPackage.price}
                  orderName={paymentPackage.name}
                  slug={slug}
                  scope={scope}
                  entrySource={from ?? 'membership'}
                />
              </div>
            ) : (
              <FeatureCard
                className="mt-6 border-rose-400/25 bg-rose-400/10"
                surface="soft"
                eyebrow="결제 정보를 찾지 못했습니다"
                description="선택한 플랜의 결제 설정을 불러오지 못했습니다. 멤버십 화면으로 돌아가 다시 선택해 주세요."
              />
            )}
          </SectionSurface>
        </section>
      </AppPage>
    </AppShell>
  );
}
