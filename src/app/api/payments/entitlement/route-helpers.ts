// 2026-05-17 A6 회귀 fix — entitlement API 의 today-detail 코인 언락 조회 helper.
//
// 배경:
//   PR #178 (A6) 가 today-detail 의 entitlement 조회를 추가할 때
//   `today_fortune_premium_access` kind 두 가지만 시도했음.
//   그러나 1코인 결제 경로 (`/api/credits/use` POST → `unlockDetailReport`) 는
//   `detail_report_access` kind 로 row 를 저장 — 두 kind 가 일치하지 않아
//   결제해도 entitlement 항상 false → 결제 button 계속 노출 → 중복 결제 회귀.
//
// 이 helper 는 두 kind 모두 fallback 으로 조회한다.

export interface TodayDetailCoinUnlockScope {
  slug: string | null;
  readingKey: string | null;
}

export interface TodayDetailCoinUnlockDeps {
  hasTodayFortunePremiumAccess: (userId: string, sourceSessionId: string) => Promise<boolean>;
  hasDetailReportAccess: (userId: string, readingKey: string) => Promise<boolean>;
}

export async function resolveTodayDetailCoinUnlock(
  userId: string,
  scope: TodayDetailCoinUnlockScope,
  deps: TodayDetailCoinUnlockDeps,
): Promise<boolean> {
  if (!scope.slug) return false;

  // 1) today_fortune_premium_access (sourceSessionId 기반) — PR #178 신규 키.
  if (await deps.hasTodayFortunePremiumAccess(userId, scope.slug)) return true;
  if (
    scope.readingKey &&
    scope.readingKey !== scope.slug &&
    (await deps.hasTodayFortunePremiumAccess(userId, scope.readingKey))
  ) {
    return true;
  }

  // 2) detail_report_access (readingKey 기반) — credits/use route 가 실제 저장하는 키.
  //    같은 reading 의 detail 콘텐츠는 today-fortune / saju-detail 양쪽에서 동일하므로
  //    한쪽에서 산 사용자는 다른 쪽 entitlement 도 갖는다.
  if (scope.readingKey && (await deps.hasDetailReportAccess(userId, scope.readingKey))) {
    return true;
  }

  return false;
}
