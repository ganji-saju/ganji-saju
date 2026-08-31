import assert from 'node:assert/strict';
import { getOpsAlertRecipients, sendOpsAlertEmail } from './ops-alert-email';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('getOpsAlertRecipients — ADMIN_ALERT_EMAILS 우선, 없으면 INTERNAL_VERIFICATION_EMAILS 폴백', () => {
  assert.deepEqual(
    getOpsAlertRecipients({ ADMIN_ALERT_EMAILS: 'A@x.kr, b@x.kr,, a@x.kr' }),
    ['a@x.kr', 'b@x.kr']
  );
  assert.deepEqual(
    getOpsAlertRecipients({ INTERNAL_VERIFICATION_EMAILS: 'ops@x.kr' }),
    ['ops@x.kr']
  );
  assert.deepEqual(
    getOpsAlertRecipients({ ADMIN_ALERT_EMAILS: 'a@x.kr', INTERNAL_VERIFICATION_EMAILS: 'ops@x.kr' }),
    ['a@x.kr'],
    '둘 다 있으면 ADMIN_ALERT_EMAILS 만'
  );
  assert.deepEqual(getOpsAlertRecipients({}), []);
});

test('sendOpsAlertEmail — 수신자 없으면 발송하지 않고 실패한다', async () => {
  let called = false;
  await assert.rejects(
    sendOpsAlertEmail(
      { subject: 's', lines: ['l'], url: '/admin' },
      { apiKey: 'k', to: [], send: async () => { called = true; return { data: { id: '1' }, error: null }; } }
    ),
    /수신자/
  );
  assert.equal(called, false);
});

test('sendOpsAlertEmail — 본문 줄을 이스케이프해 HTML 로 보내고 절대 URL 로 링크한다', async () => {
  const sent: Array<{ to: string[]; subject: string; html: string }> = [];
  const result = await sendOpsAlertEmail(
    { subject: 'LLM 한도 <초과>', lines: ['지금 막혔다 & 결제 필요'], url: '/admin/llm-cost' },
    {
      apiKey: 'k',
      to: ['ops@x.kr'],
      send: async (p) => { sent.push(p); return { data: { id: 'mail_1' }, error: null }; },
    }
  );
  assert.equal(result.id, 'mail_1');
  assert.equal(sent.length, 1);
  const payload = sent[0]!;
  assert.deepEqual(payload.to, ['ops@x.kr']);
  assert.ok(payload.html.includes('LLM 한도 &lt;초과&gt;'));
  assert.ok(payload.html.includes('지금 막혔다 &amp; 결제 필요'));
  assert.ok(payload.html.includes('https://ganjisaju.kr/admin/llm-cost'));
});
