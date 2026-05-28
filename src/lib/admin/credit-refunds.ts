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

function matchLotToPayment(lot: CreditRefundLotRow, paymentKey: string, now: Date) {
  return (
    lot.source === 'purchase' &&
    isNonExpiredLot(lot, now) &&
    readString(lot.metadata, 'paymentKey') === paymentKey
  );
}

function statusLabel(status: CreditRefundPolicyStatus, coinsUsed: number) {
  if (status === 'full') return '미사용 · 전액 환불 가능';
  if (status === 'partial') return `${coinsUsed}코인 사용됨 · 부분 환불 가능`;
  return coinsUsed > 0 ? '전부 사용됨 · 환불 불가' : '환불 가능 잔여 코인 없음';
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
  if (!paymentKey || pkg?.kind !== 'credits') return null;

  const matchedLots = lots.filter((lot) => matchLotToPayment(lot, paymentKey, now));
  const coinsPurchased =
    matchedLots.reduce((sum, lot) => sum + Math.max(0, lot.amount_initial ?? 0), 0) || row.amount;
  const coinsRemaining = matchedLots.reduce((sum, lot) => sum + Math.max(0, lot.amount_remaining ?? 0), 0);
  const coinsUsed = Math.max(0, coinsPurchased - coinsRemaining);
  const originalAmountWon = pkg.price ?? readNumber(row.metadata, 'amount');
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
    productName: pkg.name,
    packageId,
    paymentKey,
    orderId,
    originalAmountWon,
    refundAmountWon,
    coinsPurchased,
    coinsRemaining,
    coinsUsed,
    hasPaymentKey: Boolean(paymentKey),
    status,
    statusLabel: statusLabel(status, coinsUsed),
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
