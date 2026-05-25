// 2026-05-25 Phase 2 — POST /api/admin/refund.
//   action='request'(admin/super_admin): refund_requests 생성(돈 안 움직임).
//   action='approve'(super_admin): executeRefund(Toss cancel 멱등 + revoke + 상태머신).
//   action='reject'(super_admin): rejected.
//   역할 게이트(canRoleActOnRefund) + service_role.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { cancelPayment } from '@/lib/payments/toss';
import { revokeProductEntitlement } from '@/lib/product-entitlements';
import {
  canRoleActOnRefund,
  executeRefund,
  validateRefundRequest,
  type RefundAction,
  type RefundExecutionDeps,
  type RefundRequestSnapshot,
} from '@/lib/admin/refund-service';

type RevokeProductId = Parameters<typeof revokeProductEntitlement>[1];

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
    entitlementId?: string;
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
    const entitlementId = body?.entitlementId;
    const reason = (body?.reason ?? '').trim();
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
    const { data: inserted, error } = await service
      .from('refund_requests')
      .insert({
        user_id: e.user_id,
        entitlement_id: e.id,
        product_id: e.product_id,
        scope_key: e.scope_key,
        payment_key: e.payment_key,
        amount: e.amount,
        reason,
        requested_by: check.userId,
        status: 'requested',
      })
      .select('id')
      .single();
    if (error) {
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
        .select('id, status, payment_key, idempotency_key, user_id, product_id, scope_key, reason')
        .eq('id', id)
        .maybeSingle();
      return (data as RefundRequestSnapshot | null) ?? null;
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
    async tossCancel(paymentKey, options) {
      try {
        const response = await cancelPayment(paymentKey, options);
        return { ok: true, response };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Toss 결제취소 실패' };
      }
    },
    async revoke(args) {
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
  return NextResponse.json({
    ok: result.status === 'completed',
    status: result.status,
    error: result.error ?? null,
  });
}
