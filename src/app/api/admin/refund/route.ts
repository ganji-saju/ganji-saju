// 2026-05-25 Phase 2 — POST /api/admin/refund.
//   action='request'(admin/super_admin): refund_requests 생성(돈 안 움직임).
//   action='approve'(super_admin): executeRefund(Toss cancel 멱등 + revoke + 상태머신).
//   action='reject'(super_admin): rejected.
//   역할 게이트(canRoleActOnRefund) + service_role.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { cancelPayment, getPayment } from '@/lib/payments/toss';
import {
  cancelNicepayPayment,
  getNicepayPayment,
  normalizeNicepayPaymentForRefund,
} from '@/lib/payments/nicepay';
import {
  getOrderProviderByPaymentKey,
  getPaymentOrderByPaymentKey,
  markPaymentOrderRefunded,
} from '@/lib/payments/order-ledger';
import {
  isFullRefund,
  resolveCancellationTerminalStatus,
} from '@/lib/payments/cancellation';
import { revokeProductEntitlement } from '@/lib/product-entitlements';
import {
  buildCreditRefundItem,
  type CreditRefundLotRow,
  type CreditRefundTransactionRow,
} from '@/lib/admin/credit-refunds';
import {
  REFUND_DEDUPE_STATUSES,
  canRoleActOnRefund,
  executeRefund,
  validateRefundRequest,
  type RefundAction,
  type RefundExecutionDeps,
  type RefundKind,
  type RefundRequestSnapshot,
} from '@/lib/admin/refund-service';
import { revokeCreditPurchaseLots } from '@/lib/credits/refunds';

type RevokeProductId = Parameters<typeof revokeProductEntitlement>[1];
type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

async function buildCreditRefundRequestItem(service: ServiceClient, creditTransactionId: string) {
  const { data: tx } = await service
    .from('credit_transactions')
    .select('id, user_id, type, amount, metadata, created_at, feature')
    .eq('id', creditTransactionId)
    .maybeSingle();
  if (!tx) return null;

  const row = tx as {
    id: string;
    user_id: string;
    type: string;
    amount: number;
    metadata: Record<string, unknown> | null;
    created_at: string;
    feature: string | null;
  };
  const paymentKey =
    row.metadata && typeof row.metadata.paymentKey === 'string' ? row.metadata.paymentKey : null;
  if (!paymentKey) {
    return { row, item: null };
  }

  const { data: lots } = await service
    .from('credit_lots')
    .select('id, user_id, amount_remaining, amount_initial, expires_at, source, metadata, created_at')
    .eq('user_id', row.user_id)
    .eq('source', 'purchase')
    .contains('metadata', { paymentKey });

  return {
    row,
    item: buildCreditRefundItem(
      row as CreditRefundTransactionRow,
      (lots ?? []) as unknown as CreditRefundLotRow[]
    ),
  };
}

async function findExistingRefundRequest(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  input: { entitlementId?: string | null; creditTransactionId?: string | null; paymentKey: string | null }
) {
  if (input.entitlementId) {
    const byEntitlement = await service
      .from('refund_requests')
      .select('id, status, error_message, created_at')
      .eq('entitlement_id', input.entitlementId)
      .in('status', REFUND_DEDUPE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1);
    if (byEntitlement.error) {
      throw new Error(byEntitlement.error.message);
    }
    if (byEntitlement.data?.[0]) {
      return byEntitlement.data[0] as {
        id: string;
        status: string;
        error_message: string | null;
        created_at: string;
      };
    }
  }

  if (input.creditTransactionId) {
    const byCreditTransaction = await service
      .from('refund_requests')
      .select('id, status, error_message, created_at')
      .eq('credit_transaction_id', input.creditTransactionId)
      .in('status', REFUND_DEDUPE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1);
    if (byCreditTransaction.error) {
      throw new Error(byCreditTransaction.error.message);
    }
    if (byCreditTransaction.data?.[0]) {
      return byCreditTransaction.data[0] as {
        id: string;
        status: string;
        error_message: string | null;
        created_at: string;
      };
    }
  }

  if (!input.paymentKey) return null;
  const byPaymentKey = await service
    .from('refund_requests')
    .select('id, status, error_message, created_at')
    .eq('payment_key', input.paymentKey)
    .in('status', REFUND_DEDUPE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);
  if (byPaymentKey.error) {
    throw new Error(byPaymentKey.error.message);
  }
  return (byPaymentKey.data?.[0] as {
    id: string;
    status: string;
    error_message: string | null;
    created_at: string;
  } | undefined) ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    action?: RefundAction;
    kind?: RefundKind;
    entitlementId?: string;
    creditTransactionId?: string;
    reason?: string;
    requestId?: string;
  } | null;
  const action = body?.action;
  if (action !== 'request' && action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ ok: false, error: 'action must be request|approve|reject' }, { status: 400 });
  }
  if (!canRoleActOnRefund(check.role, action)) {
    return NextResponse.json(
      { ok: false, error: `${check.role} 는 '${action}' 권한이 없습니다.` },
      { status: 403 }
    );
  }

  const service = await createServiceClient();

  // ── 환불 요청 생성 (돈 안 움직임) ──
  if (action === 'request') {
    const kind: RefundKind = body?.kind === 'credit_purchase' ? 'credit_purchase' : 'product';
    const entitlementId = body?.entitlementId;
    const creditTransactionId = body?.creditTransactionId;
    const reason = (body?.reason ?? '').trim();
    if (kind === 'credit_purchase') {
      if (!creditTransactionId) {
        return NextResponse.json({ ok: false, error: 'creditTransactionId 가 필요합니다.' }, { status: 400 });
      }

      const credit = await buildCreditRefundRequestItem(service, creditTransactionId);
      if (!credit?.row) {
        return NextResponse.json({ ok: false, error: '전 결제 내역을 찾을 수 없습니다.' }, { status: 404 });
      }
      if (!credit.item) {
        return NextResponse.json({ ok: false, error: '환불 가능한 전 결제가 아닙니다.' }, { status: 400 });
      }
      if (credit.item.status === 'none' || credit.item.refundAmountWon <= 0) {
        return NextResponse.json(
          { ok: false, error: credit.item.statusLabel || '환불 가능한 잔여 전이 없습니다.' },
          { status: 400 }
        );
      }

      const v = validateRefundRequest({
        amount: credit.item.refundAmountWon,
        paymentKey: credit.item.paymentKey,
        reason,
      });
      if (!v.ok) {
        return NextResponse.json({ ok: false, error: v.errors.join(' / ') }, { status: 400 });
      }

      const existing = await findExistingRefundRequest(service, {
        creditTransactionId: credit.row.id,
        paymentKey: credit.item.paymentKey,
      });
      if (existing) {
        return NextResponse.json(
          {
            ok: false,
            error: `이미 환불 요청이 있습니다. 기존 요청 상태: ${existing.status}`,
            existingRequest: existing,
          },
          { status: 409 }
        );
      }

      const { data: inserted, error } = await service
        .from('refund_requests')
        .insert({
          user_id: credit.row.user_id,
          refund_kind: 'credit_purchase',
          credit_transaction_id: credit.row.id,
          product_id: credit.item.packageId ?? 'credit_purchase',
          scope_key: null,
          payment_key: credit.item.paymentKey,
          amount: credit.item.refundAmountWon,
          original_amount: credit.item.originalAmountWon,
          credit_amount: credit.item.coinsRemaining,
          reason,
          requested_by: check.userId,
          status: 'requested',
          refund_metadata: {
            packageId: credit.item.packageId,
            orderId: credit.item.orderId,
            coinsPurchased: credit.item.coinsPurchased,
            coinsRemaining: credit.item.coinsRemaining,
            coinsUsed: credit.item.coinsUsed,
            policyStatus: credit.item.status,
            lotIds: credit.item.lotIds,
          },
        })
        .select('id')
        .single();
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { ok: false, error: '이미 같은 결제 또는 전 충전건의 환불 요청이 있습니다.' },
            { status: 409 }
          );
        }
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, requestId: (inserted as { id: string }).id, status: 'requested' });
    }

    if (!entitlementId) {
      return NextResponse.json({ ok: false, error: 'entitlementId 가 필요합니다.' }, { status: 400 });
    }
    const { data: ent } = await service
      .from('product_entitlements')
      .select('id, user_id, product_id, scope_key, payment_key, amount')
      .eq('id', entitlementId)
      .maybeSingle();
    if (!ent) {
      return NextResponse.json({ ok: false, error: 'entitlement 를 찾을 수 없습니다.' }, { status: 404 });
    }
    const e = ent as {
      id: string;
      user_id: string;
      product_id: string;
      scope_key: string | null;
      payment_key: string | null;
      amount: number | null;
    };
    const v = validateRefundRequest({ amount: e.amount, paymentKey: e.payment_key, reason });
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.errors.join(' / ') }, { status: 400 });
    }
    const existing = await findExistingRefundRequest(service, {
      entitlementId: e.id,
      paymentKey: e.payment_key,
    });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `이미 환불 요청이 있습니다. 기존 요청 상태: ${existing.status}`,
          existingRequest: existing,
        },
        { status: 409 }
      );
    }
    const { data: inserted, error } = await service
      .from('refund_requests')
      .insert({
        user_id: e.user_id,
        refund_kind: 'product',
        entitlement_id: e.id,
        product_id: e.product_id,
        scope_key: e.scope_key,
        payment_key: e.payment_key,
        amount: e.amount,
        original_amount: e.amount,
        credit_amount: null,
        reason,
        requested_by: check.userId,
        status: 'requested',
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { ok: false, error: '이미 같은 결제 또는 권한의 환불 요청이 있습니다.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, requestId: (inserted as { id: string }).id, status: 'requested' });
  }

  // ── 거부 (super_admin) ──
  const requestId = body?.requestId;
  if (!requestId) {
    return NextResponse.json({ ok: false, error: 'requestId 가 필요합니다.' }, { status: 400 });
  }
  if (action === 'reject') {
    await service
      .from('refund_requests')
      .update({ status: 'rejected', approved_by: check.userId, updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'requested');
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  // ── 승인·실행 (super_admin) — executeRefund 에 실제 deps 주입 ──
  const deps: RefundExecutionDeps = {
    async loadRequest(id) {
      const { data } = await service
        .from('refund_requests')
        .select(
          'id, status, refund_kind, payment_key, idempotency_key, user_id, product_id, scope_key, amount, original_amount, credit_amount, credit_transaction_id, reason'
        )
        .eq('id', id)
        .maybeSingle();
      if (!data) return null;
      const row = data as Partial<RefundRequestSnapshot> & {
        id: string;
        status: RefundRequestSnapshot['status'];
        payment_key: string | null;
        idempotency_key: string;
        user_id: string;
        product_id: string;
        scope_key: string | null;
        reason: string;
      };
      return {
        ...row,
        refund_kind: row.refund_kind ?? 'product',
        amount: row.amount ?? null,
        original_amount: row.original_amount ?? null,
        credit_amount: row.credit_amount ?? null,
        credit_transaction_id: row.credit_transaction_id ?? null,
      } as RefundRequestSnapshot;
    },
    async setStatus(id, status, patch) {
      await service
        .from('refund_requests')
        .update({
          status,
          ...(patch?.approvedBy ? { approved_by: patch.approvedBy } : {}),
          ...(patch?.tossResponse !== undefined ? { toss_response: patch.tossResponse } : {}),
          ...(patch?.errorMessage !== undefined ? { error_message: patch.errorMessage } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    },
    // 2026-06-26 — PG 분기: order metadata.provider 로 nicepay/toss 취소 선택.
    //   나이스페이는 cancelNicepayPayment(idempotencyKey 로 멱등). 옵션 매핑(cancelReason→reason 등).
    async tossCancel(paymentKey, options) {
      const provider = await getOrderProviderByPaymentKey(paymentKey);
      if (provider === 'nicepay') {
        try {
          // 2026-07-19 🔴 나이스페이 취소는 orderId 가 **필수**인데 넘기지 않고 있었다.
          //   실패한 환불 요청에 남은 PG 응답: "orderId 필수입력항목이 누락되었습니다."
          //   (refund_requests.error_message, 2026-07-19 13:04 관리자 환불 2건 연속 실패)
          //   payment_key 로 원주문을 찾아 orderId 를 실어 보낸다.
          const order = await getPaymentOrderByPaymentKey(paymentKey);
          if (!order?.orderId) {
            // orderId 없이 보내면 PG 가 거절한다. 조용히 진행하지 말고 사유를 남긴다.
            return { ok: false, error: '원주문을 찾지 못해 결제취소를 보낼 수 없습니다(orderId 없음).' };
          }
          const response = await cancelNicepayPayment(paymentKey, {
            reason: options.cancelReason,
            orderId: order.orderId,
            idempotencyKey: options.idempotencyKey,
            ...(typeof options.cancelAmount === 'number' ? { cancelAmt: options.cancelAmount } : {}),
          });
          return { ok: true, response };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : '나이스페이 결제취소 실패' };
        }
      }
      try {
        const response = await cancelPayment(paymentKey, options);
        return { ok: true, response };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Toss 결제취소 실패' };
      }
    },
    async loadTossPayment(paymentKey) {
      // 2026-07-19 — 기존 주석: "나이스페이는 멱등으로 흡수하므로 토스만 조회".
      //   그 가정이 틀렸다 — 나이스페이가 재취소를 "해당거래 취소실패(기취소성공)" 으로 거절해
      //   백스톱이 필요했는데 여기서 토스를 조회하는 바람에 확인이 불가능했다.
      //   결과: 돈은 환불됐는데 요청은 failed 로 남고 주문이 refunded 로 표기되지 않았다.
      const provider = await getOrderProviderByPaymentKey(paymentKey);
      if (provider === 'nicepay') {
        try {
          const raw = await getNicepayPayment(paymentKey);
          // 백스톱 판정기는 토스 스키마만 이해한다 — 정규화해서 넘긴다.
          return { ok: true, payment: { ...raw, ...normalizeNicepayPaymentForRefund(raw) } };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : '나이스페이 결제 조회 실패',
          };
        }
      }
      try {
        return { ok: true, payment: await getPayment(paymentKey) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Toss 결제 조회 실패' };
      }
    },
    async revoke(args) {
      if (args.refundKind === 'credit_purchase') {
        if (!args.paymentKey) return { revoked: false };
        const result = await revokeCreditPurchaseLots({
          userId: args.userId,
          paymentKey: args.paymentKey,
          refundRequestId: args.refundRequestId,
          refundAmount: args.amount,
          reason: args.reason,
          actor: args.actor,
        });
        return { revoked: result.revoked };
      }

      const result = await revokeProductEntitlement(
        args.userId,
        args.productId as RevokeProductId,
        args.scopeKey,
        { reason: args.reason, actor: args.actor, paymentKey: args.paymentKey }
      );
      return { revoked: result.revoked };
    },
  };

  const result = await executeRefund({ requestId, approvedBy: check.userId }, deps);

  // 2026-07-13 — 전액환불 완료 시 원주문을 refunded 로 표기(webhook 취소통보 경로와 대칭).
  //   이게 없으면 admin 환불한 주문이 fulfilled 로 남아 매출에 과대계상된다.
  //   부분환불은 나머지 매출을 지키기 위해 건드리지 않는다(비차단 — 실패해도 환불 자체는 완료).
  if (result.status === 'completed') {
    try {
      const snapshot = await deps.loadRequest(requestId);
      if (
        snapshot?.payment_key &&
        isFullRefund({ amount: snapshot.amount, originalAmount: snapshot.original_amount })
      ) {
        const order = await getPaymentOrderByPaymentKey(snapshot.payment_key);
        if (
          order &&
          resolveCancellationTerminalStatus({
            status: order.status,
            confirmedAt: order.confirmedAt,
            fulfilledAt: order.fulfilledAt,
          }) === 'refunded'
        ) {
          await markPaymentOrderRefunded({
            orderId: order.orderId,
            reason: '관리자 환불 승인',
            source: 'admin-refund',
          });
        }
      }
    } catch (err) {
      console.error('[admin/refund] 원주문 refunded 표기 실패', {
        requestId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: result.status === 'completed',
    status: result.status,
    error: result.error ?? null,
  });
}
