// 2026-10-28 — 결제 완료(앱·랜딩 카드)와 랜딩 무통장 신청을 관리자 휴대폰으로 알린다(사용자 요청).
//   수신 번호는 LLM 경보와 같은 OPS_ALERT_PHONES(쉼표 구분). 손님 이름·전화번호는 넣지 않는다 —
//   관리자 문자함에 개인정보가 쌓이지 않게, 누르면 열리는 관리자 링크(로그인 필요)만 보낸다.
//   주문번호는 앱 결제가 관리자 화면에 안 보여 구분에 쓸 수 없어 넣지 않는다.
//   알림톡 템플릿(KAKAO_TPL_ADMIN_ORDER) 심사 전에는 같은 내용을 일반 문자로 보낸다.
//   알림톡이 실패하면 Solapi 가 같은 내용을 문자로 대신 보낸다(enableSmsFallback).
import { CANONICAL_SITE_URL } from '@/lib/site';
import { isKakaoSendConfigured } from '@/lib/kakao/config';
import { solapiSendAlimtalk, solapiSendText } from '@/lib/kakao/vendor';
import { getOpsAlertPhones } from './llm-quota-notify';

export interface AdminOrderAlertInput {
  kind: 'paid' | 'bank';
  product: string;
  amount: number;
  /** /admin/ 뒤 경로. 앱 결제 = users/<회원 id>, 랜딩 주문 = report-orders/<주문 id>. */
  adminPath: string;
}

const KIND_LABEL: Record<AdminOrderAlertInput['kind'], string> = {
  paid: '결제 완료',
  bank: '무통장 신청(입금 대기)',
};

/** 순수: 알림톡 템플릿 변수와 문자 본문. 템플릿 심사본과 같은 문구여야 한다. */
export function buildAdminOrderAlert(input: AdminOrderAlertInput) {
  const variables = {
    '#{구분}': KIND_LABEL[input.kind],
    '#{상품명}': input.product,
    '#{금액}': `${input.amount.toLocaleString('ko-KR')}원`,
    '#{확인링크}': `${CANONICAL_SITE_URL}/admin/${input.adminPath}`,
  };
  const text = [
    '[간지사주] 새 주문 알림',
    `구분: ${variables['#{구분}']}`,
    `상품: ${variables['#{상품명}']}`,
    `금액: ${variables['#{금액}']}`,
    `확인: ${variables['#{확인링크}']}`,
  ].join('\n');
  return { variables, text };
}

export function pickAdminAlertChannel(templateCode: string, kakaoConfigured: boolean): 'alimtalk' | 'sms' {
  return templateCode && kakaoConfigured ? 'alimtalk' : 'sms';
}

/** 결제·주문 흐름에서 부른다. 어떤 실패도 던지지 않는다 — 알림 때문에 결제 응답이 깨지면 안 된다. */
export async function sendAdminOrderAlert(input: AdminOrderAlertInput): Promise<void> {
  try {
    const phones = getOpsAlertPhones();
    if (phones.length === 0) return;
    const { variables, text } = buildAdminOrderAlert(input);
    const templateCode = process.env.KAKAO_TPL_ADMIN_ORDER?.trim() ?? '';
    const channel = pickAdminAlertChannel(templateCode, isKakaoSendConfigured());
    const results = await Promise.all(
      phones.map((to) =>
        channel === 'alimtalk'
          ? solapiSendAlimtalk({ to, templateCode, variables, enableSmsFallback: true })
          : solapiSendText({ to, text })
      )
    );
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) console.error('[admin-order-alert] 발송 실패', { adminPath: input.adminPath, channel, errors: failed.map((r) => r.error) });
  } catch (error) {
    console.error('[admin-order-alert] 발송 실패', { adminPath: input.adminPath, error: error instanceof Error ? error.message : 'unknown' });
  }
}
