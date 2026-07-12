import assert from 'node:assert/strict';
import test from 'node:test';
import { sendNotificationEmail } from './notification-email';

test('sendNotificationEmail sends a branded transactional email through Resend', async () => {
  const payloads: Record<string, unknown>[] = [];

  const result = await sendNotificationEmail(
    {
      to: 'member@example.com',
      displayName: '달빛',
      title: '오늘의 운세가 도착했어요',
      body: '오늘은 서두르지 않는 편이 좋아요.',
      url: '/today-fortune',
    },
    {
      apiKey: 're_test',
      from: '간지사주 <notifications@notify.ganjisaju.kr>',
      send: async (input) => {
        payloads.push(input);
        return { data: { id: 'email-1' }, error: null };
      },
    }
  );

  assert.equal(result.id, 'email-1');
  const payload = payloads[0]!;
  assert.equal(payload.from, '간지사주 <notifications@notify.ganjisaju.kr>');
  assert.deepEqual(payload.to, ['member@example.com']);
  assert.equal(payload.subject, '오늘의 운세가 도착했어요');
  assert.match(String(payload.html), /달빛님/);
  assert.match(String(payload.html), /https:\/\/ganjisaju\.kr\/today-fortune/);
});

test('sendNotificationEmail exposes provider errors as failures', async () => {
  await assert.rejects(
    () =>
      sendNotificationEmail(
        {
          to: 'member@example.com',
          displayName: '',
          title: '알림',
          body: '본문',
          url: '/notifications',
        },
        {
          apiKey: 're_test',
          from: '간지사주 <notifications@notify.ganjisaju.kr>',
          send: async () => ({ data: null, error: { message: 'domain not verified' } }),
        }
      ),
    /domain not verified/
  );
});
