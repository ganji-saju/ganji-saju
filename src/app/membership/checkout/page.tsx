import Link from 'next/link';
import type { Metadata } from 'next';
import TossMembershipCheckout from '@/components/membership/toss-membership-checkout';
import {
  GangiIntro,
  GangiPageHeader,
  GangiPurchaseSummary,
} from '@/components/gangi/gangi-ui';
import {
  CHECKOUT_PLAN_GUIDE,
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
import { buildSajuTodayDetailHref } from '@/lib/saju/today-detail-links';
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
  '토스 결제창에서 카드 또는 계좌이체로 결제합니다.',
  '결제가 끝나면 구매한 풀이가 바로 열립니다.',
  '이미 구매한 풀이는 다시 결제하지 않고 보관함에서 볼 수 있습니다.',
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
    nextRange: '올해 핵심 주제, 주의 패턴, 진행하기 좋은 달을 먼저 봅니다.',
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

function buildAlreadyPurchasedHref(product: TasteProductId, slug?: string, entrySource?: string) {
  if (product === 'today-detail') {
    if (slug && entrySource?.startsWith('saju')) return buildSajuTodayDetailHref(slug);

    const params = new URLSearchParams({ paid: product, concern: 'general' });
    if (slug) params.set('sourceSessionId', slug);
    return `/today-fortune/result?${params.toString()}`;
  }
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
      if (entitlement) alreadyPurchasedHref = buildAlreadyPurchasedHref(selectedProduct, slug, from);
    }
  }

  const needsResultFirst = Boolean(paymentPackage?.requiresSlug && !slug);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage gangi-checkout-page space-y-5">
        <GangiPageHeader title="결제" backHref="/membership" />
        <GangiIntro
          title={
            <>
              선택한 풀이를
              <br />
              바로 열어볼게요
            </>
          }
          description="금액과 열리는 내용을 확인한 뒤 토스 결제창에서 진행합니다."
        />

        <section className="space-y-4 px-4 sm:px-0">
          <GangiPurchaseSummary
            title={selected.title}
            price={displayPrice}
            description={selected.reassurance}
            opens={selected.opens}
          />

          <div className="gangi-checkout-method-card">
            <span className="gangi-checkout-method-icon" aria-hidden="true">
              T
            </span>
            <div>
              <strong>토스 결제</strong>
              <p>결제창에서 카드와 계좌이체 중 편한 방식으로 진행합니다.</p>
            </div>
            <span className="gangi-checkout-selected-dot" aria-hidden="true" />
          </div>

          {error === 'payment' ? (
            <p className="gangi-checkout-alert">
              결제가 완료되지 않았습니다. 결제창을 닫으셨거나 승인에 실패했을 수 있습니다.
            </p>
          ) : null}

          <ul className="gangi-checkout-notes">
            {[...CHECKOUT_FLOW_POINTS, ...selected.notices.slice(0, 2)].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="px-4 sm:px-0">
          <div className="gangi-checkout-action-card">
            {paymentPackage?.kind === 'lifetime_report' && !slug ? (
              <div className="gangi-checkout-empty-state">
                <strong>먼저 사주 결과가 필요합니다</strong>
                <p>이 풀이는 특정 사주 결과에 붙습니다. 결과를 만든 뒤 다시 결제하면 바로 연결됩니다.</p>
                <Link href="/saju/new" className="gangi-primary-button">
                  사주 결과 먼저 만들기
                </Link>
              </div>
            ) : needsResultFirst && selectedProduct ? (
              <div className="gangi-checkout-empty-state">
                <strong>먼저 결과를 만들어 주세요</strong>
                <p>소액 풀이는 결과 화면에 연결됩니다. 결과를 만든 뒤 해당 버튼으로 오면 중복 결제를 막습니다.</p>
                <Link href={`/saju/new?product=${selectedProduct}`} className="gangi-primary-button">
                  사주 결과 먼저 만들기
                </Link>
                <Link href="/membership" className="gangi-secondary-button">
                  상품 목록으로
                </Link>
              </div>
            ) : alreadyPurchasedHref ? (
              <div className="gangi-checkout-empty-state gangi-checkout-empty-state-success">
                <strong>이미 구매한 풀이입니다</strong>
                <p>결제창을 다시 열지 않고 바로 열람 화면으로 이동합니다.</p>
                <Link href={alreadyPurchasedHref} className="gangi-primary-button">
                  구매한 풀이 열기
                </Link>
                <Link href="/my/billing" className="gangi-secondary-button">
                  결제 상태 확인
                </Link>
              </div>
            ) : paymentPackage ? (
              <>
                <p className="gangi-checkout-action-title">결제창 열기</p>
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
              </>
            ) : (
              <div className="gangi-checkout-empty-state">
                <strong>결제 정보를 찾지 못했습니다</strong>
                <p>멤버십 화면으로 돌아가 다시 선택해 주세요.</p>
                <Link href="/membership" className="gangi-primary-button">
                  상품 다시 선택
                </Link>
              </div>
            )}
          </div>
        </section>
      </AppPage>
    </AppShell>
  );
}
