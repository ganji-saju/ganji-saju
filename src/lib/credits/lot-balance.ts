// 2026-06-28 — 전 "만료 보정" 순수 로직 분리.
//   마이페이지 전 표시(dashboard.credits.total)는 만료 안 된 결제 전만 더해야 한다.
//   기존엔 credit_lots 의 .gt('expires_at', now) DB 필터에만 의존 → 오프라인 검증 불가했고,
//   필터가 누락되면 만료 전이 그대로 표시되는 회귀를 막을 수 없었다.
//   이 순수 함수로 (1) 동일 보정을 JS 측에서도 한 번 더 보장(이중 가드)하고
//   (2) 회귀 테스트(lot-balance.test.ts)로 만료 경계 동작을 잠근다.

export interface CreditLotRow {
  amount_remaining: number | null;
  expires_at: string | null;
}

// 비만료 lot 의 amount_remaining 합.
//   - expires_at > now 인 lot 만 합산(now 와 같거나 과거는 만료 → 제외).
//   - expires_at 가 null/파싱불가면 만료일 불명 → 보수적으로 제외(현행 .gt DB 필터와 동일: null 은 매칭 안 됨).
//   - amount_remaining 가 null 이면 0 으로 취급.
export function sumNonExpiredLots(lots: CreditLotRow[], now: Date): number {
  const nowMs = now.getTime();
  return lots.reduce((sum, lot) => {
    if (!lot.expires_at) return sum;
    const expiresMs = new Date(lot.expires_at).getTime();
    if (!Number.isFinite(expiresMs) || expiresMs <= nowMs) return sum;
    return sum + (lot.amount_remaining ?? 0);
  }, 0);
}
