// 2026-05-17 — /api/today-fortune/unlock 의 idempotent access 결정 helper.
//
// 사용자 보고: /today-fortune/detail 페이지 새로고침마다 1전이 다시 차감되는
// 회귀. 자동 POST /api/today-fortune/unlock 이 mount 시마다 호출되는데
// (TodayFortuneDetailClient line 79 useEffect, attemptedRef 가 새 인스턴스마다
// 리셋), `unlockTodayFortunePremium` 내부 `hasTodayFortunePremiumAccess` 는
// `sourceSessionId` 키만 보고 `detail_report_access` (readingKey 기반, 같은
// reading 의 다른 진입에서 저장된 row) 는 fallback 조회 안 함. 그래서 어떤 이유로
// sourceSessionId 매치가 깨지면 매번 RPC deduct path 로 진입.
//
// PR #192 (entitlement API 의 같은 패턴 fix) 와 동일 fallback 적용 — 두
// endpoint 가 같은 access 의미를 보도록 정합성. 어느 한 path 라도 row 있으면
// deduct skip.

export interface TodayFortuneUnlockScope {
  sourceSessionId: string;
  readingKey: string;
  // 2026-05-17 — KST 'YYYY-MM-DD'. 같은 날 broadest fallback 용.
  todayKey: string;
  /** 2026-07-19 — 요청 주제(wealth/career/…). 주제 단품 접근 판정에만 쓴다. */
  concern?: string | null;
}

export interface TodayFortuneUnlockDeps {
  // productId 는 'today-detail' 로 고정 — caller 가 closure 로 주입.
  //   2026-09-23 — scopeKey 인자를 없앴다: 판정은 사주 + 오늘(KST created_at)로 하고(hasTodayDetailEntitlementForSaju)
  //   저장 scope 는 today:<사주>:<날짜> 라 옛 형식 키를 여기로 넘기면 "이게 조회 키" 라는 오해만 남는다.
  getTodayDetailEntitlement: (userId: string) => Promise<unknown>;
  /**
   * 2026-07-19 — 주제 단품(money-pattern=재물 / work-flow=일·직장) 보유 여부.
   *   두 상품은 global 스코프라 1회 구매로 전역 접근이며, **해당 주제일 때만** 연다.
   *   caller 가 productId 를 closure 로 주입한다.
   */
  getTopicProductEntitlement?: (userId: string, productId: string) => Promise<unknown>;
  hasTodayFortunePremiumAccess: (userId: string, sourceSessionId: string) => Promise<boolean>;
  hasDetailReportAccess: (userId: string, readingKey: string) => Promise<boolean>;
  // 2026-05-17 PR #200 — 올바른 kind 로 readingKey 매치 (today_fortune_premium_access).
  // PR #196 evidence 가 확정: production row 모두 today_fortune_premium_access kind →
  // detail_report_access kind 만 조회하던 hasDetailReportAccess 가 매번 false 반환.
  hasTodayFortunePremiumAccessByReading: (
    userId: string,
    readingKey: string,
  ) => Promise<boolean>;
  // 2026-05-17 PR #199 — "같은 날 두 번 결제 차단". 2026-09-14 부터 **이 사주**(#699 정체성) 열람 행만 — 그날 아무 행이나 X.
  hasTodayFortuneAccessForSaju: (userId: string, readingKey: string, dateKey: string) => Promise<boolean>;
}

export type TodayFortuneAccessSource =
  | 'taste-product'
  | 'topic-product'
  | 'coin-session'
  | 'coin-reading'
  | null;

// 주제 → 단품 매핑은 lib 이 정본(멤버십 환불 잠금도 읽는다). 기존 import 경로는 재수출로 유지.
import { topicProductForConcern } from '@/lib/today-fortune/topic-products';
export { TOPIC_PRODUCT_BY_CONCERN, topicProductForConcern } from '@/lib/today-fortune/topic-products';

export async function resolveTodayFortuneUnlockAccess(
  userId: string,
  scope: TodayFortuneUnlockScope,
  deps: TodayFortuneUnlockDeps,
): Promise<TodayFortuneAccessSource> {
  // 1) entitlement (taste product DB row — 9,900원 카드 직접 결제).
  const entitlement = await deps.getTodayDetailEntitlement(userId);
  if (entitlement) return 'taste-product';

  // 1-b) 주제 단품(재물·일). 요청 주제와 일치할 때만 연다 — 재물을 샀는데 일 화면이 열리면 안 된다.
  const topicProduct = topicProductForConcern(scope.concern);
  if (topicProduct && deps.getTopicProductEntitlement) {
    if (await deps.getTopicProductEntitlement(userId, topicProduct)) return 'topic-product';
  }

  // 2) coin unlock by sourceSessionId — PR #178 신규 키 (today_fortune_premium_access).
  if (await deps.hasTodayFortunePremiumAccess(userId, scope.sourceSessionId)) {
    return 'coin-session';
  }

  // 3) coin unlock by readingKey — 두 kind 모두 시도 (PR #200 정확한 fix):
  //    a) today_fortune_premium_access kind (production row 의 실제 kind, evidence 기반)
  //    b) detail_report_access kind (credits/use route 가 저장 — saju-detail 경로)
  //    같은 reading 의 어느 entry 에서 결제했어도 동일 access.
  if (await deps.hasTodayFortunePremiumAccessByReading(userId, scope.readingKey)) {
    return 'coin-reading';
  }
  if (await deps.hasDetailReportAccess(userId, scope.readingKey)) {
    return 'coin-reading';
  }

  // 4) 같은 사주(#699 정체성)의 오늘 열람 행 — readingKey 가 이름 해시·출생지 경로로 흔들려도 같은 날 두 번 차감 차단.
  //    🔴 2026-09-14 전에는 그날 아무 detail_report 행(무료 후속질문 포함)이면 'coin-daily' 로 가족 사주까지 열었다.
  //    결제 화면·prepare 가 사주 단위(hasTodayDetailEntitlementForSaju)라 열기도 사주 단위여야 한다.
  if (await deps.hasTodayFortuneAccessForSaju(userId, scope.readingKey, scope.todayKey)) {
    return 'coin-reading';
  }

  return null;
}
