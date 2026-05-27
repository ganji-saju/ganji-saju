import type { PlanSlug } from '@/content/moonlight';

export type PaymentPackageKind =
  | 'credits'
  | 'subscription'
  | 'lifetime_report'
  | 'taste_product'
  | 'bundle';
export type SubscriptionPlan = 'plus_monthly' | 'premium_monthly';
export type CreditGrantType = 'purchase' | 'subscription';
export type TasteProductId =
  | 'today-detail'
  | 'love-question'
  | 'money-pattern'
  | 'work-flow'
  | 'monthly-calendar'
  | 'year-core'
  | 'score-factor'
  // 2026-05-23 ① — 궁합 1회권(커플 단위). love-question(글로벌·연애 마음 확인)과 분리.
  | 'compat-reading';

// 묶음(bundle) 구성품. kind='bundle' 패키지가 결제되면 confirm 이 components 를
// 순회하며 각 구성품을 개별 taste_product 로 grant 한다(1결제 = N권한). scope 는
// 고정 scope(예: score-factor 의 'F1') — 미지정 시 결제 scope 를 상속.
export interface BundleComponent {
  tasteProductId: TasteProductId;
  scope?: string | null;
}

export interface PaymentPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  kind: PaymentPackageKind;
  planSlug?: PlanSlug;
  subscriptionPlan?: SubscriptionPlan;
  tasteProductId?: TasteProductId;
  requiresSlug?: boolean;
  components?: readonly BundleComponent[];
}

export const PAYMENT_PACKAGES = [
  { id: 'credit_1', name: '체험 1 코인', credits: 1, price: 500, kind: 'credits' },
  { id: 'credit_3', name: '스타터 3 코인', credits: 3, price: 990, kind: 'credits' },
  { id: 'credit_7', name: '기본 7 코인', credits: 7, price: 2000, kind: 'credits' },
  {
    id: 'subscription_30',
    name: '보너스 36 코인',
    credits: 36,
    price: 9900,
    kind: 'subscription',
  },
  {
    id: 'membership_plus',
    name: '라이트 대화 멤버십',
    credits: 2,
    price: 4900,
    kind: 'subscription',
    planSlug: 'basic',
    subscriptionPlan: 'plus_monthly',
  },
  {
    id: 'membership_premium',
    name: '프리미엄 대화 멤버십',
    credits: 10,
    price: 9900,
    kind: 'subscription',
    planSlug: 'premium',
    subscriptionPlan: 'premium_monthly',
  },
  {
    id: 'lifetime_report',
    name: '보관형 사주 리포트',
    credits: 0,
    price: 49000,
    kind: 'lifetime_report',
    planSlug: 'lifetime',
    requiresSlug: true,
  },
  {
    id: 'taste_today_detail',
    name: '오늘 자세히 보기',
    credits: 0,
    price: 550,
    kind: 'taste_product',
    tasteProductId: 'today-detail',
    requiresSlug: true,
  },
  {
    id: 'taste_love_question',
    name: '연애 마음 확인',
    credits: 0,
    price: 990,
    kind: 'taste_product',
    tasteProductId: 'love-question',
  },
  {
    id: 'taste_money_pattern',
    name: '돈이 새는 패턴',
    credits: 0,
    price: 990,
    kind: 'taste_product',
    tasteProductId: 'money-pattern',
  },
  {
    id: 'taste_work_flow',
    name: '일/직장 흐름',
    credits: 0,
    price: 990,
    kind: 'taste_product',
    tasteProductId: 'work-flow',
  },
  {
    id: 'taste_monthly_calendar',
    name: '월간 달력',
    credits: 0,
    price: 1900,
    kind: 'taste_product',
    tasteProductId: 'monthly-calendar',
    requiresSlug: true,
  },
  {
    id: 'taste_year_core',
    name: '올해 핵심 3줄',
    credits: 0,
    price: 3900,
    kind: 'taste_product',
    tasteProductId: 'year-core',
    requiresSlug: true,
  },
  {
    // 2026-05-22 — 점수 산출내역 per-factor 풀이(F1~F5). factor 는 scope 로 인코딩.
    id: 'taste_score_factor',
    name: '점수 풀이 보기',
    credits: 0,
    price: 550,
    kind: 'taste_product',
    tasteProductId: 'score-factor',
    requiresSlug: true,
  },
  {
    // 2026-05-23 ① — 궁합 1회권(커플 단위). slug 에 커플 키를 실어 compat:{coupleKey} scope 로 grant.
    //   기존 990원 글로벌 love-question 구매자는 게이트에서 grandfather(별도 처리).
    id: 'taste_compat_reading',
    name: '궁합 깊은 풀이',
    credits: 0,
    price: 990,
    kind: 'taste_product',
    tasteProductId: 'compat-reading',
    requiresSlug: true,
  },
  {
    // 2026-05-23 — 티어 A 묶음. today-detail + 점수 풀이 F1~F5 전체를 990원에.
    // confirm 이 components 를 순회해 6개 entitlement 를 개별 grant(1결제 = N권한).
    id: 'bundle_today_set',
    name: '오늘 풀세트',
    credits: 0,
    price: 990,
    kind: 'bundle',
    requiresSlug: true,
    components: [
      { tasteProductId: 'today-detail' },
      { tasteProductId: 'score-factor', scope: 'F1' },
      { tasteProductId: 'score-factor', scope: 'F2' },
      { tasteProductId: 'score-factor', scope: 'F3' },
      { tasteProductId: 'score-factor', scope: 'F4' },
      { tasteProductId: 'score-factor', scope: 'F5' },
    ],
  },
] as const satisfies readonly PaymentPackage[];

export type PackageId = (typeof PAYMENT_PACKAGES)[number]['id'];

const MEMBERSHIP_PACKAGE_BY_PLAN: Record<PlanSlug, PackageId> = {
  basic: 'membership_plus',
  premium: 'membership_premium',
  lifetime: 'lifetime_report',
};

const TASTE_PACKAGE_BY_PRODUCT: Record<TasteProductId, PackageId> = {
  'today-detail': 'taste_today_detail',
  'love-question': 'taste_love_question',
  'money-pattern': 'taste_money_pattern',
  'work-flow': 'taste_work_flow',
  'monthly-calendar': 'taste_monthly_calendar',
  'year-core': 'taste_year_core',
  'score-factor': 'taste_score_factor',
  'compat-reading': 'taste_compat_reading',
};

export function isTasteProductId(value: unknown): value is TasteProductId {
  return (
    value === 'today-detail' ||
    value === 'love-question' ||
    value === 'money-pattern' ||
    value === 'work-flow' ||
    value === 'monthly-calendar' ||
    value === 'year-core' ||
    value === 'score-factor' ||
    value === 'compat-reading'
  );
}

export function getPackage(id: unknown): PaymentPackage | undefined {
  if (typeof id !== 'string') return undefined;
  return PAYMENT_PACKAGES.find((pkg) => pkg.id === id);
}

export function getMembershipPackage(plan: PlanSlug) {
  return getPackage(MEMBERSHIP_PACKAGE_BY_PLAN[plan]);
}

export function getTasteProductPackage(product: TasteProductId) {
  return getPackage(TASTE_PACKAGE_BY_PRODUCT[product]);
}

export function isSubscriptionPackage(
  pkg: PaymentPackage
): pkg is PaymentPackage & { subscriptionPlan: SubscriptionPlan } {
  return pkg.kind === 'subscription' && Boolean(pkg.planSlug) && Boolean(pkg.subscriptionPlan);
}

export function getCreditGrantType(pkg: PaymentPackage): CreditGrantType {
  return isSubscriptionPackage(pkg) ? 'subscription' : 'purchase';
}

export function isTasteProductPackage(
  pkg: PaymentPackage
): pkg is PaymentPackage & { tasteProductId: TasteProductId } {
  return pkg.kind === 'taste_product' && isTasteProductId(pkg.tasteProductId);
}

export function isBundlePackage(
  pkg: PaymentPackage
): pkg is PaymentPackage & { components: readonly BundleComponent[] } {
  return pkg.kind === 'bundle' && Array.isArray(pkg.components) && pkg.components.length > 0;
}

export function formatWon(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function formatPaymentPackagePrice(pkg: PaymentPackage) {
  const price = formatWon(pkg.price);
  return pkg.kind === 'subscription' && pkg.planSlug ? `월 ${price}` : price;
}
