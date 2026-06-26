// Redesign 2026-05-13 (Claude Design / screens-c.jsx ScreenCheckout):
// pink-soft 주문 요약 + 금액 breakdown + 토스 결제 method + 안내 + Toss 위젯.
// 데이터·라우팅·결제 위젯 무수정.
import Link from 'next/link';
import type { Metadata } from 'next';
import TossMembershipCheckout from '@/components/membership/toss-membership-checkout';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import { ZodiacChip, type ZodiacKey } from '@/components/gangi/zodiac-chip';
import {
  CHECKOUT_PLAN_GUIDE,
  type PlanSlug,
} from '@/content/moonlight';
import SiteHeader from '@/features/shared-navigation/site-header';
import {
  formatPaymentPackagePrice,
  getMembershipPackage,
  getPackage,
  getTasteProductPackage,
  isBundlePackage,
  isTasteProductId,
  isTasteProductPackage,
  type TasteProductId,
} from '@/lib/payments/catalog';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { checkTodayDetailAccess } from '@/lib/saju/today-detail-access';
import { getLifetimeReportEntitlement } from '@/lib/report-entitlements';
import {
  buildPurchasedProductHref,
  resolvePaymentProductScope,
} from '@/lib/payments/product-scope';
// 2026-05-16 — 멤버십 구독 중복 결제 차단을 위해 현재 활성 구독 조회.
import { getManagedSubscription } from '@/lib/subscription';
import { isSubscriptionPackage } from '@/lib/payments/catalog';
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
  '카드 또는 계좌이체로 결제합니다.',
  '결제가 끝나면 구매한 풀이가 바로 열립니다.',
  '이미 구매한 풀이는 다시 결제하지 않고 보관함에서 볼 수 있습니다.',
] as const;

const TASTE_PRODUCT_ZODIAC: Record<TasteProductId, ZodiacKey> = {
  'today-detail': 'snake',
  'love-question': 'rabbit',
  'money-pattern': 'monkey',
  'work-flow': 'tiger',
  'monthly-calendar': 'rooster',
  'year-core': 'sheep',
  'score-factor': 'dragon',
  'score-total': 'dragon',
  'compat-reading': 'pig',
};

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
    price: '9,900원',
    reassurance:
      '오늘 만든 무료 결과에서 걸리는 부분만 조금 더 여는 단품 풀이입니다. 같은 오늘운을 다시 열 때 중복 차감하지 않습니다.',
    nextRange: '오늘 핵심, 조심할 것, 바로 할 행동까지 짧게 열립니다.',
    opens: ['오늘 자세히 보기', '이미 구매한 오늘운 재열람', '대화로 이어 묻기'],
    notices: [
      '오늘 자세히 보기는 현재 결과 식별자와 연결됩니다.',
      '다시 열 때는 구매 여부를 먼저 확인합니다.',
    ],
  },
  'score-factor': {
    title: '점수 풀이 보기',
    price: '9,900원',
    reassurance:
      '점수 산출 내역 한 항목의 자세한 풀이를 여는 단품 풀이입니다. 같은 항목은 다시 결제하지 않습니다.',
    nextRange: '선택한 항목(일주·격국·용신·오행·합충신살)의 구체 풀이와 활용 가이드가 열립니다.',
    opens: ['선택한 항목 자세한 풀이', '이미 구매한 항목 재열람', '대화로 이어 묻기'],
    notices: [
      '점수 풀이는 현재 사주 결과 + 항목 단위로 연결됩니다.',
      '다시 열 때는 구매 여부를 먼저 확인합니다.',
    ],
  },
  'score-total': {
    title: '사주 점수 공개',
    price: '9,900원',
    reassurance:
      '종합점수와 5요소 산출 내역 전체를 한 번에 엽니다. 같은 결과는 다시 결제하지 않습니다.',
    nextRange: '종합점수·등급 + 일주·격국·용신·오행·신살 5요소 풀이가 모두 열립니다.',
    opens: ['종합점수·등급 공개', '5요소 산출 내역 전체', '이미 구매한 결과 재열람'],
    notices: [
      '점수 공개는 현재 사주 결과 단위로 연결됩니다.',
      '다시 열 때는 구매 여부를 먼저 확인합니다.',
    ],
  },
  'love-question': {
    title: '연애 마음 확인',
    price: '9,900원',
    reassurance:
      '상대의 마음, 내 마음, 다시 말 걸 타이밍을 부담 없이 먼저 열 수 있는 단품 풀이입니다.',
    nextRange: '상대와의 거리감, 연락 타이밍, 오늘의 말투를 봅니다.',
    opens: ['연애 질문 풀이', '궁합 입력 화면', '대화 연결'],
    notices: [
      '로그인하지 않아도 입력은 가능하지만, 구매 저장은 로그인 계정에 남습니다.',
      '구매 후에는 checkout에서 중복 결제를 막습니다.',
    ],
  },
  'compat-reading': {
    title: '궁합 깊은 풀이',
    price: '9,900원',
    reassurance:
      '두 사람의 사주를 함께 본 깊은 궁합 풀이입니다. 한 번 결제하면 같은 두 사람의 풀이는 다시 결제하지 않습니다.',
    nextRange: '두 사람의 흐름, 잘 맞는 부분, 조심할 장면, 오늘부터 해볼 행동을 봅니다.',
    opens: ['두 사람 궁합 깊은 풀이', '같은 두 사람 재열람', '대화로 이어 묻기'],
    notices: [
      '궁합 풀이는 두 사람의 생년월일에 연결됩니다.',
      '같은 두 사람을 다시 열 때는 구매 여부를 먼저 확인합니다.',
    ],
  },
  'money-pattern': {
    title: '돈이 새는 패턴',
    price: '9,900원',
    reassurance: '재물운을 크게 말하기보다 오늘부터 줄일 수 있는 지출 습관을 먼저 봅니다.',
    nextRange: '돈이 새는 장면, 조심할 소비, 지킬 행동을 짧게 봅니다.',
    opens: ['재물 질문 풀이', '사주 입력 흐름', '대화 연결'],
    notices: [
      '단품 풀이 구매 상태는 로그인 계정에 저장됩니다.',
      '같은 상품을 다시 열 때 구매 여부를 먼저 확인합니다.',
    ],
  },
  'work-flow': {
    title: '일/직장 흐름',
    price: '9,900원',
    reassurance: '직장운을 길게 풀기보다 오늘의 말, 역할, 움직일 타이밍을 짧게 봅니다.',
    nextRange: '오늘 일에서 조심할 말, 유리한 태도, 다음 선택을 봅니다.',
    opens: ['일 질문 풀이', '사주 입력 흐름', '대화 연결'],
    notices: [
      '단품 풀이 구매 상태는 로그인 계정에 저장됩니다.',
      '같은 상품을 다시 열 때 구매 여부를 먼저 확인합니다.',
    ],
  },
  'monthly-calendar': {
    title: '월간 달력',
    price: '9,900원',
    reassurance:
      '선택한 사주 결과와 월에 붙는 달력형 해금입니다. 이미 연 달은 다시 결제하지 않습니다.',
    nextRange: '좋은 날, 확인할 날, 결정일을 달력으로 봅니다.',
    opens: ['선택한 월간 달력', '해당 월 재열람', '긴 사주풀이로 이어보기'],
    notices: [
      '월간 달력은 결과와 월 정보가 있어야 연결됩니다.',
      '보관형 리포트 권한이 있으면 별도 결제 없이 열립니다.',
    ],
  },
  'year-core': {
    title: '올해 핵심 3줄',
    price: '9,900원',
    reassurance:
      '선택한 사주 결과에 붙는 올해 요약 상품입니다. 결제 뒤 올해 전략 흐름으로 바로 이동합니다.',
    nextRange: '올해 핵심 주제, 주의 패턴, 진행하기 좋은 달을 먼저 봅니다.',
    opens: ['올해 전략 요약', '연간 흐름 보기', '긴 사주풀이로 이어보기'],
    notices: [
      '올해 핵심은 특정 사주 결과에 연결됩니다.',
      '전체 보관형 리포트와는 별도 상품입니다.',
    ],
  },
};

// 묶음(bundle) 상품 안내. packageId 키. TASTE_PRODUCT_GUIDE 는 단일 TasteProductId 만
// 다루므로 묶음은 별도 맵으로 분리(타입 충돌 회피).
const BUNDLE_GUIDE: Record<string, CheckoutGuide> = {
  bundle_today_set: {
    title: '오늘 풀세트',
    price: '9,900원',
    reassurance:
      '오늘 자세히 보기와 점수 풀이 5항목(개별 6종)을 한 번에 여는 묶음입니다. 이미 구매한 항목은 다시 결제하지 않습니다.',
    nextRange: '오늘 자세히 + 일주·격국·용신·오행·합충신살 점수 풀이가 함께 열립니다.',
    opens: ['오늘 자세히 보기', '점수 5항목 풀이', '대화로 이어 묻기'],
    notices: [
      '묶음은 현재 사주 결과에 연결됩니다.',
      '이미 구매한 항목은 중복 결제하지 않습니다.',
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: '결제',
    description: '선택한 플랜의 결제 정보를 마지막으로 확인하는 화면입니다.',
  };
}

export default async function MembershipCheckoutPage({ searchParams }: Props) {
  const { plan, product, slug, scope, error, from } = await searchParams;
  const selectedProduct = isTasteProductId(product) ? product : null;
  // 묶음(bundle)은 product param 에 packageId(예: 'bundle_today_set')로 진입한다.
  const candidateBundle = !selectedProduct && product ? getPackage(product) : undefined;
  const selectedBundle =
    candidateBundle && isBundlePackage(candidateBundle) ? candidateBundle : null;
  const selectedPlan = normalizePlanSlug(plan);
  const selected = selectedProduct
    ? TASTE_PRODUCT_GUIDE[selectedProduct]
    : selectedBundle
      ? BUNDLE_GUIDE[selectedBundle.id] ?? CHECKOUT_PLAN_GUIDE.premium
      : CHECKOUT_PLAN_GUIDE[selectedPlan] ?? CHECKOUT_PLAN_GUIDE.premium;
  const paymentPackage = selectedProduct
    ? getTasteProductPackage(selectedProduct)
    : selectedBundle
      ? selectedBundle
      : getMembershipPackage(selectedPlan);
  const displayPrice = paymentPackage
    ? formatPaymentPackagePrice(paymentPackage)
    : selected.price;
  const headerZodiac: ZodiacKey = selectedProduct
    ? TASTE_PRODUCT_ZODIAC[selectedProduct] ?? 'dragon'
    : 'dragon';
  let alreadyPurchasedHref: string | null = null;
  // 2026-05-16 — 이미 활성 중인 멤버십 구독을 다시 결제하면 토스 결제창에서
  //   "no healthy upstream" 류 회귀가 발생하는 사용자 보고. checkout 단계에서
  //   현재 활성 멤버십 plan 을 미리 확인해 중복 결제 시도 자체를 차단한다.
  let activeMembershipPlan: string | null = null;

  if (paymentPackage && hasSupabaseServerEnv && hasSupabaseServiceEnv) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const paymentScope = await resolvePaymentProductScope({ pkg: paymentPackage, slug, scope });
      if (selectedProduct && isTasteProductPackage(paymentPackage)) {
        // today-detail 은 checkTodayDetailAccess(readingKey 안정 + legacy readingId + coin)로
        //   통일 — 사주 재생성·경로 교차로 slug 가 바뀌어도 인식해 재결제(무한반복)를 막는다.
        const purchased =
          selectedProduct === 'today-detail'
            ? (await checkTodayDetailAccess(slug ?? '')).hasAccess
            : Boolean(
                await getTasteProductEntitlement(
                  user.id,
                  selectedProduct,
                  paymentScope?.scopeKey ?? null
                )
              );
        if (purchased) {
          alreadyPurchasedHref = buildPurchasedProductHref(selectedProduct, slug, {
            from,
            scope,
          });
        }
      } else if (paymentPackage.kind === 'lifetime_report' && paymentScope?.readingKey) {
        const entitlement = await getLifetimeReportEntitlement(
          user.id,
          paymentScope.readingKey,
          paymentScope.slug ? [paymentScope.slug] : []
        );
        if (entitlement) {
          alreadyPurchasedHref = buildPurchasedProductHref('lifetime-report', slug, {
            from,
            scope,
          });
        }
      } else if (isSubscriptionPackage(paymentPackage)) {
        // 멤버십(라이트/프리미엄) 활성 구독 보유 시 중복 결제 차단.
        // - 같은 플랜 활성 → "이미 이용 중" 안내
        // - 다른 플랜 활성 → 상향/하향 안내 (현재는 동일 처리, 추후 plan change 흐름 도입 시 분기 가능)
        const subscription = await getManagedSubscription(user.id);
        if (subscription && subscription.status === 'active' && subscription.plan === paymentPackage.subscriptionPlan) {
          activeMembershipPlan = subscription.plan;
        }
      }
    }
  }

  const needsResultFirst = Boolean(paymentPackage?.requiresSlug && !slug);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5 pb-32">
        <GangiPageHeader title="결제" backHref="/membership" />

        <section className="space-y-5 px-1">
          {/* §1 주문 요약 — pink-soft + ZodiacChip + 상품 */}
          <article
            className="rounded-[18px] border border-[var(--app-line)] p-5"
            style={{ background: 'var(--app-pink-soft)' }}
          >
            <div className="flex items-center gap-3">
              <ZodiacChip kind={headerZodiac} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                  {selectedProduct
                    ? '단품 풀이'
                    : selectedBundle
                      ? '묶음 상품'
                      : `${selectedPlan.toUpperCase()} 멤버십`}
                </div>
                <div className="mt-1 text-[17.8px] font-extrabold leading-tight tracking-tight text-[var(--app-ink)]">
                  {selected.title}
                </div>
                <p className="mt-1.5 text-[13.8px] leading-[1.55] text-[var(--app-copy-muted)]">
                  {selected.reassurance}
                </p>
              </div>
            </div>
            {selected.opens.length > 0 ? (
              <ul className="mt-3 grid gap-1.5">
                {selected.opens.slice(0, 3).map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-[13.8px] leading-[1.55] text-[var(--app-copy)]"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: 'var(--app-pink)' }}
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          {/* §2 결제 금액 breakdown */}
          <section>
            <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">결제 금액</h2>
            <article className="mt-3 rounded-[14px] border border-[var(--app-line)] bg-white p-4">
              <div className="flex items-center justify-between border-b border-[var(--app-line)] py-2">
                <span className="text-[15px] text-[var(--app-copy)]">상품 금액</span>
                <span className="text-[15.5px] font-bold text-[var(--app-ink)]">
                  {displayPrice}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[15px] text-[var(--app-copy)]">할인 / 쿠폰</span>
                <span className="text-[15.5px] font-bold text-[var(--app-copy-soft)]">
                  결제창에서 적용
                </span>
              </div>
              <div
                className="mt-2 flex items-center justify-between pt-3"
                style={{ borderTop: '1px solid var(--app-ink)' }}
              >
                <span className="text-[16.1px] font-extrabold text-[var(--app-ink)]">
                  최종 결제 금액
                </span>
                <span className="text-[25.3px] font-extrabold tracking-tight text-[var(--app-pink-strong)]">
                  {displayPrice}
                </span>
              </div>
            </article>
          </section>

          {/* §3 결제 수단 안내 */}
          <section>
            <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">결제 수단</h2>
            <article
              className="mt-3 flex items-center gap-3 rounded-[14px] border-2 p-3.5"
              style={{
                borderColor: 'var(--app-pink)',
                background: 'var(--app-pink-soft)',
              }}
            >
              <div
                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-[16.1px] font-black text-white"
                style={{ background: 'var(--app-pink)' }}
                aria-hidden="true"
              >
                💳
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16.1px] font-extrabold text-[var(--app-ink)]">
                  카드 · 계좌이체 결제
                </div>
                <p className="mt-0.5 text-[13.2px] text-[var(--app-copy-soft)]">
                  결제창에서 카드 · 계좌이체 · 간편결제 중 선택
                </p>
              </div>
              <span
                className="grid h-5 w-5 place-items-center rounded-full"
                style={{ border: '6px solid var(--app-pink)', background: '#fff' }}
                aria-hidden="true"
              />
            </article>
          </section>

          {error === 'payment' ? (
            <p className="rounded-[12px] border border-[var(--app-coral)]/30 bg-[var(--app-coral)]/10 px-3.5 py-2.5 text-[14.4px] leading-relaxed text-[var(--app-ink)]">
              결제가 완료되지 않았습니다. 결제창을 닫으셨거나 승인에 실패했을 수 있습니다.
            </p>
          ) : null}

          {/* §4 결제 안내 */}
          <section>
            <h2 className="text-[18.4px] font-extrabold text-[var(--app-ink)]">결제 안내</h2>
            <ul className="mt-3 grid gap-1.5">
              {[...CHECKOUT_FLOW_POINTS, ...selected.notices.slice(0, 2)].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[14.4px] leading-[1.55] text-[var(--app-copy-muted)]"
                >
                  <span aria-hidden="true">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* §5 결제 액션 — TossMembershipCheckout 또는 empty-state */}
          <section>
            <article className="rounded-[18px] border border-[var(--app-pink-line)] bg-white p-5">
              {paymentPackage?.kind === 'lifetime_report' && !slug ? (
                <div className="grid gap-3 text-center">
                  <strong className="text-[17.3px] font-extrabold text-[var(--app-ink)]">
                    먼저 사주 결과가 필요합니다
                  </strong>
                  <p className="text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
                    이 풀이는 특정 사주 결과에 붙습니다. 결과를 만든 뒤 다시 결제하면 바로 연결됩니다.
                  </p>
                  <Link
                    href="/saju/new"
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white"
                  >
                    사주 결과 먼저 만들기
                  </Link>
                </div>
              ) : needsResultFirst && selectedProduct ? (
                <div className="grid gap-3 text-center">
                  <strong className="text-[17.3px] font-extrabold text-[var(--app-ink)]">
                    먼저 결과를 만들어 주세요
                  </strong>
                  <p className="text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
                    단품 풀이는 결과 화면에 연결됩니다. 결과를 만든 뒤 해당 버튼으로 오면 중복 결제를 막습니다.
                  </p>
                  <Link
                    href={`/saju/new?product=${selectedProduct}`}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white"
                  >
                    사주 결과 먼저 만들기
                  </Link>
                  <Link
                    href="/membership"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-5 py-2.5 text-[14.4px] font-bold text-[var(--app-copy-muted)]"
                  >
                    상품 목록으로
                  </Link>
                </div>
              ) : alreadyPurchasedHref ? (
                <div className="grid gap-3 text-center">
                  <strong className="text-[17.3px] font-extrabold text-[var(--app-jade)]">
                    이미 구매한 풀이입니다
                  </strong>
                  <p className="text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
                    결제창을 다시 열지 않고 바로 열람 화면으로 이동합니다.
                  </p>
                  <Link
                    href={alreadyPurchasedHref}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white"
                  >
                    구매한 풀이 열기
                  </Link>
                  <Link
                    href="/my/billing"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-5 py-2.5 text-[14.4px] font-bold text-[var(--app-copy-muted)]"
                  >
                    결제 상태 확인
                  </Link>
                </div>
              ) : activeMembershipPlan ? (
                // 2026-05-16 — 활성 멤버십 상태에서 같은 plan 결제 시도 차단.
                <div className="grid gap-3 text-center">
                  <strong className="text-[17.3px] font-extrabold text-[var(--app-jade)]">
                    이미 이용 중인 멤버십입니다
                  </strong>
                  <p className="text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
                    중복 결제를 막기 위해 결제창을 열지 않습니다. 결제 상태와 다음
                    갱신일은 결제 내역에서 확인해 주세요.
                  </p>
                  <Link
                    href="/my/billing"
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white"
                  >
                    결제 내역 보기
                  </Link>
                  <Link
                    href="/membership"
                    className="inline-flex items-center justify-center rounded-full border border-[var(--app-line)] bg-white px-5 py-2.5 text-[14.4px] font-bold text-[var(--app-copy-muted)]"
                  >
                    멤버십 화면으로
                  </Link>
                </div>
              ) : paymentPackage ? (
                <>
                  <p className="text-[12.6px] font-extrabold uppercase tracking-[0.04em] text-[var(--app-pink-strong)]">
                    결제창 열기
                  </p>
                  <h3 className="mt-1 text-[20.7px] font-extrabold leading-snug text-[var(--app-ink)]">
                    {displayPrice} 결제하기 →
                  </h3>
                  <div className="mt-3">
                    <TossMembershipCheckout
                      packageId={paymentPackage.id}
                      plan={selectedPlan}
                      product={selectedProduct ?? selectedBundle?.id}
                      amount={paymentPackage.price}
                      orderName={paymentPackage.name}
                      slug={slug}
                      scope={scope}
                      entrySource={from ?? 'membership'}
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-3 text-center">
                  <strong className="text-[17.3px] font-extrabold text-[var(--app-ink)]">
                    결제 정보를 찾지 못했습니다
                  </strong>
                  <p className="text-[14.4px] leading-[1.6] text-[var(--app-copy-muted)]">
                    멤버십 화면으로 돌아가 다시 선택해 주세요.
                  </p>
                  <Link
                    href="/membership"
                    className="inline-flex items-center justify-center rounded-full bg-[var(--app-pink)] px-5 py-3 text-[16.1px] font-extrabold text-white"
                  >
                    상품 다시 선택
                  </Link>
                </div>
              )}
            </article>
          </section>
        </section>
      </AppPage>
    </AppShell>
  );
}
