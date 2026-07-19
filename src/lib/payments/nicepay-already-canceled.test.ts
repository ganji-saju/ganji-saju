// 2026-07-19 — 🔴 "이미 취소됨" 백스톱의 PG 문구·스키마 가드.
//
// 관리자 환불 3차 실패: PG 응답이 "해당거래 취소실패(기취소성공) : 전화 문의(1661-0808)".
// 즉 **돈은 이미 환불된 상태**인데 두 겹으로 못 알아봤다:
//   (1) isAlreadyCanceledTossError 가 토스 문구만 알아 백스톱 자체가 안 걸렸다.
//   (2) 걸렸어도 판정기(isCanceledForRefundRequest)가 토스 스키마
//       (`status:'CANCELED'` + balanceAmount)만 이해해 나이스페이 응답을 취소로 못 봤다.
// 결과: 환불 요청은 failed 로 남고 주문이 refunded 로 표기되지 않아 매출/환불 집계가 어긋났다.
import assert from 'node:assert/strict';
import { isAlreadyCanceledTossError, isCanceledForRefundRequest } from '@/lib/admin/refund-service';
import { normalizeNicepayPaymentForRefund } from './nicepay';

declare const test: (name: string, fn: () => void) => void;

test('백스톱 문구: 나이스페이 기취소 응답을 이미-취소로 인식', () => {
  assert.equal(
    isAlreadyCanceledTossError('해당거래 취소실패(기취소성공) : 전화 문의(1661-0808)'),
    true,
    '이 문구를 놓치면 이미 환불된 건이 failed 로 남는다'
  );
});

test('백스톱 문구: 토스 문구도 계속 인식(회귀 방지)', () => {
  assert.equal(isAlreadyCanceledTossError('이미 취소된 결제입니다'), true);
  assert.equal(isAlreadyCanceledTossError('Already cancelled'), true);
});

test('백스톱 문구: 무관한 실패는 이미-취소로 보지 않는다', () => {
  for (const msg of [
    'SIGN DATA 검증에 실패하였습니다.',
    'orderId 필수입력항목이 누락되었습니다.',
    '회원정보 오류',
    '',
    null,
  ]) {
    assert.equal(
      isAlreadyCanceledTossError(msg),
      false,
      `"${String(msg)}" 를 이미-취소로 오인하면 환불 안 된 건을 완료 처리한다`
    );
  }
});

test('스키마 정규화: 나이스페이 전액취소를 취소로 판정', () => {
  const normalized = normalizeNicepayPaymentForRefund({
    resultCode: '0000',
    status: 'canceled',
    amount: 9900,
  });
  assert.equal(normalized.status, 'CANCELED');
  assert.equal(normalized.balanceAmount, 0, '전액취소면 잔액 0 으로 봐야 판정기가 통과시킨다');
  assert.equal(isCanceledForRefundRequest(normalized, null), true);
});

test('스키마 정규화: 미취소 결제는 취소로 판정하지 않는다', () => {
  const normalized = normalizeNicepayPaymentForRefund({
    resultCode: '0000',
    status: 'paid',
    amount: 9900,
  });
  assert.equal(isCanceledForRefundRequest(normalized, null), false);
});

test('스키마 정규화: 부분취소는 잔액을 0 으로 단정하지 않는다', () => {
  const normalized = normalizeNicepayPaymentForRefund({
    resultCode: '0000',
    status: 'partialCancelled',
    amount: 9900,
    balanceAmt: 6600,
  });
  assert.equal(normalized.balanceAmount, 6600);
  // 전액취소가 아니므로 "전액 취소됨" 판정은 나오면 안 된다.
  assert.equal(isCanceledForRefundRequest(normalized, null), false);
});
