// P0-2 fix (audit 2026-05-13): pre-compute every value the finalize_payment(JSONB)
// SQL function needs, so that the RPC can perform all 5 post-confirm writes inside a
// single PL/pgSQL transaction. The TypeScript layer keeps all business logic (scope
// keys, snapshot JSON, snapshot summary, reading-id mapping) and the SQL layer only
// performs atomic INSERT/UPDATE.

import {
  isSubscriptionPackage,
  isTasteProductPackage,
  type PaymentPackage,
} from '@/lib/payments/catalog';
import {
  getPaidProductIdFromPackage,
  normalizeEntitlementScopeKey,
  type PaymentProductScope,
} from '@/lib/payments/product-scope';
import { isReadingId } from '@/lib/saju/readings';
import {
  buildSnapshotJson,
  buildSnapshotSummary,
  getPaidProductTitle,
  toKoreaDate,
} from '@/lib/payments/paid-reading-snapshots';

export interface FinalizePaymentInputArgs {
  userId: string;
  pkg: PaymentPackage;
  paymentKey: string;
  orderId: string;
  amount: number;
  paymentScope: PaymentProductScope | null;
  sourceSlug: string | null;
}

/** Shape passed as the single JSONB argument of `finalize_payment(p_input)`. */
export interface FinalizePaymentInput {
  userId: string;
  paymentKey: string;
  orderId: string;
  packageId: string;
  packageKind: PaymentPackage['kind'];
  amount: number;
  credits: number;
  subscriptionPlan: string | null;
  subscriptionRenewDays: number;
  productId: string | null;
  scopeKey: string | null;
  sourceSlug: string | null;
  readingId: string | null;
  readingKey: string | null;
  snapshotTitle: string | null;
  snapshotSummary: string | null;
  snapshotJson: Record<string, unknown> | null;
  snapshotOccurredOn: string | null;
  snapshotTargetYear: number | null;
  snapshotTargetMonth: number | null;
}

export function buildFinalizePaymentInput(
  args: FinalizePaymentInputArgs
): FinalizePaymentInput {
  const { userId, pkg, paymentKey, orderId, amount, paymentScope, sourceSlug } = args;

  const productId = getPaidProductIdFromPackage(pkg);
  const reading = paymentScope?.reading ?? null;
  const readingId = reading && isReadingId(reading.id) ? reading.id : null;

  const hasEntitlementSide = productId !== null && paymentScope !== null;
  const scopeKey = hasEntitlementSide
    ? normalizeEntitlementScopeKey(paymentScope!.scopeKey)
    : null;

  const subscriptionPlan = isSubscriptionPackage(pkg) ? pkg.subscriptionPlan : null;

  // snapshot fields (replaces the per-write logic that used to live in upsertPaidReadingSnapshot)
  const shouldWriteSnapshot = hasEntitlementSide;
  const snapshotTitle = shouldWriteSnapshot ? getPaidProductTitle(productId!) : null;
  const snapshotSummary = shouldWriteSnapshot ? buildSnapshotSummary(productId!, reading) : null;
  const snapshotJson = shouldWriteSnapshot ? buildSnapshotJson(productId!, paymentScope) : null;
  const snapshotOccurredOn = shouldWriteSnapshot
    ? toKoreaDate(reading?.sajuData.metadata.calculatedAt)
    : null;

  return {
    userId,
    paymentKey,
    orderId,
    packageId: pkg.id,
    packageKind: pkg.kind,
    amount,
    credits: pkg.credits ?? 0,
    subscriptionPlan,
    subscriptionRenewDays: 30,
    productId,
    scopeKey,
    sourceSlug: sourceSlug ?? paymentScope?.slug ?? null,
    readingId,
    readingKey: paymentScope?.readingKey ?? null,
    snapshotTitle,
    snapshotSummary,
    snapshotJson,
    snapshotOccurredOn,
    snapshotTargetYear: paymentScope?.targetYear ?? null,
    snapshotTargetMonth: paymentScope?.targetMonth ?? null,
  };
}

/** Shape returned by `finalize_payment(p_input)`. */
export interface FinalizePaymentResult {
  alreadyFinalized: boolean;
  totalCredits: number;
  balance: number;
  subscriptionBalance: number;
  subscriptionRenewsAt: string | null;
}

export function parseFinalizePaymentResult(raw: unknown): FinalizePaymentResult {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    alreadyFinalized: data.already_finalized === true,
    totalCredits: typeof data.total_credits === 'number' ? data.total_credits : 0,
    balance: typeof data.balance === 'number' ? data.balance : 0,
    subscriptionBalance: typeof data.subscription_balance === 'number' ? data.subscription_balance : 0,
    subscriptionRenewsAt:
      typeof data.subscription_renews_at === 'string' ? data.subscription_renews_at : null,
  };
}
