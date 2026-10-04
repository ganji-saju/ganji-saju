// 인플루언서별 판매·환불·수수료(설계 §3-5). 수수료는 주문 시점 스냅샷율 × (결제액 − 환불액). 정산은 수동.
export interface PartnerOrderRow {
  amount: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

export interface PartnerStat {
  paidCount: number;
  paidWon: number;
  refundedCount: number;
  refundedWon: number;
  commissionWon: number;
}

const PAID = new Set(['confirmed', 'fulfilling', 'fulfilled', 'fulfillment_failed', 'refunded']);

export function computePartnerStats(orders: readonly PartnerOrderRow[]) {
  const out: Record<string, PartnerStat> = {};
  for (const o of orders) {
    const code = typeof o.metadata?.partnerCode === 'string' ? o.metadata.partnerCode : null;
    if (!code || !PAID.has(o.status)) continue;
    const amount = Math.max(0, Number(o.amount) || 0);
    const rate = Number(o.metadata?.partnerCommissionPercent) || 0;
    const partial = Array.isArray(o.metadata?.partialRefunds)
      ? (o.metadata!.partialRefunds as { amount?: number }[]).reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : 0;
    const refunded = o.status === 'refunded' ? amount : Math.min(amount, partial);
    const s = (out[code] ??= { paidCount: 0, paidWon: 0, refundedCount: 0, refundedWon: 0, commissionWon: 0 });
    s.paidCount += 1;
    s.paidWon += amount;
    if (refunded > 0) { s.refundedCount += 1; s.refundedWon += refunded; }
    s.commissionWon += Math.floor(((amount - refunded) * rate) / 100);
  }
  return out;
}
