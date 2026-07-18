// 2026-07-19 — 전(코인) 차감량을 **카탈로그 가격에서 파생**시킨다.
//
// 왜 분리했나:
//   1) `deduct.ts` 는 createServiceClient(server-only)를 import 해서 클라 컴포넌트가 못 쓴다.
//      그래서 화면마다 "10전" 같은 리터럴이 복붙됐고, 가격이 바뀌자 전부 stale 이 됐다.
//      이 모듈은 순수(카탈로그만 의존)라 서버·클라 어디서나 쓸 수 있다.
//   2) 기존 CREDIT_COSTS 는 카탈로그와 import 링크가 0이라 **자동 정합이 안 됐다**.
//      2026-07-18 카드가가 9,900 → 3,300 으로 내려갔는데 전은 10개(페그상 9,900원 상당)에
//      얼어붙어, 같은 상품이 결제수단에 따라 3배 차이나는 상태였다.
//
// 규칙: 전 차감량 = floor(상품가 / 990), 최소 1전.
//   · floor(내림)인 이유 — `deduct.ts` 의 설계 의도가 "전 결제 = 직접결제 대비 우대(재방문 유인)"다.
//     3,300원 기준 3전(=2,970원 상당)은 카드가보다 싸서 의도가 유지되지만,
//     올림한 4전(=3,960원 상당)은 카드보다 비싸져 의도가 정반대로 뒤집힌다.
//   · 990원 페그 자체가 하우스에 유리한 명목가다(실 전팩 단가는 보너스·벌크 반영 시 660~449원).
//     여기서 올림까지 하면 이중으로 불리해진다.
//   · floor(9900/990) = 10 이라 기존 9,900원 상품의 값도 그대로 재현된다(무모순).
//
// ⚠️ 한계: 파생의 기준은 **카탈로그 기본가**다. /admin/pricing 런타임 오버라이드
//   (product_prices)가 걸리면 전 차감량은 따라가지 않는다. 런타임 가격을 크게 바꿀 때는
//   이 모듈의 전제도 함께 점검할 것.

import { getPackage, type PackageId } from '@/lib/payments/catalog';

/** 전 1개의 명목 원화가. 전팩 구성·상품 페그의 기준. */
export const COIN_UNIT_KRW = 990;

/** 카탈로그 상품가 → 전 차감량(내림, 최소 1전). */
export function coinCostForPackage(id: PackageId): number {
  const price = getPackage(id)?.price ?? 0;
  return Math.max(1, Math.floor(price / COIN_UNIT_KRW));
}

export type Feature =
  /** 오늘 자세히 보기(taste_today_detail) 파생 */
  | 'detail_report'
  /** 궁합 깊은 풀이(taste_compat_reading) 파생 — 현재 실제 차감 호출부는 없음(inert) */
  | 'compat'
  /** 대화상담: 3턴 묶음 과금. 상품가 페그가 아니라 고정 */
  | 'ai_chat'
  /** 미사용(유지) */
  | 'daewoon'
  /** 월간 달력(taste_monthly_calendar) 파생 */
  | 'calendar';

export const CREDIT_COSTS: Record<Feature, number> = {
  detail_report: coinCostForPackage('taste_today_detail'),
  compat: coinCostForPackage('taste_compat_reading'),
  calendar: coinCostForPackage('taste_monthly_calendar'),
  // 아래 둘은 상품가 페그가 아니라 정책 고정값이라 파생시키지 않는다.
  ai_chat: 3,
  daewoon: 3,
};

export function isFeature(value: unknown): value is Feature {
  return typeof value === 'string' && value in CREDIT_COSTS;
}

export function getFeatureCost(feature: Feature): number {
  return CREDIT_COSTS[feature];
}
