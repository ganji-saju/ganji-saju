// 2026-05-25 — /my/billing 현금(현금 결제) 내역 전면 노출.
// 기존 /my/billing 은 전 잔액 + credit_transactions + 멤버십만 보여줬고,
// Toss 로 실제 결제한 단건 풀이(550~3,900원) · 평생 리포트(49,000) · 전팩 ·
// 멤버십의 "무엇을 / 얼마(₩) / 언제 샀는지"를 보여주는 화면이 없었다.
//
// 현금 결제는 두 곳에 흩어져 있다(겹치지 않음 — 제품 vs 전/구독):
//   1) product_entitlements  : 단건 풀이 · 평생 리포트(amount = WON)
//   2) credit_transactions   : 전 충전(purchase) · 멤버십/구독(subscription)
//                               (amount = COINS, ₩는 패키지 정가 또는 metadata.amount)
//
// 이 모듈은 두 소스를 한 모양(PaymentHistoryEntry)으로 합쳐 날짜 역순 정렬하고
// 총 결제액(₩)을 더한다. Supabase 의존성이 없는 순수 매퍼라서 단위 테스트로 고정한다.
import {
  getPackage,
  getTasteProductPackage,
  isTasteProductId,
} from '@/lib/payments/catalog';

export type PaymentHistoryCategory =
  | '단건 풀이'
  | '평생 리포트'
  | '전 충전'
  | '멤버십/구독';

export interface PaymentHistoryEntry {
  /** 안정 키 — product_entitlements.id 또는 credit_transactions.id. */
  id: string;
  /** 결제 발생 시각(ISO). 정렬값. */
  date: string;
  category: PaymentHistoryCategory;
  /** 카탈로그에서 해석한 상품명(미해석 시 raw product_id). */
  productName: string;
  /** 결제 금액(원). 해석 불가 시 null — 총액에서 제외. */
  amountWon: number | null;
  /** 전 충전/구독에 한해 지급 전 수(없으면 null). */
  coins: number | null;
  /** 영수증 참조 — 주문번호 우선, 없으면 결제키. UI 는 끝 8자리만 노출. */
  receipt: string | null;
  /** 소스 구분(디버깅/필터용). */
  source: 'product_entitlements' | 'credit_transactions';
}

// ── 입력 행(서버에서 select 한 raw shape) ─────────────────────────────
// product_entitlements: id, product_id, amount, order_id, payment_key, package_id,
//                       created_at, metadata
export interface ProductEntitlementHistoryRow {
  id: string;
  product_id: string;
  amount: number | null;
  order_id: string | null;
  payment_key: string | null;
  package_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

// credit_transactions: id, type, amount(전), metadata, created_at
export interface CreditTransactionHistoryRow {
  id: string;
  type: string;
  amount: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function readMetaNumber(metadata: Record<string, unknown> | null, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readMetaString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// product_id → 표시 상품명.
//   - lifetime-report  → getPackage('lifetime_report').name ('보관형 사주 리포트')
//   - taste 제품 id    → getTasteProductPackage(id).name
//   - 그 외(미해석)    → raw product_id (휴먼 리뷰 대상)
export function resolveProductEntitlementName(productId: string): string {
  if (productId === 'lifetime-report') {
    return getPackage('lifetime_report')?.name ?? productId;
  }
  if (isTasteProductId(productId)) {
    return getTasteProductPackage(productId)?.name ?? productId;
  }
  return productId;
}

export function mapProductEntitlementToHistory(
  row: ProductEntitlementHistoryRow
): PaymentHistoryEntry {
  const category: PaymentHistoryCategory =
    row.product_id === 'lifetime-report' ? '평생 리포트' : '단건 풀이';

  // ₩ = product_entitlements.amount(결제 시 기록한 WON) 우선, 없으면 metadata.amount,
  // 그래도 없으면 package_id 정가(catalog) 로 보강.
  const amountWon =
    row.amount ??
    readMetaNumber(row.metadata, 'amount') ??
    getPackage(row.package_id)?.price ??
    null;

  return {
    id: row.id,
    date: row.created_at,
    category,
    productName: resolveProductEntitlementName(row.product_id),
    amountWon,
    coins: null,
    receipt: row.order_id ?? row.payment_key ?? null,
    source: 'product_entitlements',
  };
}

export function mapCreditTransactionToHistory(
  row: CreditTransactionHistoryRow
): PaymentHistoryEntry {
  const isSubscription = row.type === 'subscription';
  const category: PaymentHistoryCategory = isSubscription ? '멤버십/구독' : '전 충전';
  const pkg = getPackage(readMetaString(row.metadata, 'packageId'));

  const productName = pkg?.name ?? (isSubscription ? '멤버십' : '전 충전');

  // ₩ = 패키지 정가(catalog) 우선, 없으면 metadata.amount.
  const amountWon = pkg?.price ?? readMetaNumber(row.metadata, 'amount') ?? null;

  return {
    id: row.id,
    date: row.created_at,
    category,
    productName,
    amountWon,
    coins: row.amount,
    receipt:
      readMetaString(row.metadata, 'orderId') ??
      readMetaString(row.metadata, 'paymentKey') ??
      null,
    source: 'credit_transactions',
  };
}

// credit_transactions 중 "현금 결제"로 집계할 행만 통과시킨다.
//   - type 은 'purchase' | 'subscription'
//   - 단, legacy 소액상품 audit 행(feature='taste_product', amount=0)과
  //     환불 audit 행(feature='entitlement_revoke'|'credit_refund')은 product_entitlements/credit_lots 와
//     중복되거나 결제가 아니므로 제외 → 호출부 select 에서 이미 필터하지만,
//     순수 매퍼 레벨에서도 방어한다.
export function isCashCreditTransaction(row: {
  type: string;
  feature?: string | null;
}): boolean {
  if (row.type !== 'purchase' && row.type !== 'subscription') return false;
  if (row.feature === 'taste_product') return false;
  if (row.feature === 'entitlement_revoke') return false;
  if (row.feature === 'credit_refund') return false;
  return true;
}

export interface BuildPaymentHistoryInput {
  productEntitlements: ProductEntitlementHistoryRow[];
  creditTransactions: CreditTransactionHistoryRow[];
}

export interface PaymentHistoryResult {
  entries: PaymentHistoryEntry[];
  totalSpentWon: number;
  count: number;
}

// 두 소스를 합쳐 날짜 역순 정렬 + 총 결제액(₩) 집계. 순수 함수(테스트 고정).
export function buildPaymentHistory(
  input: BuildPaymentHistoryInput
): PaymentHistoryResult {
  const entries: PaymentHistoryEntry[] = [
    ...input.productEntitlements.map(mapProductEntitlementToHistory),
    ...input.creditTransactions.map(mapCreditTransactionToHistory),
  ];

  entries.sort((a, b) => {
    const diff = Date.parse(b.date) - Date.parse(a.date);
    if (diff !== 0) return diff;
    // 동시각 tie-break — id 로 안정 정렬.
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });

  const totalSpentWon = entries.reduce(
    (sum, entry) => sum + (entry.amountWon ?? 0),
    0
  );

  return { entries, totalSpentWon, count: entries.length };
}
