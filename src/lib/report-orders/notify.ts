import 'server-only';
import { solapiSendText } from '@/lib/kakao/vendor';
import { formatWon } from '@/lib/payments/catalog';
import { isEmailNotificationConfigured, sendNotificationEmail } from '@/lib/email/notification-email';
import { CANONICAL_SITE_URL } from '@/lib/site';
import { getReportBankAccount } from './bank-account';
import { REPORT_PRODUCT_LABEL } from './report-order';
import type { ReportOrderRow } from './report-order-store';

const KST_DATE = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' });

/** 접수 확인 문자. 실패해도 주문은 그대로 둔다(관리자 화면에서 연락 가능). */
export async function sendOrderReceivedText(order: ReportOrderRow): Promise<void> {
  if (!order.phone || !order.name) return;
  const product = REPORT_PRODUCT_LABEL[order.product];
  const bank = getReportBankAccount();
  const text = order.payMethod === 'bank' && bank
    ? [
        `[간지사주] ${order.name}님, ${product} 신청이 접수됐어요.`,
        `입금하실 곳: ${bank.bank} ${bank.account} (${bank.holder})`,
        `금액: ${formatWon(order.amount)} · 입금자명: ${order.name}`,
        order.depositDueAt ? `${KST_DATE.format(new Date(order.depositDueAt))}까지 입금해 주세요.` : '',
        `입금이 확인되면 영업일 1~2일 안에 풀이를 보내 드려요. (주문번호 ${order.orderNo})`,
      ].filter(Boolean).join('\n')
    : `[간지사주] ${order.name}님, ${product} 결제가 완료됐어요. 영업일 1~2일 안에 문자와 이메일로 풀이를 보내 드려요. (주문번호 ${order.orderNo})`;
  try {
    const result = await solapiSendText({ to: order.phone, text });
    if (!result.ok) console.error('[report-orders] 접수 문자 실패', { orderNo: order.orderNo, error: result.error });
  } catch (error) {
    console.error('[report-orders] 접수 문자 실패', { orderNo: order.orderNo, error: error instanceof Error ? error.message : 'unknown' });
  }
}

/** 상담사 확인 뒤 결과 링크 발송(문자 + 이메일). 하나라도 성공하면 발송으로 본다 — 결과는 주문에 남긴다. */
export async function sendReportReadyMessages(order: ReportOrderRow): Promise<{ sms: boolean; email: boolean }> {
  if (!order.resultToken || !order.name) return { sms: false, email: false };
  const product = REPORT_PRODUCT_LABEL[order.product];
  const url = `${CANONICAL_SITE_URL}/r/${order.resultToken}`;
  const sms = order.phone
    ? await solapiSendText({
        to: order.phone,
        text: `[간지사주] ${order.name}님, 요청하신 ${product} 풀이가 준비됐어요.\n${url}\n링크를 열면 풀이를 보고 PDF로 저장할 수 있어요. 링크는 1년간 열 수 있어요.`,
      }).then((r) => r.ok, () => false)
    : false;
  const email = order.email && isEmailNotificationConfigured()
    ? await sendNotificationEmail({
        to: order.email,
        displayName: order.name,
        title: `${product} 풀이가 준비됐어요`,
        body: '아래 버튼으로 풀이를 보고 PDF로 저장할 수 있어요. 링크는 1년간 열 수 있어요.',
        url,
      }).then(() => true, () => false)
    : false;
  if (!sms || !email) console.error('[report-orders] 결과 발송 일부 실패', { orderNo: order.orderNo, sms, email });
  return { sms, email };
}
