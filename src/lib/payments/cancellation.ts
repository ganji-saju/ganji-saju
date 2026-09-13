// 2026-07-10 — PG 취소 통보 시 무엇을 회수할지 결정하는 순수 로직.
//
// 회수는 지급과 대칭이어야 한다. 지급은 이용권 행과 레거시 grant 행에 같은 결제키를 싣는다 →
// 회수는 결제키로 그 결제가 만든 권한 전부(번들 구성품·레거시 전용 권한 포함, revokeEntitlementsOfPayment).
// 2026-09-13 — 예전엔 order_id 로 이용권 행을 열거해 (상품, 범위)로 지웠다: 레거시에만 남은 권한을 놓치고,
//   레거시 삭제가 범위 기준이라 다른 결제 몫을 지우거나(흡수) 전역 상품(null ≠ 'global')을 못 지웠다.
//
// 이전 버그: webhook/nicepay 가 `pkg.credits > 0` 일 때만 회수해서, credits=0 인 단품
//   (score-total·today-detail·year-core·lifetime)은 환불 후에도 이용권이 남았다.
import type { PaymentOrderStatus } from '@/lib/payments/order-ledger';

export interface CancellationRevokeInput {
  orderStatus: PaymentOrderStatus;
  /** 패키지가 지급하는 전(코인) 수량. 단품은 0. */
  packageCredits: number;
}

export interface CancellationRevokePlan {
  revokeCredits: number;
  /** 이 결제가 만든 이용권을 회수하는가(지급이 일어난 상태). 대상은 결제키로 정한다. */
  revokeGrants: boolean;
}

/** 지급이 일어난(혹은 일어나던) 상태에서만 전을 회수한다. */
const GRANTED_STATUSES: readonly PaymentOrderStatus[] = ['fulfilled', 'fulfilling'];
/** 이용권은 지급이 **일어났을 수 있는** 상태면 회수한다 — 결제키 회수는 지급이 없으면 0행이라 넓게 잡는다.
 *  지급 도중 실패(fulfillment_failed — 구성품 일부만 지급)도 남은 권한을 거둔다. 이미 환불 표기된 주문의 재통보는 0행(멱등). */
const GRANT_POSSIBLE_STATUSES: readonly PaymentOrderStatus[] = [
  'confirmed',
  'fulfilling',
  'fulfilled',
  'fulfillment_failed',
  'refunded',
];

export function buildCancellationRevokePlan(
  input: CancellationRevokeInput
): CancellationRevokePlan {
  const granted = GRANTED_STATUSES.includes(input.orderStatus);
  return {
    revokeCredits: granted && input.packageCredits > 0 ? input.packageCredits : 0,
    revokeGrants: GRANT_POSSIBLE_STATUSES.includes(input.orderStatus),
  };
}

/** 결제 승인(=돈을 받음)까지 간 것으로 볼 수 있는 상태. */
const PAID_THROUGH_STATUSES: readonly PaymentOrderStatus[] = [
  'confirmed',
  'fulfilling',
  'fulfilled',
  'refunded',
];

export interface CancellationTerminalInput {
  status: PaymentOrderStatus;
  confirmedAt: string | null;
  fulfilledAt: string | null;
}

/**
 * 2026-07-13 — 취소 통보의 종료 상태를 정한다.
 *   결제 승인까지 간 주문의 취소는 **환불**이다 → 'refunded'(매출/이력 보존, refunded_won 집계).
 *   승인 전에 끝난 주문은 단순 취소 → 'canceled'.
 *   과거엔 둘 다 'canceled' 로 뭉개져 결제 성공분이 매출에서 사라졌다.
 *
 * '결제까지 갔다'의 신호: confirmedAt/fulfilledAt 존재(승인/지급 시각) 또는 지급 상태.
 *   지급이 실패(fulfillment_failed)했어도 승인됐으면(confirmedAt) 돈은 받았으므로 환불이다.
 */
export function resolveCancellationTerminalStatus(
  input: CancellationTerminalInput
): 'refunded' | 'canceled' {
  const paidThrough =
    Boolean(input.confirmedAt) ||
    Boolean(input.fulfilledAt) ||
    PAID_THROUGH_STATUSES.includes(input.status);
  return paidThrough ? 'refunded' : 'canceled';
}

/**
 * 2026-07-13 — 전액환불인지 판정. admin 환불은 부분환불을 지원하므로, 원주문을 'refunded'
 *   로 표시하는 건 **전액환불일 때만** 이어야 한다. 부분환불을 전액으로 오판하면 나머지
 *   매출까지 통째로 사라진다. 따라서 정보가 부족하면(어느 쪽이든 null) 보수적으로 false.
 */
export function isFullRefund(input: {
  amount: number | null;
  originalAmount: number | null;
}): boolean {
  if (input.amount === null || input.originalAmount === null) return false;
  return input.amount >= input.originalAmount;
}
