// 2026-08-31 — POST /api/admin/product-entitlement/revoke
//   super_admin 이 **수동 부여한** 이용권을 회수한다(부여 #726 의 역방향).
//
//   🔴 결제분은 여기서 지우지 않는다. 결제분을 지우면 PG 취소 없이 이용권만 사라져
//      "돈은 받고 상품은 뺏은" 상태가 된다 — 결제분은 환불 경로(refund)로만.
//      판정은 lib/admin/granted-entitlements 의 서명(order_id·payment_key 둘 다 null).
//
//   회수는 revokeProductEntitlement 를 그대로 쓴다 — product_entitlements 행과 legacy
//   credit_transactions 감사행을 **둘 다** 지운다. 한쪽만 지우면 2순위 조회에서 되살아난다.
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { revokeProductEntitlement } from '@/lib/product-entitlements';
import type { PaidProductId } from '@/lib/payments/product-scope';
import { isAdminGrantedEntitlement } from '@/lib/admin/granted-entitlements';
import { logAdminAccess } from '@/lib/admin/access-log';
import { refreshAdminUserSummaryForUser } from '@/lib/admin/summary-refresh';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);

  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }
  if (check.role !== 'super_admin') {
    return NextResponse.json(
      { ok: false, error: 'super_admin 만 이용권을 회수할 수 있습니다.' },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
  const entitlementId = typeof body?.entitlementId === 'string' ? body.entitlementId.trim() : '';
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';

  if (!userId || !entitlementId) {
    return NextResponse.json(
      { ok: false, error: 'userId 와 entitlementId 가 필요합니다.' },
      { status: 400 }
    );
  }
  if (reason.length < 2) {
    return NextResponse.json(
      { ok: false, error: '회수 사유를 2자 이상 입력하세요(감사 추적).' },
      { status: 400 }
    );
  }

  // 행을 먼저 읽어 **이 회원의 수동 부여분**인지 확인한다. id 만 믿고 지우지 않는다.
  const service = await createServiceClient();
  const { data: row, error: readError } = await service
    .from('product_entitlements')
    .select('id, user_id, product_id, scope_key, order_id, payment_key, amount')
    .eq('id', entitlementId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  }
  const ent = row as {
    id: string;
    user_id: string;
    product_id: string;
    scope_key: string;
    order_id: string | null;
    payment_key: string | null;
    amount: number | null;
  } | null;

  if (!ent || ent.user_id !== userId) {
    return NextResponse.json(
      { ok: false, error: '해당 회원의 이용권을 찾지 못했습니다.' },
      { status: 404 }
    );
  }
  if (!isAdminGrantedEntitlement(ent)) {
    return NextResponse.json(
      {
        ok: false,
        error: '결제된 이용권입니다. 여기서 회수하면 PG 취소 없이 권한만 사라집니다 — 환불 경로를 사용하세요.',
      },
      { status: 409 }
    );
  }

  let result: Awaited<ReturnType<typeof revokeProductEntitlement>>;
  try {
    result = await revokeProductEntitlement(userId, ent.product_id as PaidProductId, ent.scope_key, {
      reason: `admin_manual_revoke: ${reason}`,
      actor: check.userId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '회수에 실패했습니다.';
    console.error('[admin-product-revoke] 회수 실패', { userId, entitlementId, message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  await logAdminAccess({
    actorId: check.userId,
    actorRole: check.role,
    action: 'revoke_product',
    targetUser: userId,
    reason,
    meta: {
      entitlementId,
      productId: ent.product_id,
      scopeKey: ent.scope_key,
      productTableDeleted: result.productTableDeleted,
      legacyDeleted: result.legacyDeleted,
    },
  });

  await refreshAdminUserSummaryForUser(userId).catch(() => {});

  return NextResponse.json({
    ok: true,
    revoked: result.revoked,
    productTableDeleted: result.productTableDeleted,
    legacyDeleted: result.legacyDeleted,
  });
}
