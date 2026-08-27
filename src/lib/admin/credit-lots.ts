// 2026-08-27 — 결제-전(錢) lot 조회를 **한 곳으로** 모은다.
//
//   🔴 사용자 제보: "990원 결제하고 대화 3번 안 했는데 이미 사용된 거라고 환불이 안 되네."
//   실데이터 확인 결과 lot 은 멀쩡했다(잔여 3+3=6, paymentKey·orderId 모두 일치).
//   화면 라벨도 '미사용 · 전액 환불 가능'이 맞게 나온다. 그런데 **버튼은 거부**됐다.
//
//   원인: 목록과 실행이 같은 판정 함수(buildCreditRefundItem)를 쓰면서 **입력을 다르게** 모았다.
//     · 목록  = 그 사용자의 purchase lot 전부를 가져와 JS 에서 매칭
//     · 실행  = SQL 에서 metadata @> {paymentKey} 로 미리 거른 결과만 전달
//   실행 쪽 SQL 필터가 한 건도 못 잡으면 빈 배열이 들어가고, 그때 판정은 "잔여 0전 =
//   전부 사용됨"으로 떨어진다. 그 문구가 그대로 400 에러 본문이 되어 환불이 막힌다.
//
//   같은 결론을 내려야 하는 두 경로가 서로 다른 쿼리를 들고 있으면 언제든 다시 갈린다.
//   조회를 여기 하나로 모아, 판정 함수가 **항상 같은 후보 집합**을 본다.
import type { CreditRefundLotRow } from '@/lib/admin/credit-refunds';

const LOT_COLUMNS =
  'id, user_id, amount_remaining, amount_initial, expires_at, source, metadata, created_at';

// Supabase 클라이언트의 제네릭이 매우 깊어 구조적 타입으로 받으면 TS2589(추론 폭발)가 난다.
//   여기서 필요한 건 체이닝 네 단계뿐이라 진입점에서 한 번만 좁힌다.
type LotQuery = {
  select(columns: string): {
    eq(column: string, value: string): {
      eq(column: string, value: string): PromiseLike<{ data: unknown }>;
    };
  };
};
type LotQueryClient = { from(table: string): unknown };

/**
 * 환불 판정에 쓰는 후보 lot 전부(해당 사용자의 결제 적립분).
 * 좁히는 일은 buildCreditRefundItem 의 matchLotToPayment 가 한다 — SQL 로 미리 좁히지 말 것.
 */
export async function loadPurchaseCreditLots(
  client: LotQueryClient,
  userId: string
): Promise<CreditRefundLotRow[]> {
  const { data } = await (client.from('credit_lots') as LotQuery)
    .select(LOT_COLUMNS)
    .eq('user_id', userId)
    .eq('source', 'purchase');
  return (data ?? []) as CreditRefundLotRow[];
}
