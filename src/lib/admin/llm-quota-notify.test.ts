import assert from 'node:assert/strict';
import { buildLlmOutageSms, getOpsAlertPhones, shouldSendLlmQuotaAlert, shouldSendOpsSms } from './llm-quota-notify';

// 2026-08-31 — 경보 이메일 중복/누락 규칙 가드.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = new Date('2026-08-31T03:00:00Z'); // KST 12:00

test('ok 는 보내지 않는다 — 복구 메일 없음', () => {
  assert.equal(shouldSendLlmQuotaAlert({ level: 'ok' }, null, NOW), false);
  assert.equal(
    shouldSendLlmQuotaAlert({ level: 'ok' }, { level: 'critical', sentAt: '2026-08-30T03:00:00Z' }, NOW),
    false
  );
});

test('처음 경보는 보낸다', () => {
  assert.equal(shouldSendLlmQuotaAlert({ level: 'warn' }, null, NOW), true);
  assert.equal(shouldSendLlmQuotaAlert({ level: 'critical' }, null, NOW), true);
});

test('같은 단계는 KST 하루 한 번', () => {
  // 같은 KST 날(08-31) 아침에 이미 보냈다 → 참는다.
  assert.equal(
    shouldSendLlmQuotaAlert({ level: 'critical' }, { level: 'critical', sentAt: '2026-08-30T22:00:00Z' }, NOW),
    false,
    '2026-08-30T22:00Z 는 KST 08-31 07:00 — 같은 날이다'
  );
  // 어제(KST 08-30) 보냈다 → 오늘 다시.
  assert.equal(
    shouldSendLlmQuotaAlert({ level: 'critical' }, { level: 'critical', sentAt: '2026-08-30T10:00:00Z' }, NOW),
    true
  );
});

test('단계가 올라가면 같은 날이라도 다시 보낸다', () => {
  assert.equal(
    shouldSendLlmQuotaAlert({ level: 'critical' }, { level: 'warn', sentAt: '2026-08-31T01:00:00Z' }, NOW),
    true
  );
});

// 2026-10-09 — 10/9 크레딧 소진 때 critical 메일이 07:20 에 갔지만 대응까지 9시간. 긴급은 문자로도 보낸다.
test('문자 경보는 critical 일 때만', () => {
  assert.equal(shouldSendOpsSms({ level: 'critical' }), true);
  assert.equal(shouldSendOpsSms({ level: 'warn' }), false);
  assert.equal(shouldSendOpsSms({ level: 'ok' }), false);
});

test('문자 수신 번호: OPS_ALERT_PHONES 를 쉼표로 나눠 휴대폰 형식만 남긴다', () => {
  assert.deepEqual(getOpsAlertPhones({ OPS_ALERT_PHONES: '010-1234-5678, 01098765432 ,abc,' }), ['01012345678', '01098765432']);
  assert.deepEqual(getOpsAlertPhones({}), []);
});

test('문자 본문: 무엇이 막혔는지·결제 보류 중·확인 주소, 간지사주 명시', () => {
  const text = buildLlmOutageSms({ headline: '지금 AI 답변이 막혀 있습니다' });
  assert.match(text, /^\[긴급\] 간지사주 AI 장애/);
  assert.match(text, /지금 AI 답변이 막혀 있습니다/);
  assert.match(text, /신규 결제는 자동 보류/);
  assert.match(text, /https:\/\/ganjisaju\.kr\/admin\/llm-cost/);
});
