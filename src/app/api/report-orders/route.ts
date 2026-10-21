// 한 장짜리 랜딩(/saju-report) 비회원 주문. 로그인 없이 카드(나이스페이) 또는 무통장으로 받는다.
//   카드: 결제 원장(payment_orders, user 없음)을 먼저 만들고 그 주문번호로 랜딩 주문을 잇는다 → 승인·정산·취소는 기존 나이스페이 경로.
//   무통장: 랜딩 주문만 만들고 계좌를 안내한다 → 관리자가 입금 확인.
//   이름·연락처·생년월일은 응답·로그·퍼널에 남기지 않는다.
import { NextRequest, NextResponse } from 'next/server';
import { getPackage } from '@/lib/payments/catalog';
import { getPaymentProvider } from '@/lib/payments/provider';
import { buildPaymentOrigin } from '@/lib/payments/payment-origin';
import { createPaymentOrder } from '@/lib/payments/order-ledger';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { logPaymentFunnelEvent } from '@/lib/payments/funnel-log';
import { createClient } from '@/lib/supabase/server';
import { parseReportOrderForm, REPORT_PACKAGE_BY_PRODUCT } from '@/lib/report-orders/report-order';
import { createReportOrder } from '@/lib/report-orders/report-order-store';
import { getReportBankAccount } from '@/lib/report-orders/bank-account';
import { sendOrderReceivedText } from '@/lib/report-orders/notify';
import { takeReportOrderSlot } from '@/lib/report-orders/rate-limit';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 8_192;
function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function hasSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin || req.headers.get('sec-fetch-site') === 'cross-site') return false;
  try { return new URL(origin).origin === new URL(req.url).origin; } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!hasSameOrigin(req)) return json({ ok: false, error: '페이지를 새로고침한 뒤 다시 신청해 주세요.' }, 403);
  const text = await req.text().catch(() => '');
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return json({ ok: false, error: '입력 내용이 너무 깁니다.' }, 400);
  let payload: unknown;
  try { payload = JSON.parse(text); } catch { return json({ ok: false, error: '입력 내용을 읽을 수 없습니다.' }, 400); }

  const parsed = parseReportOrderForm(payload);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const order = parsed.order;

  const bank = getReportBankAccount();
  if (order.payMethod === 'bank' && !bank) return json({ ok: false, error: '지금은 무통장 입금을 받지 않아요. 카드로 결제해 주세요.' }, 400);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (!takeReportOrderSlot(ip)) return json({ ok: false, error: '신청이 너무 많아요. 잠시 뒤 다시 시도해 주세요.' }, 429);

  const pkg = getPackage(REPORT_PACKAGE_BY_PRODUCT[order.product]);
  if (!pkg) return json({ ok: false, error: '상품을 찾지 못했어요.' }, 400);
  // 🔴 금액은 서버(카탈로그 + 관리자 가격 덮어쓰기)만. 화면이 보낸 금액은 읽지 않는다.
  const price = await resolvePackagePrice(pkg.id);
  const source = typeof (payload as Record<string, unknown>).source === 'string'
    ? String((payload as Record<string, unknown>).source).slice(0, 60) || null
    : null;

  try {
    if (order.payMethod === 'card') {
      const paymentOrder = await createPaymentOrder({
        userId: null,
        pkg,
        listAmount: price,
        entrySource: 'saju-report',
        acceptedKinds: ['terms', 'privacy', 'refund', 'digital-content'],
        recordedPolicyVersionIds: [],
        metadata: {
          checkoutPath: '/saju-report',
          provider: getPaymentProvider(),
          origin: buildPaymentOrigin(req.headers.get('host')),
          reportOrder: true,
        },
      });
      await createReportOrder({ ...order, amount: paymentOrder.amount, paymentOrderId: paymentOrder.orderId, source });
      await logPaymentFunnelEvent(await createClient(), {
        stage: 'prepare_ready',
        userId: null,
        packageId: pkg.id,
        amount: paymentOrder.amount,
        orderId: paymentOrder.orderId,
        metadata: { reportOrder: true },
      });
      return json({ ok: true, payMethod: 'card', orderId: paymentOrder.orderId, amount: paymentOrder.amount, goodsName: pkg.name });
    }

    const saved = await createReportOrder({ ...order, amount: price, paymentOrderId: null, source });
    await sendOrderReceivedText(saved);
    return json({
      ok: true, payMethod: 'bank', orderNo: saved.orderNo, amount: saved.amount,
      bank: bank!.bank, account: bank!.account, holder: bank!.holder, depositDueAt: saved.depositDueAt,
    });
  } catch (error) {
    console.error('[report-orders] 주문 저장 실패', { product: order.product, payMethod: order.payMethod, error: error instanceof Error ? error.message : 'unknown' });
    return json({ ok: false, error: '신청을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' }, 500);
  }
}
