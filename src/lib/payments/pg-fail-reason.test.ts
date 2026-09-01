// 2026-09-01 — PG 실패 사유 표기 회귀 가드.
//
// 왜: 결제 실패 사유가 `auth_failed:I002` 처럼 **코드만** 남아, 무슨 일인지 알려면
//   매번 나이스 코드표를 찾아야 했다(I002 = 사용자가 결제를 취소하였습니다).
//   PG 가 사유 문구를 같이 보내주고 있었으므로 버리지 않는다.
import assert from 'node:assert/strict';
import { formatPgFailReason } from './funnel-log';

declare const test: (name: string, fn: () => void) => void;

test('PG 실패 사유: 코드 + 문구를 함께 남긴다', () => {
  assert.equal(
    formatPgFailReason('auth_failed', 'I002', '사용자가 결제를 취소하였습니다'),
    'auth_failed:I002 사용자가 결제를 취소하였습니다'
  );
});

test('PG 실패 사유: 문구가 없으면 종전 표기 그대로(코드만)', () => {
  assert.equal(formatPgFailReason('auth_failed', 'I002', ''), 'auth_failed:I002');
  assert.equal(formatPgFailReason('auth_failed', 'I002'), 'auth_failed:I002');
  assert.equal(formatPgFailReason('auth_failed', '', null), 'auth_failed:unknown');
});

test('PG 실패 사유: 줄바꿈은 한 줄로 — 대시보드가 이 문자열을 그룹핑 키로 쓴다', () => {
  assert.equal(
    formatPgFailReason('auth_failed', 'F100', '카드사\n  거절\t(한도초과)'),
    'auth_failed:F100 카드사 거절 (한도초과)'
  );
});

test('PG 실패 사유: 저장 상한 200자를 넘지 않는다(reason 컬럼)', () => {
  const long = formatPgFailReason('auth_failed', 'X999', '가'.repeat(500));
  assert.ok(long.length <= 200, `길이 ${long.length}`);
  assert.ok(long.startsWith('auth_failed:X999 '));
});

// 2026-09-01 — 승인 단계는 반대 결함이었다: 문구만 남고 **코드**를 버렸다.
//   PG 클라이언트가 코드를 error 에 실어 보내는 계약을 고정한다.
test('나이스 승인 실패 error 는 resultCode 를 함께 싣는다', async () => {
  const { approveNicepayPayment } = await import('./nicepay');
  const realFetch = globalThis.fetch;
  // 승인 호출은 secretKey 를 먼저 검사한다 — 없으면 파싱 경로에 닿지도 못한다(조용한 통과 방지).
  const realEnv = {
    secret: process.env.NICEPAY_SECRET_KEY,
    client: process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY,
  };
  process.env.NICEPAY_SECRET_KEY = 'test-secret-key';
  process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY = 'S2_test_client_key';
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ resultCode: 'F100', resultMsg: '카드 한도초과' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    await approveNicepayPayment('tid_test', 3300);
    assert.fail('실패해야 한다');
  } catch (err) {
    assert.equal((err as Error).message, '카드 한도초과');
    assert.equal((err as { resultCode?: string }).resultCode, 'F100');
    assert.equal(
      formatPgFailReason('approve_failed', (err as { resultCode?: string }).resultCode, (err as Error).message),
      'approve_failed:F100 카드 한도초과'
    );
  } finally {
    globalThis.fetch = realFetch;
    for (const [key, value] of [
      ['NICEPAY_SECRET_KEY', realEnv.secret],
      ['NEXT_PUBLIC_NICEPAY_CLIENT_KEY', realEnv.client],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
