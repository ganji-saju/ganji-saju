// 2026-07-10 — 결제 준비 단계의 나이스페이 키 짝 가드.
//
// 왜: 2026-06-27 19:25~20:23 KST 에 승인 4건이 인가 실패("사용자 정보가 존재하지 않습니다.")
//   했지만 아무도 몰랐다. 결제창은 정상으로 떴고, 실패는 사용자가 카드정보를 다 넣은
//   **맨 마지막 단계**에서 났다. 키 짝이 깨졌으면 결제창을 띄우기 전에 막아야 한다.
import assert from 'node:assert/strict';
import { resolveNicepayPrepareBlock } from './nicepay-prepare-guard';
import type { NicepayKeyPairAudit } from './nicepay-config-audit';

declare const test: (name: string, fn: () => void) => void;

const HEALTHY: NicepayKeyPairAudit = {
  mode: 'live',
  apiBase: 'https://api.nicepay.co.kr',
  apiBaseExplicit: false,
  clientKeySource: 'mode',
  clientKeyPrefix: 'R2_',
  secretKeySource: 'mode',
  secretKeyLength: 32,
  ok: true,
  problems: [],
};

const BROKEN: NicepayKeyPairAudit = {
  ...HEALTHY,
  secretKeySource: 'fallback',
  ok: false,
  problems: [
    { code: 'key_source_mismatch', detail: 'clientKey 는 mode, secretKey 는 fallback' },
  ],
};

test('toss 결제는 나이스페이 감사 결과와 무관하게 통과시킨다', () => {
  assert.equal(resolveNicepayPrepareBlock('toss', BROKEN), null);
});

test('나이스페이 + 키 짝 정상이면 통과', () => {
  assert.equal(resolveNicepayPrepareBlock('nicepay', HEALTHY), null);
});

test('나이스페이 + 키 짝 깨짐이면 차단하고 문제 코드를 사유에 담는다', () => {
  const block = resolveNicepayPrepareBlock('nicepay', BROKEN);
  assert.ok(block, '차단해야 한다');
  assert.equal(block.reason, 'nicepay_key_pair_invalid');
  assert.ok(
    block.detail.includes('key_source_mismatch'),
    '운영자가 원인을 바로 알 수 있게 문제 코드를 남긴다'
  );
});

test('차단 사유에 secretKey 값이나 길이가 새지 않는다', () => {
  const block = resolveNicepayPrepareBlock('nicepay', {
    ...BROKEN,
    secretKeyLength: 32,
  });
  assert.ok(block);
  assert.ok(!block.detail.includes('32'), 'secretKey 길이는 사용자 응답에 담지 않는다');
});

test('문제가 여러 개면 전부 사유에 담는다', () => {
  const block = resolveNicepayPrepareBlock('nicepay', {
    ...BROKEN,
    problems: [
      { code: 'key_source_mismatch', detail: 'a' },
      { code: 'api_base_mode_mismatch', detail: 'b' },
    ],
  });
  assert.ok(block);
  assert.ok(block.detail.includes('key_source_mismatch'));
  assert.ok(block.detail.includes('api_base_mode_mismatch'));
});
