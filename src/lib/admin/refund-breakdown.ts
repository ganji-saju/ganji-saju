// 2026-08-26 — 환불 내역 상세. 사용자 제보: "오늘 결제는 990원인데 환불 9,900원이 떠서
//   순매출이 마이너스다".
//
//   수치 자체는 사실이었다. 설계(#641)가 **매출은 판 날, 환불은 환불한 날**에 귀속하기 때문에,
//   예전에 판 9,900원을 오늘 환불하면 오늘 칸에는 매출 990 · 환불 9,900 이 같이 찍힌다.
//   귀속을 원 결제일로 바꾸면 이미 마감된 과거 매출이 사후에 변한다 — 그래서 숫자가 아니라
//   **화면이 그 사실을 말해주게** 한다: 환불 한 건 한 건의 원 결제일을 같이 보여주고,
//   원 결제가 이 기간 매출에 없는 환불액은 따로 합산해 "기간 순매출을 눌러 내린 금액"으로 표시.
//
//   ⚠️ 조회 전용. 집계(metrics_daily.refunded_won)는 건드리지 않는다.
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPackage } from '@/lib/payments/catalog';
import { kstDateKey, shiftDateKey } from './analytics-rollup';

export interface RefundBreakdownItem {
  orderId: string;
  packageId: string;
  productName: string;
  amountWon: number;
  /** 환불이 계상된 날(KST). */
  refundedOn: string;
  /** 원 결제일(KST). confirmed_at → fulfilled_at → created_at 순, 롤업의 귀속 규칙과 동일. */
  paidOn: string | null;
  /** 원 결제가 조회 기간 안에 있나 — false 면 이 환불은 기간 매출에 대응 금액이 없다. */
  paidInWindow: boolean;
  /** 판 날과 환불한 날이 같은가(당일 환불이면 마이너스로 보일 일이 없다). */
  sameDay: boolean;
}

export interface RefundBreakdown {
  items: RefundBreakdownItem[];
  totalWon: number;
  /** 원 결제가 기간 밖이라 기간 순매출을 그대로 깎는 금액. */
  outsideWindowWon: number;
  /** 상한에 걸려 표에서 잘린 건수(0 이면 전량). */
  truncated: number;
}

/** 관리자 화면 표 상한 — 이보다 많으면 최신순으로 자르고 truncated 로 알린다. */
const MAX_ITEMS = 200;

interface RefundOrderRow {
  order_id: string | null;
  package_id: string | null;
  amount: number | null;
  refunded_at: string | null;
  confirmed_at: string | null;
  fulfilled_at: string | null;
  created_at: string | null;
}

/** 순수 계산 — I/O 없이 테스트한다. */
export function computeRefundBreakdown(
  rows: readonly RefundOrderRow[],
  window: { fromKey: string; toKey: string }
): RefundBreakdown {
  const items: RefundBreakdownItem[] = [];

  for (const row of rows) {
    if (!row.refunded_at) continue;
    const refundedOn = kstDateKey(row.refunded_at);
    if (refundedOn < window.fromKey || refundedOn > window.toKey) continue;

    const paidIso = row.confirmed_at ?? row.fulfilled_at ?? row.created_at;
    const paidOn = paidIso ? kstDateKey(paidIso) : null;
    const packageId = row.package_id ?? '';
    const amountWon = Math.max(0, Number(row.amount) || 0);

    items.push({
      orderId: row.order_id ?? '',
      packageId,
      productName: getPackage(packageId)?.name ?? packageId ?? '(상품 미상)',
      amountWon,
      refundedOn,
      paidOn,
      // 원 결제일을 모르면(paidOn=null) 기간 안이라고 단정하지 않는다 — 모르는 걸
      // '정상'으로 분류하면 왜곡 금액이 과소 집계된다.
      paidInWindow: paidOn != null && paidOn >= window.fromKey && paidOn <= window.toKey,
      sameDay: paidOn != null && paidOn === refundedOn,
    });
  }

  items.sort((a, b) => (a.refundedOn < b.refundedOn ? 1 : a.refundedOn > b.refundedOn ? -1 : 0));

  const totalWon = items.reduce((sum, i) => sum + i.amountWon, 0);
  const outsideWindowWon = items
    .filter((i) => !i.paidInWindow)
    .reduce((sum, i) => sum + i.amountWon, 0);

  return {
    items: items.slice(0, MAX_ITEMS),
    totalWon,
    outsideWindowWon,
    truncated: Math.max(0, items.length - MAX_ITEMS),
  };
}

/**
 * 기간 내 환불 건 조회. ⚠️ service-role 클라이언트여야 한다(payment_orders 는 deny RLS).
 */
export async function getRefundBreakdown(
  service: SupabaseClient,
  windowDays: number,
  now = new Date()
): Promise<RefundBreakdown> {
  const toKey = kstDateKey(now.toISOString());
  const fromKey = shiftDateKey(toKey, -(Math.max(1, windowDays) - 1));
  const startIso = new Date(Date.parse(`${fromKey}T00:00:00+09:00`)).toISOString();
  const endIso = new Date(Date.parse(`${shiftDateKey(toKey, 1)}T00:00:00+09:00`)).toISOString();

  const { data, error } = await service
    .from('payment_orders')
    .select('order_id, package_id, amount, refunded_at, confirmed_at, fulfilled_at, created_at')
    .eq('status', 'refunded')
    .gte('refunded_at', startIso)
    .lt('refunded_at', endIso)
    .order('refunded_at', { ascending: false })
    .limit(MAX_ITEMS + 1);

  if (error) {
    // 환불 내역은 보조 정보다 — 실패해도 지표 화면 전체를 죽이지 않는다.
    console.error('[refund-breakdown] query failed:', error.message);
    return { items: [], totalWon: 0, outsideWindowWon: 0, truncated: 0 };
  }

  return computeRefundBreakdown((data ?? []) as RefundOrderRow[], { fromKey, toKey });
}
