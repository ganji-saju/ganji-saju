// 2026-07-19 — 🔴 나이스페이 **취소** 서명 공식 가드.
//
// 관리자 환불이 두 단계로 실패했다:
//   1차: "orderId 필수입력항목이 누락되었습니다."  → orderId 미전송 (9a1e9708 수정)
//   2차: "SIGN DATA 검증에 실패하였습니다."        → 서명 공식 오류 (이 가드)
//
// 원인: 취소가 **승인용 공식**(tid + amount + ediDate + secretKey)을 재사용했다.
//   공식 V2 매뉴얼(api/cancel.md)의 취소 규칙은 `hex(sha256(tid + ediDate + SecretKey))` 로
//   **금액이 들어가지 않는다**. 게다가 전액취소는 cancelAmt 가 없어 `0` 을 끼워 서명하고 있었다.
//
// 승인과 취소는 규칙이 다르다 — 다시 합치면 환불이 통째로 죽는다. 그래서 실제 요청 본문을
// 가로채 서명 값을 직접 검증한다(순수 헬퍼가 export 되지 않아 fetch 를 스텁한다).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cancelNicepayPayment } from './nicepay';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const SECRET = 'test-secret-key';
const TID = 'UT0033314m01012607192159031925';

async function captureCancelBody(options: {
  reason: string;
  orderId: string;
  cancelAmt?: number;
}): Promise<Record<string, string>> {
  const prev = {
    secret: process.env.NICEPAY_SECRET_KEY,
    client: process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY,
    mode: process.env.NEXT_PUBLIC_NICEPAY_MODE,
  };
  const prevFetch = globalThis.fetch;
  process.env.NICEPAY_SECRET_KEY = SECRET;
  process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = 'test-client-key';
  process.env.NEXT_PUBLIC_NICEPAY_MODE = 'sandbox';

  let captured: Record<string, string> = {};
  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    captured = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ resultCode: '0000', resultMsg: 'OK' }),
      text: async () => '{"resultCode":"0000"}',
    };
  }) as unknown as typeof globalThis.fetch;

  try {
    await cancelNicepayPayment(TID, options);
  } finally {
    globalThis.fetch = prevFetch;
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    restore('NICEPAY_SECRET_KEY', prev.secret);
    restore('NEXT_PUBLIC_NICEPAY_CLIENT_KEY', prev.client);
    restore('NEXT_PUBLIC_NICEPAY_MODE', prev.mode);
  }
  return captured;
}

test('취소 signData = sha256(tid + ediDate + secretKey) — 금액이 들어가지 않는다', async () => {
  const body = await captureCancelBody({ reason: '관리자 환불', orderId: 'ord_test_1' });

  const expected = createHash('sha256')
    .update(`${TID}${body.ediDate}${SECRET}`)
    .digest('hex');
  assert.equal(body.signData, expected, '취소 서명 공식이 매뉴얼과 다르다 → PG 가 SIGN DATA 검증 실패를 낸다');
});

test('취소 signData 에 승인용 공식(금액 포함)을 쓰면 안 된다', async () => {
  const body = await captureCancelBody({
    reason: '관리자 환불',
    orderId: 'ord_test_2',
    cancelAmt: 9900,
  });

  for (const amount of [0, 9900]) {
    const approveStyle = createHash('sha256')
      .update(`${TID}${amount}${body.ediDate}${SECRET}`)
      .digest('hex');
    assert.notEqual(
      body.signData,
      approveStyle,
      `승인용 공식(amount=${amount})으로 서명하고 있다 — 취소는 금액을 빼야 한다`
    );
  }
});

test('취소 요청 본문에 orderId 가 반드시 실린다', async () => {
  const body = await captureCancelBody({ reason: '관리자 환불', orderId: 'ord_test_3' });
  assert.ok(body.orderId, 'orderId 누락은 PG 가 필수항목 오류로 거절한다');
});

// 🔴 2026-08-27 3차 관문 — 이 파일이 기록한 1·2차에 이어 같은 필드가 또 틀렸다.
//   3차: "이미 사용된 OrderId 입니다."
//   나이스페이 취소의 orderId 는 **취소 요청 자체의 고유 주문번호**다. 원결제 orderId 를
//   그대로 보내면 승인 때 이미 소진된 값이라 무조건 거부되고, 재시도해도 같은 값이라
//   영원히 실패한다(실제로 990원 환불 1건이 약 6시간 동안 계속 실패).
//   ⚠️ 직전 버전의 이 테스트는 `body.orderId === 원결제 orderId` 를 단언해서
//      **틀린 계약을 지키고 있었다.** 계약을 뒤집는다.
test('취소 orderId 는 원결제 orderId 를 그대로 쓰지 않는다', async () => {
  const body = await captureCancelBody({ reason: '관리자 환불', orderId: 'ord_reuse_check' });
  assert.notEqual(
    body.orderId,
    'ord_reuse_check',
    '원결제 orderId 재사용 → PG 가 "이미 사용된 OrderId 입니다." 로 거절한다'
  );
});

test('취소 orderId 는 시도마다 새 값이다 — 재시도가 같은 거부로 되돌아가면 안 된다', async () => {
  const first = await captureCancelBody({ reason: '관리자 환불', orderId: 'ord_retry' });
  const second = await captureCancelBody({ reason: '관리자 환불', orderId: 'ord_retry' });
  assert.notEqual(first.orderId, second.orderId, '같은 값을 재사용하면 재시도가 영구히 실패한다');
});

test('취소 orderId 는 원결제 번호를 품고 64자를 넘지 않는다(PG 콘솔 추적용)', async () => {
  const body = await captureCancelBody({
    reason: '관리자 환불',
    orderId: 'ord_7632af45-eb8e-4b3d-98f6-96f6c633d780',
  });
  assert.ok(body.orderId.length <= 64, `orderId 가 ${body.orderId.length}자 — PG 제한 초과`);
  assert.ok(
    body.orderId.includes('ord_7632af45'),
    '원거래를 콘솔에서 찾을 수 있도록 원결제 번호 일부를 남긴다'
  );
});

test('취소 orderId 는 서명에 영향을 주지 않는다 — signData 는 tid+ediDate+secret 뿐', async () => {
  const body = await captureCancelBody({ reason: '관리자 환불', orderId: 'ord_sign_indep' });
  const expected = createHash('sha256').update(`${TID}${body.ediDate}${SECRET}`).digest('hex');
  assert.equal(body.signData, expected);
});
