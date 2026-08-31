import assert from 'node:assert/strict';
import { shouldSendLlmQuotaAlert } from './llm-quota-notify';

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
