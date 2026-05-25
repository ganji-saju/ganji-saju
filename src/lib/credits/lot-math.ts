// 결제 코인 1년 만료 — lot 기반 차감/잔액 계산의 순수 로직.
//
// 이 모듈은 040_credit_lots_expiry.sql 의 SQL 함수(consume_credit_lots / deduct_credits /
// sync_credit_balance_from_lots)가 구현하는 알고리즘을 TypeScript 로 1:1 미러링한 것이다.
// 머니 크리티컬 로직이라 SQL 을 직접 단위 테스트하기 어려운 대신, 동일 규칙을 순수 함수로
// 고정해 회귀를 막는다. SQL 을 수정하면 여기 규칙도 함께 맞춰야 한다.

export interface CreditLot {
  id: string;
  amountRemaining: number;
  expiresAt: Date;
  createdAt?: Date;
}

// 비만료(now 시점 기준 expires_at > now) lot 의 amount_remaining 합.
// SQL: SUM(amount_remaining) WHERE expires_at > now().
export function nonExpiredBalance(lots: readonly CreditLot[], now: Date): number {
  return lots
    .filter((lot) => lot.expiresAt.getTime() > now.getTime())
    .reduce((sum, lot) => sum + Math.max(0, lot.amountRemaining), 0);
}

// FIFO 차감 순서: expires_at ASC → created_at ASC → id ASC (SQL ORDER BY 와 동일).
// 가장 먼저 만료되는 lot 부터 소비해 만료 임박분을 우선 사용한다.
function fifoOrder(a: CreditLot, b: CreditLot): number {
  const byExpiry = a.expiresAt.getTime() - b.expiresAt.getTime();
  if (byExpiry !== 0) return byExpiry;

  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  if (aCreated !== bCreated) return aCreated - bCreated;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface ConsumeResult {
  success: boolean;
  // 차감 적용 후의 lot 상태(success=false 면 입력과 동일, 부분 차감 없음).
  lots: CreditLot[];
  // 차감 후 비만료 잔액.
  remaining: number;
}

// 비만료 lot 을 FIFO 로 cost 만큼 차감한다. 비만료 합이 부족하면 아무것도 차감하지 않고
// success=false 를 반환한다(부분 차감 금지 — SQL 의 사전 합 체크와 동일).
export function consumeLots(
  lots: readonly CreditLot[],
  cost: number,
  now: Date
): ConsumeResult {
  const snapshot = lots.map((lot) => ({ ...lot }));

  if (cost <= 0) {
    return { success: true, lots: snapshot, remaining: nonExpiredBalance(snapshot, now) };
  }

  const available = nonExpiredBalance(snapshot, now);
  if (available < cost) {
    return { success: false, lots: snapshot, remaining: available };
  }

  let remainingCost = cost;
  const ordered = snapshot
    .filter((lot) => lot.expiresAt.getTime() > now.getTime() && lot.amountRemaining > 0)
    .sort(fifoOrder);

  for (const lot of ordered) {
    if (remainingCost <= 0) break;
    const take = Math.min(lot.amountRemaining, remainingCost);
    lot.amountRemaining -= take;
    remainingCost -= take;
  }

  return { success: true, lots: snapshot, remaining: nonExpiredBalance(snapshot, now) };
}

export interface DeductResult {
  success: boolean;
  subscriptionBalance: number;
  lots: CreditLot[];
  // 차감 후 잔여. 분기별로 의미가 다르다(원본 002 deduct_credits 행동 보존):
  //   - 구독 분기: (구독잔액 - cost) + 비만료 lot 합.
  //   - lot 분기: 비만료 lot 합만(잔존 구독잔액 미합산).
  //   - 실패 분기: 구독잔액 + 비만료 lot 합.
  remaining: number;
}

// deduct_credits 미러: 구독 잔액 먼저, 그 다음 비만료 lot FIFO. 둘을 섞어 쓰지 않으며
// (한 쪽만으로 비용을 충당) 둘 다 부족하면 실패한다.
export function deduct(
  subscriptionBalance: number,
  lots: readonly CreditLot[],
  cost: number,
  now: Date
): DeductResult {
  const snapshot = lots.map((lot) => ({ ...lot }));
  const sub = Math.max(0, subscriptionBalance);

  // 1) 구독 크레딧 먼저.
  if (sub >= cost) {
    const nextSub = sub - cost;
    return {
      success: true,
      subscriptionBalance: nextSub,
      lots: snapshot,
      remaining: nextSub + nonExpiredBalance(snapshot, now),
    };
  }

  // 2) 비만료 lot FIFO.
  const consumed = consumeLots(snapshot, cost, now);
  if (consumed.success) {
    return {
      success: true,
      subscriptionBalance: sub,
      lots: consumed.lots,
      remaining: consumed.remaining,
    };
  }

  // 3) 둘 다 부족.
  return {
    success: false,
    subscriptionBalance: sub,
    lots: snapshot,
    remaining: sub + nonExpiredBalance(snapshot, now),
  };
}
