// 2026-05-17 — /api/today-fortune/unlock 의 idempotent access 결정 helper.
//
// 사용자 보고: /today-fortune/detail 페이지 새로고침마다 1코인이 다시 차감되는
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
  scopeKey: string;
  // 2026-05-17 — KST 'YYYY-MM-DD'. 같은 날 broadest fallback 용.
  todayKey: string;
}

export interface TodayFortuneUnlockDeps {
  // productId 는 'today-detail' 로 고정 — caller 가 closure 로 주입.
  getTodayDetailEntitlement: (userId: string, scopeKey: string) => Promise<unknown>;
  hasTodayFortunePremiumAccess: (userId: string, sourceSessionId: string) => Promise<boolean>;
  hasDetailReportAccess: (userId: string, readingKey: string) => Promise<boolean>;
  // 2026-05-17 PR #200 — 올바른 kind 로 readingKey 매치 (today_fortune_premium_access).
  // PR #196 evidence 가 확정: production row 모두 today_fortune_premium_access kind →
  // detail_report_access kind 만 조회하던 hasDetailReportAccess 가 매번 false 반환.
  hasTodayFortunePremiumAccessByReading: (
    userId: string,
    readingKey: string,
  ) => Promise<boolean>;
  // 2026-05-17 PR #199 — broadest fallback (사용자 명시 요구: "같은 날 두 번 결제 차단").
  hasTodayFortuneDailyAccess: (userId: string, dateKey: string) => Promise<boolean>;
}

export type TodayFortuneAccessSource =
  | 'taste-product'
  | 'coin-session'
  | 'coin-reading'
  | 'coin-daily'
  | null;

export async function resolveTodayFortuneUnlockAccess(
  userId: string,
  scope: TodayFortuneUnlockScope,
  deps: TodayFortuneUnlockDeps,
): Promise<TodayFortuneAccessSource> {
  // 1) entitlement (taste product DB row — 550원 직접 결제).
  const entitlement = await deps.getTodayDetailEntitlement(userId, scope.scopeKey);
  if (entitlement) return 'taste-product';

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

  // 4) coin unlock by KST 일자 (broadest fallback — 사용자 명시 요구).
  //    sourceSessionId / readingKey 가 어떤 이유로 매치 못 잡아도 같은 user 가
  //    같은 날 detail_report 1코인 결제를 했다면 reused — 같은 날 두 번 차감 차단.
  if (await deps.hasTodayFortuneDailyAccess(userId, scope.todayKey)) {
    return 'coin-daily';
  }

  return null;
}
