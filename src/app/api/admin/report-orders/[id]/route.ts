// 랜딩 비회원 주문 관리(최고 관리자 = 상담사). 입금 확인 → 풀이 만들기 → 확인 후 발송 → 필요하면 취소·환불.
//   응답에는 상태만 싣는다 — 연락처·생년월일은 관리자 화면(서버 렌더)에서만 보인다.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient } from '@/lib/supabase/server';
import { logAdminAccess } from '@/lib/admin/access-log';
import { generateExternalNewYearReport, generateExternalReport, parseExternalReportRequest } from '@/lib/admin/external-report';
import { deleteExternalReport, saveExternalReport } from '@/lib/admin/external-report-history';
import { getPaymentOrderByOrderId, markPaymentOrderRefunded, type TossPaymentObject } from '@/lib/payments/order-ledger';
import { cancelNicepayPayment, getNicepayPayment } from '@/lib/payments/nicepay';
import { fulfillPaymentOrder } from '@/lib/payments/fulfillment';
import { getReportOrder, markReportOrderPaidByPaymentOrder, markReportOrderRefundedByPaymentOrder, recordReportOrderSendResult, transitionReportOrder } from '@/lib/report-orders/report-order-store';
import { sendReportReadyMessages } from '@/lib/report-orders/notify';
import { isResultLinkExpired } from '@/lib/report-orders/report-order';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ACTIONS = ['confirm_deposit', 'confirm_card', 'generate', 'send', 'resend', 'cancel', 'refund_card', 'mark_refunded'] as const;
type Action = (typeof ACTIONS)[number];
// 같은 인스턴스에서 같은 주문 풀이를 두 번 동시에 만들지 않는다(외부 주문 PDF 라우트와 같은 방식).
const generating = new Set<string>();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function hasSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin || req.headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return new URL(origin).origin === new URL(req.url).origin; } catch { return false; }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await getCurrentAdminRole(await createClient());
  if (!check.ok || !check.userId || check.role !== 'super_admin') return json({ ok: false, error: '최고 관리자 권한이 필요합니다.' }, 403);
  if (!hasSameOrigin(req)) return json({ ok: false, error: '관리자 화면에서 다시 요청해 주세요.' }, 403);

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: '주문을 찾지 못했습니다.' }, 404);
  const body = (await req.json().catch(() => null)) as { action?: string; note?: string; reportId?: string } | null;
  const action = ACTIONS.find((a) => a === body?.action) as Action | undefined;
  if (!action) return json({ ok: false, error: '알 수 없는 작업입니다.' }, 400);
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : '';

  const order = await getReportOrder(id);
  if (!order) return json({ ok: false, error: '주문을 찾지 못했습니다.' }, 404);
  const actor = check.userId;
  const now = () => new Date().toISOString();

  try {
    let status: string;
    switch (action) {
      case 'confirm_deposit': {
        if (order.payMethod !== 'bank') return json({ ok: false, error: '무통장 주문만 입금 확인을 합니다.' }, 400);
        status = (await transitionReportOrder(id, 'paid', { deposit_confirmed_at: now(), deposit_confirmed_by: actor })).status;
        break;
      }
      case 'generate': {
        if (order.status !== 'paid' && order.status !== 'generated') return json({ ok: false, error: '결제(입금) 확인된 주문만 풀이를 만듭니다.' }, 409);
        if (!order.birth) return json({ ok: false, error: '보관 기간이 지나 출생 정보가 없습니다.' }, 409);
        if (generating.has(id)) return json({ ok: false, error: '이 주문의 풀이를 만드는 중입니다.' }, 429);
        const parsed = parseExternalReportRequest({ ...order.birth, kind: order.product });
        if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
        generating.add(id);
        try {
          const report = parsed.kind === 'new-year'
            ? await generateExternalNewYearReport(parsed.input, { signal: req.signal })
            : await generateExternalReport(parsed.input, { signal: req.signal });
          const saved = await saveExternalReport({ actorId: actor, birth: parsed.birth, report });
          try {
            status = (await transitionReportOrder(id, 'generated', { external_report_id: saved.id, generated_at: now() }, { expectReportId: order.externalReportId })).status;
          } catch (error) {
            // 생성 중 환불·다른 탭 생성 등으로 상태가 바뀌었다 — 연결되지 못한 원본(이름·생년월일 포함)을 남기지 않는다.
            await deleteExternalReport(saved.id).catch(() => undefined);
            throw error;
          }
          // 다시 만들기: 이전 원본은 더 이상 어디에도 연결되지 않으므로 지운다(보관 기간 삭제 크론은 현재 원본만 본다).
          if (order.externalReportId && order.externalReportId !== saved.id) {
            await deleteExternalReport(order.externalReportId).catch(() => undefined);
          }
          await logAdminAccess({
            actorId: actor, actorRole: check.role, action: 'generate_report_order', targetUser: null,
            meta: { orderNo: order.orderNo, reportNo: report.data.reportNo, generationSource: report.generationSource },
          });
          return json({ ok: true, status, generationWarning: report.generationWarning ?? null });
        } finally {
          generating.delete(id);
        }
      }
      case 'send': {
        if (order.status !== 'generated') return json({ ok: false, error: '풀이를 만든 뒤 보낼 수 있습니다.' }, 409);
        // 상담사가 미리보기로 본 그 풀이만 보낸다 — 다른 탭에서 다시 만들었으면 새로고침해서 다시 확인.
        if (!order.externalReportId || body?.reportId !== order.externalReportId) {
          return json({ ok: false, error: '풀이가 바뀌었습니다. 새로고침해서 다시 확인해 주세요.' }, 409);
        }
        // 상태를 먼저 잡는다: 동시에 두 번 눌러도 한 번만 보내고, 문자를 받은 손님이 바로 열어도 링크가 열린다.
        status = (await transitionReportOrder(id, 'sent', { sent_at: now(), reviewed_at: now(), reviewed_by: actor }, { expectReportId: order.externalReportId })).status;
        const result = await sendReportReadyMessages(order);
        await recordReportOrderSendResult(id, result);
        await logAdminAccess({ actorId: actor, actorRole: check.role, action: 'send_report_order', targetUser: null, meta: { orderNo: order.orderNo, ...result } });
        if (!result.sms && !result.email) return json({ ok: false, error: '문자와 이메일 모두 보내지 못했습니다. 연락처를 확인하고 "다시 보내기"를 눌러 주세요.' }, 502);
        return json({ ok: true, status, ...result });
      }
      case 'resend': {
        if (order.status !== 'sent') return json({ ok: false, error: '발송 완료된 주문만 다시 보냅니다.' }, 409);
        if (isResultLinkExpired(order.sentAt)) return json({ ok: false, error: '첫 발송 후 1년이 지나 링크가 닫혔습니다.' }, 409);
        const result = await sendReportReadyMessages(order);
        await recordReportOrderSendResult(id, result);
        await logAdminAccess({ actorId: actor, actorRole: check.role, action: 'send_report_order', targetUser: null, meta: { orderNo: order.orderNo, resend: true, ...result } });
        if (!result.sms && !result.email) return json({ ok: false, error: '문자와 이메일 모두 보내지 못했습니다. 연락처를 확인해 주세요.' }, 502);
        return json({ ok: true, status: order.status, ...result });
      }
      case 'confirm_card': {
        // 나이스페이 승인은 됐는데 확정이 실패한 카드 주문 되살리기(정산 크론은 아직 토스만 조회한다).
        if (order.payMethod !== 'card' || !order.paymentOrderId || order.status !== 'pending_payment') {
          return json({ ok: false, error: '결제 대기 중인 카드 주문만 확인합니다.' }, 400);
        }
        const paymentOrder = await getPaymentOrderByOrderId(order.paymentOrderId);
        if (!paymentOrder?.paymentKey) return json({ ok: false, error: '결제 승인 기록이 없습니다(손님이 결제를 끝내지 않았을 수 있습니다).' }, 409);
        const nice = await getNicepayPayment(paymentOrder.paymentKey);
        if (nice.status !== 'paid' || Number(nice.amount) !== paymentOrder.amount) {
          return json({ ok: false, error: '나이스페이에서 결제 완료를 확인하지 못했습니다.' }, 409);
        }
        await fulfillPaymentOrder({
          order: paymentOrder,
          payment: { ...(nice as unknown as TossPaymentObject), status: 'DONE', paymentKey: paymentOrder.paymentKey, orderId: paymentOrder.orderId, totalAmount: paymentOrder.amount, amount: paymentOrder.amount },
          source: 'reconciliation',
        });
        // 원장이 이미 확정(이전 시도)이면 fulfill 은 아무것도 안 하고 돌아온다 — 랜딩 주문은 여기서 직접 맞춘다(멱등).
        //   원장이 다른 처리 중(fulfilling)이라 주문이 아직 결제 대기면 false → 다시 누르게 한다.
        const paidNow = await markReportOrderPaidByPaymentOrder(order.paymentOrderId);
        if (!paidNow) return json({ ok: false, error: '결제는 확인됐지만 주문 확정이 끝나지 않았습니다. 잠시 뒤 다시 눌러 주세요.' }, 409);
        status = 'paid';
        break;
      }
      case 'cancel': {
        // 카드 결제 대기 주문은 취소하지 않는다 — 결제창에서 결제가 끝나면 돈만 받고 취소로 남는다(보관 기간 크론이 정리).
        if (order.payMethod === 'card') return json({ ok: false, error: '카드 주문은 취소하지 않습니다. 결제됐다면 결제 취소(환불)를 쓰세요.' }, 400);
        status = (await transitionReportOrder(id, 'cancelled', { refund_note: note || null })).status;
        break;
      }
      case 'refund_card': {
        if (order.payMethod !== 'card' || !order.paymentOrderId) return json({ ok: false, error: '카드 주문만 결제 취소를 합니다.' }, 400);
        if (!['paid', 'generated', 'sent'].includes(order.status)) return json({ ok: false, error: '결제 완료된 주문만 취소합니다.' }, 409);
        const paymentOrder = await getPaymentOrderByOrderId(order.paymentOrderId);
        if (!paymentOrder?.paymentKey) return json({ ok: false, error: '결제 정보를 찾지 못했습니다.' }, 409);
        const reason = note || '고객 요청 환불';
        const payment = await cancelNicepayPayment(paymentOrder.paymentKey, {
          reason, orderId: paymentOrder.orderId, idempotencyKey: `report-refund-${order.id}`,
        });
        await markPaymentOrderRefunded({ orderId: paymentOrder.orderId, reason, source: 'admin-refund', payment: payment as unknown as TossPaymentObject });
        await markReportOrderRefundedByPaymentOrder(paymentOrder.orderId, reason);
        status = 'refunded';
        break;
      }
      case 'mark_refunded': {
        if (order.payMethod !== 'bank') return json({ ok: false, error: '카드 주문은 결제 취소를 쓰세요.' }, 400);
        if (!note) return json({ ok: false, error: '환불 메모(이체 일시 등)를 적어 주세요.' }, 400);
        status = (await transitionReportOrder(id, 'refunded', { refunded_at: now(), refund_note: note })).status;
        break;
      }
    }
    await logAdminAccess({ actorId: actor, actorRole: check.role, action: `report_order_${action}`, targetUser: null, meta: { orderNo: order.orderNo } });
    return json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'report_order_invalid_transition' || message === 'report_order_conflict') {
      return json({ ok: false, error: '지금 상태에서는 할 수 없는 작업입니다. 새로고침해 주세요.' }, 409);
    }
    console.error('[admin/report-orders] 처리 실패', { orderNo: order.orderNo, action, error: message });
    return json({ ok: false, error: '처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }, 500);
  }
}
