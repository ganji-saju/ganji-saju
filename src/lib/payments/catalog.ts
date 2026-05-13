import type { PlanSlug } from '@/content/moonlight';
import {
  PERSONALITY_COMPATIBILITY_MINI_NAME,
  PERSONALITY_COMPATIBILITY_MINI_PACKAGE_ID,
  PERSONALITY_COMPATIBILITY_MINI_PRICE,
  PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/personality-compatibility';
import {
  SAJU_PERSONALITY_MINI_NAME,
  SAJU_PERSONALITY_MINI_PACKAGE_ID,
  SAJU_PERSONALITY_MINI_PRICE,
  SAJU_PERSONALITY_MINI_PRODUCT_CODE,
} from '@/lib/payments/saju-personality';

export type PaymentPackageKind = 'credits' | 'subscription' | 'lifetime_report' | 'taste_product';
export type SubscriptionPlan = 'plus_monthly' | 'premium_monthly';
export type TasteProductId =
  | 'today-detail'
  | 'love-question'
  | 'money-pattern'
  | 'work-flow'
  | 'monthly-calendar'
  | 'year-core'
  | typeof PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE
  | typeof SAJU_PERSONALITY_MINI_PRODUCT_CODE;

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
  requiresScope?: boolean;
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
    id: PERSONALITY_COMPATIBILITY_MINI_PACKAGE_ID,
    name: PERSONALITY_COMPATIBILITY_MINI_NAME,
    credits: 0,
    price: PERSONALITY_COMPATIBILITY_MINI_PRICE,
    kind: 'taste_product',
    tasteProductId: PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
    requiresScope: true,
  },
  {
    id: SAJU_PERSONALITY_MINI_PACKAGE_ID,
    name: SAJU_PERSONALITY_MINI_NAME,
    credits: 0,
    price: SAJU_PERSONALITY_MINI_PRICE,
    kind: 'taste_product',
    tasteProductId: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
    requiresScope: true,
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
  [PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE]: PERSONALITY_COMPATIBILITY_MINI_PACKAGE_ID,
  [SAJU_PERSONALITY_MINI_PRODUCT_CODE]: SAJU_PERSONALITY_MINI_PACKAGE_ID,
};

export function isTasteProductId(value: unknown): value is TasteProductId {
  return (
    value === 'today-detail' ||
    value === 'love-question' ||
    value === 'money-pattern' ||
    value === 'work-flow' ||
    value === 'monthly-calendar' ||
    value === 'year-core' ||
    value === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE ||
    value === SAJU_PERSONALITY_MINI_PRODUCT_CODE
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

export function isTasteProductPackage(
  pkg: PaymentPackage
): pkg is PaymentPackage & { tasteProductId: TasteProductId } {
  return pkg.kind === 'taste_product' && isTasteProductId(pkg.tasteProductId);
}

export function formatWon(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function formatPaymentPackagePrice(pkg: PaymentPackage) {
  const price = formatWon(pkg.price);
  return pkg.kind === 'subscription' && pkg.planSlug ? `월 ${price}` : price;
}

// P1-2 fix (audit 2026-05-13): UI 하드코딩 가격(13+ 곳)을 카탈로그 SSOT 로 통일.
// 9가지 표기 패턴(`550원`, `550원~`, `550원 풀이`, `오늘 자세히 보기 · 550원`, ...) 을
// 단일 헬퍼로 처리해 카탈로그 가격 변경 시 자동 동기화한다.
export type PriceLabelStyle =
  | 'simple'        // "550원"
  | 'from'          // "550원~"
  | 'at-least'      // "550원 이상"
  | 'monthly'       // "월 4,900원"
  | 'with-suffix';  // "550원 풀이" — caller appends suffix

export function formatPriceLabel(
  pkgOrId: PaymentPackage | string,
  style: PriceLabelStyle = 'simple'
): string {
  const pkg = typeof pkgOrId === 'string' ? getPackage(pkgOrId) : pkgOrId;
  if (!pkg) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[formatPriceLabel] unknown package: ${String(pkgOrId)}`);
    }
    return '';
  }
  const won = formatWon(pkg.price);
  switch (style) {
    case 'from':       return `${won}~`;
    case 'at-least':   return `${won} 이상`;
    case 'monthly':    return `월 ${won}`;
    case 'with-suffix':
    case 'simple':
    default:           return won;
  }
}
