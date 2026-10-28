import assert from 'node:assert/strict';
import { buildAdminOrderAlert, pickAdminAlertChannel } from './order-alert';

// 2026-10-28 — 결제·무통장 신청 관리자 알림 문구 가드. 알림톡 템플릿 변수와 문자 본문이 같은 값을 담아야 한다.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('결제 완료 알림은 구분·상품·금액·주문번호를 템플릿 변수와 문자 본문에 같이 담는다', () => {
  const alert = buildAdminOrderAlert({ kind: 'paid', product: '2027 신년운세', amount: 9900, orderNo: 'R-20261028-0001' });
  assert.deepEqual(alert.variables, {
    '#{구분}': '결제 완료',
    '#{상품명}': '2027 신년운세',
    '#{금액}': '9,900원',
    '#{주문번호}': 'R-20261028-0001',
  });
  for (const value of Object.values(alert.variables)) assert.ok(alert.text.includes(value), value);
});

test('무통장 신청은 입금 대기로 구분한다', () => {
  assert.equal(buildAdminOrderAlert({ kind: 'bank', product: '종합사주', amount: 29000, orderNo: 'R-1' }).variables['#{구분}'], '무통장 신청(입금 대기)');
});

test('템플릿 번호와 발송 설정이 모두 있을 때만 알림톡, 아니면 문자', () => {
  assert.equal(pickAdminAlertChannel('KA01TP123', true), 'alimtalk');
  assert.equal(pickAdminAlertChannel('', true), 'sms');
  assert.equal(pickAdminAlertChannel('KA01TP123', false), 'sms');
});
