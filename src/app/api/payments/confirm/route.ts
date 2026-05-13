import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { isSubscriptionPackage, isTasteProductPackage } from '@/lib/payments/catalog';
import { confirmPayment } from '@/lib/payments/toss';
import { validatePaymentConfirmationPayload } from '@/lib/payments/confirmation';
import {
  resolvePaymentProductScope,
  type PaymentProductScope,
} from '@/lib/payments/product-scope';
import { ensureReadingOwnedByUser } from '@/lib/saju/readings';
import {
  buildFinalizePaymentInput,
  parseFinalizePaymentResult,
} from '@/lib/payments/finalize-payment';

async function attachOwnedReading(
  paymentScope: PaymentProductScope | null,
  userId: string
): Promise<PaymentProductScope | null> {
  if (!paymentScope?.reading) return paymentScope;
  const ownedReading = await ensureReadingOwnedByUser(paymentScope.reading, userId);
  return {
    ...paymentScope,
    reading: ownedReading,
  };
}

export async function POST(req: NextRequest) {
  const validation = validatePaymentConfirmationPayload(await req.json().catch(() => null));

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { paymentKey, orderId, amount: parsedAmount, slug, pkg } = validation.input;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // ─── 1) Toss 결제 승인 (외부 호출, 멱등) ─────────────────────────────
  const payment = await confirmPayment(paymentKey, orderId, parsedAmount).catch(err => {
    return NextResponse.json({ error: err.message }, { status: 400 });
  });
  if (payment instanceof NextResponse) return payment;

  // ─── 2) 사전 계산: scope + reading 소유권 ────────────────────────────
  const paymentScope = await attachOwnedReading(
    await resolvePaymentProductScope({ pkg, slug }),
    user.id
  );

  // ─── 3) atomic finalize: 5개 후처리가 단일 트랜잭션 ─────────────────
  // (P0-2 fix audit 2026-05-13) addCredits / subscriptions UPSERT /
  // product_entitlements / credit_transactions legacy mirror /
  // paid_reading_snapshots 가 finalize_payment(JSONB) RPC 안에서 모두 일어난다.
  // 중간 실패 시 ROLLBACK 되므로 코인은 들어왔는데 권한은 없는 상태가 생기지 않는다.
  const finalizeInput = buildFinalizePaymentInput({
    userId: user.id,
    pkg,
    paymentKey,
    orderId,
    amount: parsedAmount,
    paymentScope,
    sourceSlug: slug,
  });

  const service = await createServiceClient();
  const { data: rpcData, error: rpcError } = await service.rpc('finalize_payment', {
    p_input: finalizeInput,
  });

  if (rpcError) {
    console.error('[payments/confirm] finalize_payment failed', {
      message: rpcError.message,
      code: rpcError.code,
      paymentKey,
      orderId,
      packageId: pkg.id,
    });
    return NextResponse.json(
      { error: '결제 후처리 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }

  const result = parseFinalizePaymentResult(rpcData);

  return NextResponse.json({
    success: true,
    alreadyFinalized: result.alreadyFinalized,
    credits: pkg.credits,
    totalCredits: result.totalCredits,
    balance: result.balance,
    subscriptionBalance: result.subscriptionBalance,
    subscription: isSubscriptionPackage(pkg)
      ? {
          status: 'active',
          plan: pkg.subscriptionPlan,
          renewsAt: result.subscriptionRenewsAt,
        }
      : null,
    entitlement:
      pkg.kind === 'lifetime_report'
        ? { productId: 'lifetime-report', granted: !result.alreadyFinalized }
        : null,
    productEntitlement:
      isTasteProductPackage(pkg)
        ? { productId: pkg.tasteProductId, granted: !result.alreadyFinalized }
        : null,
    product: isTasteProductPackage(pkg) ? pkg.tasteProductId : null,
    plan: 'planSlug' in pkg ? pkg.planSlug : null,
  });
}
