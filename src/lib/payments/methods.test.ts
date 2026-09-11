import assert from 'node:assert/strict';
import {
  DEFAULT_TOSS_PAYMENT_METHOD,
  TOSS_PAYMENT_METHOD_OPTIONS,
  getTossPaymentMethodOption,
  paymentMethodOptionsFor,
} from './methods';

declare const test: (name: string, fn: () => void) => void;

test('배열 순서가 곧 화면 순서 — 간편결제 3종이 위, 카드가 아래', () => {
  // 나이스페이 결제창은 순서 제어 파라미터가 없어서 순서를 이 배열로 끌어왔다.
  // 순서가 바뀌면 사용자가 보는 화면이 바뀐다 → 의도 없이 못 바꾸게 고정.
  assert.deepEqual(
    TOSS_PAYMENT_METHOD_OPTIONS.map((option) => option.code),
    ['KAKAOPAY', 'NAVERPAY', 'SAMSUNGPAY', 'CARD', 'TRANSFER']
  );
  assert.equal(DEFAULT_TOSS_PAYMENT_METHOD, 'CARD');
  // #489 에서 라벨을 '실시간 계좌이체'(나이스페이 콘솔 명칭)로 변경했으나 이 단언이
  // 갱신 안 돼 main CI 가 그때부터 red 였음. 출시된 라벨에 맞춰 정정. (#501 에서 발견)
  assert.equal(getTossPaymentMethodOption('TRANSFER').label, '실시간 계좌이체');
});

test('토스 경로에는 간편결제 코드가 절대 안 나온다 — 토스는 CARD/TRANSFER 만 이해한다', () => {
  for (const provider of ['toss', undefined] as const) {
    assert.deepEqual(
      paymentMethodOptionsFor(provider).map((o) => o.code),
      ['CARD', 'TRANSFER'],
      `provider=${provider} 에서 간편결제가 새면 토스 결제가 깨진다`
    );
  }
});

test('나이스페이 경로에는 실시간 계좌이체가 없다 — 넣으면 결제가 막힌다', () => {
  const codes = paymentMethodOptionsFor('nicepay').map((o) => o.code);
  assert.deepEqual(codes, ['KAKAOPAY', 'NAVERPAY', 'SAMSUNGPAY', 'CARD']);
  assert.ok(!codes.includes('TRANSFER' as never));
});

test('TRANSFER 에는 나이스페이 매핑이 없다(null) — 매핑을 붙이는 순간 결제가 막힌다', () => {
  const transfer = TOSS_PAYMENT_METHOD_OPTIONS.find((o) => o.code === 'TRANSFER');
  assert.equal(transfer?.nicepayMethod, null);
});

test('나이스페이 method 매핑표 고정', () => {
  const map = Object.fromEntries(
    TOSS_PAYMENT_METHOD_OPTIONS.map((o) => [o.code, o.nicepayMethod])
  );
  assert.deepEqual(map, {
    // 'kakaopay' = 카드/머니 둘 다(사용자가 카카오 창에서 선택). 카드 전용은 kakaopayCard.
    KAKAOPAY: 'kakaopay',
    // 매뉴얼: naverpayCard 는 신용카드 전액결제 — 포인트 이용불가.
    NAVERPAY: 'naverpayCard',
    SAMSUNGPAY: 'samsungpayCard',
    CARD: 'card',
    TRANSFER: null,
  });
});
