import assert from 'node:assert/strict';
import { buildAdminOrderAlert, pickAdminAlertChannel } from './order-alert';

// 2026-10-28 — 결제·무통장 신청 관리자 알림 문구 가드. 알림톡 템플릿 변수와 문자 본문이 같은 값을 담아야 한다.
//   주문번호는 앱 결제가 관리자 화면에 안 보여 쓸모가 없다 → 누르면 바로 열리는 관리자 링크를 보낸다.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('결제 완료 알림은 구분·상품·금액·확인 링크를 템플릿 변수와 문자 본문에 같이 담는다', () => {
  const alert = buildAdminOrderAlert({ kind: 'paid', product: '2027 신년운세', amount: 9900, adminPath: 'users/u-1' });
  assert.deepEqual(alert.variables, {
    '#{구분}': '결제 완료',
    '#{상품명}': '2027 신년운세',
    '#{금액}': '9,900원',
    '#{확인링크}': 'https://ganjisaju.kr/admin/users/u-1',
  });
  for (const value of Object.values(alert.variables)) assert.ok(alert.text.includes(value), value);
});

test('무통장 신청은 입금 대기로 구분하고 랜딩 주문 상세로 연결한다', () => {
  const alert = buildAdminOrderAlert({ kind: 'bank', product: '종합사주', amount: 29000, adminPath: 'report-orders/o-1' });
  assert.equal(alert.variables['#{구분}'], '무통장 신청(입금 대기)');
  assert.equal(alert.variables['#{확인링크}'], 'https://ganjisaju.kr/admin/report-orders/o-1');
});

test('템플릿 번호와 발송 설정이 모두 있을 때만 알림톡, 아니면 문자', () => {
  assert.equal(pickAdminAlertChannel('KA01TP123', true), 'alimtalk');
  assert.equal(pickAdminAlertChannel('', true), 'sms');
  assert.equal(pickAdminAlertChannel('KA01TP123', false), 'sms');
});
