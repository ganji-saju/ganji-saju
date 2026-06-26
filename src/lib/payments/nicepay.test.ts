// 2026-06-26 — 나이스페이 어댑터 스캐폴드 가드. 순수 로직(서명·스위치)만 검증.
//   실제 승인/취소 HTTP 는 게재 전 샌드박스 E2E 로(docs §4·§6).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { getPaymentProvider, isNicepay, isToss } from './provider';
import { nicepaySha256Hex, verifyNicepayAuthSignature } from './nicepay';

declare const test: (name: string, fn: () => void) => void;

test('provider 스위치: PAYMENT_PROVIDER=nicepay → nicepay, 그 외 → toss(안전 기본)', () => {
  const prev = process.env.PAYMENT_PROVIDER;
  try {
    process.env.PAYMENT_PROVIDER = 'nicepay';
    assert.equal(getPaymentProvider(), 'nicepay');
    assert.equal(isNicepay(), true);
    assert.equal(isToss(), false);

    process.env.PAYMENT_PROVIDER = 'toss';
    assert.equal(getPaymentProvider(), 'toss');

    delete process.env.PAYMENT_PROVIDER;
    assert.equal(getPaymentProvider(), 'toss', '미설정 시 toss 로 안전 폴백');

    process.env.PAYMENT_PROVIDER = 'oops';
    assert.equal(getPaymentProvider(), 'toss', '오타 시 toss 로 안전 폴백');
  } finally {
    if (prev === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = prev;
  }
});

test('nicepaySha256Hex: 64자 hex 결정론(같은 입력=같은 출력)', () => {
  const a = nicepaySha256Hex('hello-nicepay');
  const b = nicepaySha256Hex('hello-nicepay');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, nicepaySha256Hex('hello-nicepay2'));
});

test('verifyNicepayAuthSignature: 올바른 signature 통과 / 변조 거부', () => {
  const prevClient = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;
  const prevSecret = process.env.NICEPAY_SECRET_KEY;
  try {
    process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = 'test_client';
    process.env.NICEPAY_SECRET_KEY = 'test_secret';

    const authToken = 'authtoken-abc';
    const amount = 9900;
    // 공식 규칙: sha256(authToken + clientId + amount + secretKey)
    const valid = createHash('sha256')
      .update(`${authToken}test_client${amount}test_secret`, 'utf8')
      .digest('hex');

    assert.equal(
      verifyNicepayAuthSignature({ authToken, clientId: 'test_client', amount, signature: valid }),
      true,
      '정상 signature 는 통과'
    );
    assert.equal(
      verifyNicepayAuthSignature({ authToken, clientId: 'test_client', amount: 1, signature: valid }),
      false,
      '금액 변조 signature 는 거부'
    );
    assert.equal(
      verifyNicepayAuthSignature({ authToken, clientId: 'test_client', amount, signature: 'tampered' }),
      false,
      '잘못된 signature 는 거부'
    );
  } finally {
    if (prevClient === undefined) delete process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;
    else process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = prevClient;
    if (prevSecret === undefined) delete process.env.NICEPAY_SECRET_KEY;
    else process.env.NICEPAY_SECRET_KEY = prevSecret;
  }
});
