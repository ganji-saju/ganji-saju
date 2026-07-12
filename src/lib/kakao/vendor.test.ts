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
