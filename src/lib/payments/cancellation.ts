// 2026-07-10 — PG 취소 통보 시 무엇을 회수할지 결정하는 순수 로직.
//
// 회수는 지급과 대칭이어야 한다. 지급(fulfillment)은 order_id 를 달아 entitlement 를 남기므로,
// 회수도 order_id 로 열거한 결과를 그대로 받는다(번들이면 구성품이 여러 행으로 들어온다).
//
// 이전 버그: webhook/nicepay 가 `pkg.credits > 0` 일 때만 회수해서, credits=0 인 단품
//   (score-total·today-detail·year-core·lifetime)은 환불 후에도 이용권이 남았다.
import type { PaymentOrderStatus } from '@/lib/payments/order-ledger';

export interface RevokableEntitlement {
  userId: string;
  productId: string;
  scopeKey: string | null;
}

export interface CancellationRevokeInput {
  orderStatus: PaymentOrderStatus;
  /** 패키지가 지급하는 전(코인) 수량. 단품은 0. */
  packageCredits: number;
  /** order_id 로 조회한 실제 지급 이용권. 없으면 빈 배열. */
  entitlements: readonly RevokableEntitlement[];
}

export interface CancellationRevokePlan {
  revokeCredits: number;
  revokeEntitlements: RevokableEntitlement[];
  hasWork: boolean;
}

/** 지급이 일어난(혹은 일어나던) 상태에서만 회수한다. */
const GRANTED_STATUSES: readonly PaymentOrderStatus[] = ['fulfilled', 'fulfilling'];

export function buildCancellationRevokePlan(
  input: CancellationRevokeInput
): CancellationRevokePlan {
  const granted = GRANTED_STATUSES.includes(input.orderStatus);
  if (!granted) {
    return { revokeCredits: 0, revokeEntitlements: [], hasWork: false };
  }

  const revokeCredits = input.packageCredits > 0 ? input.packageCredits : 0;
  const revokeEntitlements = [...input.entitlements];

  return {
    revokeCredits,
    revokeEntitlements,
    hasWork: revokeCredits > 0 || revokeEntitlements.length > 0,
  };
}
