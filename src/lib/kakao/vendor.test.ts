import assert from 'node:assert/strict';
import test from 'node:test';
import { solapiSendAlimtalk } from './vendor';

test('solapiSendAlimtalk uses the current send-many/detail request and resultList response', async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = '';
  let requestedBody: unknown = null;

  globalThis.fetch = (async (input, init) => {
    requestedUrl = String(input);
    requestedBody = JSON.parse(String(init?.body ?? '{}'));
    return new Response(
      JSON.stringify({
        groupId: 'group-1',
        errorCount: 0,
        resultList: [
          {
            messageId: 'message-1',
            statusCode: '2000',
            statusMessage: '정상 접수',
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const result = await solapiSendAlimtalk({
      to: '01012345678',
      templateCode: 'KA01TP_TEST',
      variables: { '#{name}': '테스트' },
    });

    assert.equal(requestedUrl, 'https://api.solapi.com/messages/v4/send-many/detail');
    assert.deepEqual(requestedBody, {
      messages: [
        {
          to: '01012345678',
          kakaoOptions: {
            pfId: '',
            templateId: 'KA01TP_TEST',
            variables: { '#{name}': '테스트' },
            disableSms: true,
          },
        },
      ],
      showMessageList: true,
    });
    assert.deepEqual(result, {
      ok: true,
      status: 'sent',
      vendorMsgId: 'message-1',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('solapiSendAlimtalk treats a per-message provider error as failed', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        groupId: 'group-2',
        errorCount: 1,
        resultList: [
          {
            statusCode: '4003',
            statusMessage: '템플릿을 찾을 수 없습니다.',
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )) as typeof fetch;

  try {
    const result = await solapiSendAlimtalk({
      to: '01012345678',
      templateCode: 'BAD_TEMPLATE',
      variables: {},
    });
    assert.deepEqual(result, {
      ok: false,
      status: 'failed',
      error: '4003: 템플릿을 찾을 수 없습니다.',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 2026-11-04 — 결제 완료 응답이 관리자 알림 발송을 기다린다(order-alert). 솔라피가 응답하지 않으면
//   결제 화면이 같이 멈추므로 발송 요청에 시간 제한을 건다.
test('solapiSendAlimtalk gives up when Solapi does not answer in time', async () => {
  const originalFetch = globalThis.fetch;
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input, init) => {
    signal = init?.signal;
    return new Response(JSON.stringify({ errorCount: 0, resultList: [{ statusCode: '2000' }] }), { status: 200 });
  }) as typeof fetch;

  try {
    await solapiSendAlimtalk({ to: '01012345678', templateCode: 'T', variables: {} });
    assert.ok(signal instanceof AbortSignal, '발송 요청에 시간 제한(AbortSignal)이 없다');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
