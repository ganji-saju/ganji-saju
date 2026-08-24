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
  // 2026-06-07 — 사주 점수 단일 언락(종합점수+5요소 전체를 reading 단위 9,900원에).
  //   per-factor(score-factor) 모델 통합. reading scope(reading:{readingKey})로 grant.
  | 'score-total'
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
  // 2026-07-07 Phase 2 — 취소선(compare-at) 마케팅 원가 기본값. 표시 전용(청구 무관).
  //   런타임 오버라이드는 product_prices.previous_price 가 우선(admin 과거가격 입력).
  compareAt?: number;
}

export const PAYMENT_PACKAGES = [
  // 2026-06-23 — 9,900원 단일가 통일에 맞춘 전팩 재편. 전 1개 = 990원(상품 9,900원 = 10전)
  //   기준, 9,900원 결제 시 50% 보너스로 15전 지급. 기존 소액팩(500/990/2,000원 = 1/3/7전)은
  //   폐지(상품이 10전이라 소액팩으론 상품 하나도 못 열고 전당 단가가 역전됨).
  { id: 'credit_15', name: '15 전 (50% 보너스)', credits: 15, price: 9900, kind: 'credits' },
  // 2026-06-23 — 대용량 전팩(벌크 우대). 전당 단가: 15전 660원 > 40전 495원 > 100전 449원.
  { id: 'credit_40', name: '40 전', credits: 40, price: 19800, kind: 'credits' },
  { id: 'credit_100', name: '100 전 (최대 혜택)', credits: 100, price: 44900, kind: 'credits' },
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
    credits: 90,
    price: 49000,
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
    // 2026-07-07 — premium/deep VIP 카드의 취소선 원가(마케팅 앵커, 기존 하드코딩 69,000).
    compareAt: 69000,
  },
  // 2026-07-18 — 3,300원 런칭 이벤트(20260718 PPTX slide5). 메인 카드 4종(사주·대운·택일·궁합)
  //   의 결제 상품만 3,300원으로 내리고 compareAt 9,900 으로 취소선 앵커를 남긴다.
  //   product_prices 오버라이드는 현재 0행이라 이 카탈로그 값이 곧 라이브 청구가.
  //   이벤트 종료는 price 9900 복귀 + compareAt 삭제, 또는 /admin/pricing 에서 런타임 조정.
  {
    id: 'taste_today_detail',
    name: '오늘 자세히 보기',
    credits: 0,
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'today-detail',
    requiresSlug: true,
    compareAt: 9900,
  },
  {
    id: 'taste_love_question',
    name: '연애 마음 확인',
    credits: 0,
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'love-question',
    compareAt: 9900,
  },
  // 2026-07-19 — 3,300원 이벤트에서 **누락돼 있던 두 건**(사용자 제보: /pricing 에서 이 둘만
  //   9,900원으로 떴다). 형제 단품(오늘 자세히·연애·월간달력·올해핵심)과 같은 등급이므로
  //   같은 가격·같은 취소선이어야 한다. product_prices 는 0행이라 이 값이 곧 청구가다.
  {
    id: 'taste_money_pattern',
    name: '돈이 새는 패턴',
    credits: 0,
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'money-pattern',
    compareAt: 9900,
  },
  {
    id: 'taste_work_flow',
    name: '일/직장 흐름',
    credits: 0,
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'work-flow',
    compareAt: 9900,
  },
  {
    id: 'taste_monthly_calendar',
    name: '월간 달력',
    credits: 0,
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'monthly-calendar',
    requiresSlug: true,
    compareAt: 9900,
  },
  {
    id: 'taste_year_core',
    name: '올해 핵심 3줄',
    credits: 0,
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'year-core',
    requiresSlug: true,
    compareAt: 9900,
  },
  {
    // 2026-05-22 — 점수 산출내역 per-factor 풀이(F1~F5). factor 는 scope 로 인코딩.
    //   2026-06-07 — score-total 로 통합되어 신규 노출 없음(grandfather 조회용 inert).
    id: 'taste_score_factor',
    name: '점수 풀이 보기',
    credits: 0,
    price: 9900,
    kind: 'taste_product',
    tasteProductId: 'score-factor',
    requiresSlug: true,
  },
  {
    // 2026-06-07 — 사주 점수 단일 언락. 종합점수+5요소 전체를 reading 단위로 한 번에.
    // 2026-07-20 — 6,600 → 3,300. 모든 단품과 같은 값으로 통일(사용자 지시).
    //   6,600 이던 이유는 묶음(9,900)과의 서열 때문이었다 — 묶음 ≡ today-detail + 점수 언락 이라
    //   점수를 3,300 으로 내리면 따로 사기 합계(6,600)가 묶음보다 싸져 묶음이 무의미해졌다.
    //   이번에 **묶음 자체를 판매 중단**했으므로 그 제약이 사라졌다.
    //   화면에서 다른 단품이 전부 3,300 인데 이것만 6,600 이라 어색하다는 제보가 계기.
    id: 'taste_score_total',
    name: '사주 점수 공개',
    credits: 0,
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'score-total',
    requiresSlug: true,
    compareAt: 9900,
  },
  {
    // 2026-05-23 ① — 궁합 1회권(커플 단위). slug 에 커플 키를 실어 compat:{coupleKey} scope 로 grant.
    //   기존 990원 글로벌 love-question 구매자는 게이트에서 grandfather(별도 처리).
    id: 'taste_compat_reading',
    name: '궁합 깊은 풀이',
    credits: 0,
    // 2026-07-20 — 3,300원 이벤트에서 누락돼 있었다(money_pattern·work_flow 와 같은 사고).
    //   같은 '깊은 궁합 풀이'를 주는 love-question(전역·아무 커플)이 3,300원인데
    //   이쪽은 **커플 1쌍 한정인데 9,900원** 이었다 — 좁은 권한이 3배 비싼 완전 열위.
    //   per-couple 플래그가 켜져 있어 사용자가 그 열위 상품으로 보내지고 있었다.
    price: 3300,
    kind: 'taste_product',
    tasteProductId: 'compat-reading',
    requiresSlug: true,
    compareAt: 9900,
  },
  {
    // 2026-05-23 — 티어 A 묶음. today-detail + 점수 풀이 F1~F5 전체.
    // confirm 이 components 를 순회해 6개 entitlement 를 개별 grant(1결제 = N권한).
    // 2026-06-26 — 묶음열기 9,900원 → 19,800원.
    // 2026-07-20 — **판매 중단**(사용자 지시: "묶음은 이제 필요없어졌어").
    //   점수 언락을 3,300 으로 내리면서 따로 사기 합계가 6,600 이 돼 9,900 묶음은 오히려 손해가
    //   됐고, 묶음가를 6,600 미만으로 내리면 이번엔 단품 체계가 흔들린다. 단품 3,300 단일로 정리.
    //   ⚠️ 정의는 남긴다 — 기존 구매자 이용권·과거 주문 조회가 정의를 참조한다.
    //   신규 결제는 prepare 가드가 410 으로 막는다(판매 중단 ≠ 열람 차단).
    //   중단 시점 실측: 성공 결제 0건, 이용권 6건 전부 내부 테스트 계정.
    id: 'bundle_today_set',
    name: '오늘 풀세트',
    credits: 0,
    price: 9900,
    kind: 'bundle',
    requiresSlug: true,
    compareAt: 19800,
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
  'score-total': 'taste_score_total',
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
    value === 'score-total' ||
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
