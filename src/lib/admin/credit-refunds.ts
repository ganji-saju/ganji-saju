import { getPackage } from '@/lib/payments/catalog';

export type CreditRefundPolicyStatus = 'full' | 'partial' | 'none';

export interface CreditRefundTransactionRow {
  id: string;
  type: string;
  amount: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  feature?: string | null;
}

export interface CreditRefundLotRow {
  id: string;
  user_id?: string;
  amount_remaining: number;
  amount_initial: number;
  expires_at: string;
  source: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface CreditRefundEligibleItem {
  id: string;
  productName: string;
  packageId: string | null;
  paymentKey: string | null;
  orderId: string | null;
  originalAmountWon: number | null;
  refundAmountWon: number;
  coinsPurchased: number;
  coinsRemaining: number;
  coinsUsed: number;
  hasPaymentKey: boolean;
  /** 이 결제에 해당하는 credit_lots 행을 실제로 찾았는가. false 면 사용량은 **모르는 것**이다. */
  lotsLinked: boolean;
  status: CreditRefundPolicyStatus;
  statusLabel: string;
  createdAt: string;
  expiresAt: string | null;
  lotIds: string[];
}

export interface CreditRefundEligibility {
  items: CreditRefundEligibleItem[];
  refundableItems: CreditRefundEligibleItem[];
  totalRefundableWon: number;
}

function readString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isNonExpiredLot(lot: CreditRefundLotRow, now: Date) {
  return Date.parse(lot.expires_at) > now.getTime();
}

// 2026-08-26 — 2차 키로 orderId 를 함께 본다.
//   lot 과 거래는 add_credits RPC 가 **같은 metadata** 로 함께 쓰므로 원래 paymentKey 하나로
//   이어져야 하지만, 한쪽이 비어 들어오면(PG·재시도 경로에 따라) 조용히 끊긴다.
//   끊기면 아래 계산이 "안 쓴 결제"를 "전부 사용됨"으로 뒤집으므로, 이을 수 있는 키는 다 쓴다.
function matchLotToPayment(
  lot: CreditRefundLotRow,
  paymentKey: string,
  orderId: string | null,
  now: Date
) {
  if (lot.source !== 'purchase' || !isNonExpiredLot(lot, now)) return false;
  if (readString(lot.metadata, 'paymentKey') === paymentKey) return true;
  return Boolean(orderId) && readString(lot.metadata, 'orderId') === orderId;
}

function statusLabel(status: CreditRefundPolicyStatus, coinsUsed: number, lotsLinked: boolean) {
  if (status === 'full') return '미사용 · 전액 환불 가능';
  if (status === 'partial') return `${coinsUsed}전 사용됨 · 부분 환불 가능`;
  // 🔴 2026-08-26 — 못 이은 것을 '사용'이라고 부르지 않는다(아래 buildCreditRefundItem 참고).
  if (!lotsLinked) return '전 적립 내역을 결제와 연결하지 못함 · 수동 확인 필요';
  return coinsUsed > 0 ? '전부 사용됨 · 환불 불가' : '환불 가능 잔여 전 없음';
}

function resolveRefundAmount(amountWon: number | null, coinsPurchased: number, coinsRemaining: number) {
  if (!amountWon || coinsPurchased <= 0 || coinsRemaining <= 0) return 0;
  if (coinsRemaining >= coinsPurchased) return amountWon;
  return Math.floor((amountWon * coinsRemaining) / coinsPurchased);
}

export function buildCreditRefundItem(
  row: CreditRefundTransactionRow,
  lots: readonly CreditRefundLotRow[],
  now = new Date()
): CreditRefundEligibleItem | null {
  if (row.type !== 'purchase' || row.amount <= 0) return null;

  const paymentKey = readString(row.metadata, 'paymentKey');
  const packageId = readString(row.metadata, 'packageId');
  const orderId = readString(row.metadata, 'orderId');
  const pkg = getPackage(packageId);
  // 2026-08-26 — 전팩(kind==='credits') 여부 게이트를 제거한다. 대화상담 질문 3회
  //   (taste_dialogue_entry, 990원)는 전달물이 이용권이 아니라 **전 3개**라 이용권 행을
  //   안 만드는데(재구매 허용 목적), 여기서 taste_product 라는 이유로 잘려 나가 결제·번들·
  //   전 3경로 **어디에도** 안 잡혔다 = 실결제를 관리자 화면에서 환불할 수 없었다.
  //   같은 함수를 /api/admin/refund 실행 경로도 쓰므로 id 를 알아도 실행 불가였다.
  //   판정 근거는 이미 충분하다: type==='purchase' + amount>0 + paymentKey 가 있으면
  //   그 자체로 '돈 내고 받은 전'이다. 멤버십 적립은 type==='subscription'(getCreditGrantType)
  //   이라 위 `row.type !== 'purchase'` 가드에서 이미 걸러져 중복 계상되지 않는다.
  if (!paymentKey) return null;

  const matchedLots = lots.filter((lot) => matchLotToPayment(lot, paymentKey, orderId, now));
  const lotsLinked = matchedLots.length > 0;
  // 🔴 2026-08-26 사용자 제보: "990원 결제하고 대화 3번 안 했는데 이미 사용된 거라고 환불이 안 된다."
  //   (실측: 전 잔액 6전 그대로) 원인은 여기 **폴백의 비대칭**이었다.
  //   lot 을 하나도 못 이었을 때 coinsPurchased 만 row.amount 로 폴백하고 coinsRemaining 은
  //   0 으로 남겨, "3전 샀고 0전 남음 = 전부 사용됨 · 환불 불가" 라는 결론이 나왔다.
  //   못 이은 것은 사용한 것이 아니다 — 모르면 모른다고 표기하고 사람이 보게 한다.
  const coinsPurchased = lotsLinked
    ? matchedLots.reduce((sum, lot) => sum + Math.max(0, lot.amount_initial ?? 0), 0)
    : row.amount;
  const coinsRemaining = matchedLots.reduce(
    (sum, lot) => sum + Math.max(0, lot.amount_remaining ?? 0),
    0
  );
  const coinsUsed = lotsLinked ? Math.max(0, coinsPurchased - coinsRemaining) : 0;
  // 실결제액(metadata.amount) 우선 — 정가 우선이면 가격 개정 시 과거 결제가 소급 왜곡.
  const originalAmountWon = readNumber(row.metadata, 'amount') ?? pkg?.price ?? null;
  const refundAmountWon = resolveRefundAmount(originalAmountWon, coinsPurchased, coinsRemaining);

  let status: CreditRefundPolicyStatus = 'none';
  if (coinsRemaining > 0 && refundAmountWon > 0) {
    status = coinsRemaining >= coinsPurchased ? 'full' : 'partial';
  }

  const expiresAt =
    matchedLots
      .map((lot) => lot.expires_at)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;

  return {
    id: row.id,
    productName: pkg?.name ?? packageId ?? '전 충전',
    packageId,
    paymentKey,
    orderId,
    originalAmountWon,
    refundAmountWon,
    coinsPurchased,
    coinsRemaining,
    coinsUsed,
    hasPaymentKey: Boolean(paymentKey),
    lotsLinked,
    status,
    statusLabel: statusLabel(status, coinsUsed, lotsLinked),
    createdAt: row.created_at,
    expiresAt,
    lotIds: matchedLots.map((lot) => lot.id),
  };
}

export function determineCreditRefundEligibility(
  creditTransactions: readonly CreditRefundTransactionRow[],
  creditLots: readonly CreditRefundLotRow[],
  now = new Date()
): CreditRefundEligibility {
  const items = creditTransactions
    .map((row) => buildCreditRefundItem(row, creditLots, now))
    .filter((item): item is CreditRefundEligibleItem => Boolean(item))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const refundableItems = items.filter((item) => item.status !== 'none' && item.refundAmountWon > 0);
  const totalRefundableWon = refundableItems.reduce((sum, item) => sum + item.refundAmountWon, 0);
  return { items, refundableItems, totalRefundableWon };
}
