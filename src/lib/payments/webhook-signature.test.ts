import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyTossWebhookSignature } from './webhook-signature';

declare const test: (name: string, fn: () => void) => void;

const KEY = 'test_webhook_security_key';
const BODY = '{"eventType":"PAYMENT_STATUS_CHANGED","data":{"orderId":"o1"}}';
const TIME = '2026-06-21T05:00:00.000Z';

function sign(body: string, time: string, key: string) {
  return createHmac('sha256', key).update(`${body}:${time}`).digest('base64');
}

const validSig = sign(BODY, TIME, KEY);

test('유효한 서명은 통과한다', () => {
  assert.equal(
    verifyTossWebhookSignature({
      rawBody: BODY,
      signatureHeader: `v1:${validSig}`,
      transmissionTime: TIME,
      securityKey: KEY,
    }),
    true
  );
});

test('v1: 뒤 두 서명 중 하나만 맞아도 통과한다(키 회전 대비)', () => {
  assert.equal(
    verifyTossWebhookSignature({
      rawBody: BODY,
      signatureHeader: `v1:AAAAwrongsigAAAA=,${validSig}`,
      transmissionTime: TIME,
      securityKey: KEY,
    }),
    true
  );
});

test('body 가 1바이트라도 변조되면 거부한다', () => {
  assert.equal(
    verifyTossWebhookSignature({
      rawBody: `${BODY} `,
      signatureHeader: `v1:${validSig}`,
      transmissionTime: TIME,
      securityKey: KEY,
    }),
    false
  );
});

test('transmission-time 이 다르면 거부한다(리플레이 방지 기반)', () => {
  assert.equal(
    verifyTossWebhookSignature({
      rawBody: BODY,
      signatureHeader: `v1:${validSig}`,
      transmissionTime: '2026-06-21T05:00:01.000Z',
      securityKey: KEY,
    }),
    false
  );
});

test('다른 보안 키로 만든 서명은 거부한다', () => {
  const otherSig = sign(BODY, TIME, 'attacker_key');
  assert.equal(
    verifyTossWebhookSignature({
      rawBody: BODY,
      signatureHeader: `v1:${otherSig}`,
      transmissionTime: TIME,
      securityKey: KEY,
    }),
    false
  );
});

test('헤더/시각/키 중 하나라도 비면 false', () => {
  const base = { rawBody: BODY, transmissionTime: TIME, securityKey: KEY };
  assert.equal(verifyTossWebhookSignature({ ...base, signatureHeader: null }), false);
  assert.equal(
    verifyTossWebhookSignature({ ...base, signatureHeader: `v1:${validSig}`, transmissionTime: null }),
    false
  );
  assert.equal(
    verifyTossWebhookSignature({ ...base, signatureHeader: `v1:${validSig}`, securityKey: '' }),
    false
  );
});

test('v1: 접두가 없어도 콤마 분리로 처리한다', () => {
  assert.equal(
    verifyTossWebhookSignature({
      rawBody: BODY,
      signatureHeader: validSig,
      transmissionTime: TIME,
      securityKey: KEY,
    }),
    true
  );
});
