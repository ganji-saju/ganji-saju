import assert from 'node:assert/strict';
import {
  DEFAULT_TOSS_PAYMENT_METHOD,
  TOSS_PAYMENT_METHOD_OPTIONS,
  getTossPaymentMethodOption,
} from './methods';

declare const test: (name: string, fn: () => void) => void;

test('toss payment methods expose card and transfer with card as default', () => {
  assert.equal(DEFAULT_TOSS_PAYMENT_METHOD, 'CARD');
  assert.deepEqual(
    TOSS_PAYMENT_METHOD_OPTIONS.map((option) => option.code),
    ['CARD', 'TRANSFER']
  );
  // #489 에서 라벨을 '실시간 계좌이체'(나이스페이 콘솔 명칭)로 변경했으나 이 단언이
  // 갱신 안 돼 main CI 가 그때부터 red 였음. 출시된 라벨에 맞춰 정정. (#501 에서 발견)
  assert.equal(getTossPaymentMethodOption('TRANSFER').label, '실시간 계좌이체');
});
