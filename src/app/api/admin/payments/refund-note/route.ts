// 2026-09-29 — POST /api/admin/payments/refund-note — 사유 없는 환불에 관리자가 나중에 사유를 적는다(사용자 요청).
//   결제사 콘솔에서 직접 취소한 환불은 관리자 환불 요청(refund_requests)을 거치지 않아 사유가 없다.
//   사유는 payment_orders.metadata.refundNote 에 {text, by, at} 로 남긴다(마이그레이션 없음, 돈·권한 무관).
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const ORDER_ID = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_NOTE = 200;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.role || !check.userId) {
    return NextResponse.json({ ok: false, error: check.reason ?? 'forbidden' }, { status: check.reason === 'unauthenticated' ? 401 : 403 });
  }

  const body = (await request.json().catch(() => null)) as { orderId?: unknown; note?: unknown } | null;
  const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (!ORDER_ID.test(orderId) || !note || note.length > MAX_NOTE) {
    return NextResponse.json({ ok: false, error: `주문 번호와 사유(1~${MAX_NOTE}자)가 필요합니다.` }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: order, error } = await service
    .from('payment_orders')
    .select('order_id, status, metadata')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const metadata = (order?.metadata && typeof order.metadata === 'object' ? order.metadata : {}) as Record<string, unknown>;
  // 환불된 주문(전액 또는 일부)에만 적는다.
  if (!order || (order.status !== 'refunded' && !metadata.partialRefunds)) {
    return NextResponse.json({ ok: false, error: '환불된 주문이 아닙니다.' }, { status: 404 });
  }

  const refundNote = { text: note, by: check.userId, at: new Date().toISOString() };
  const { error: updateError } = await service
    .from('payment_orders')
    .update({ metadata: { ...metadata, refundNote } })
    .eq('order_id', orderId);
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, note });
}
