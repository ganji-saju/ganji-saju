// 2026-05-16 PR #143 — subscription-expiring 본문/단계 검증.
import assert from 'node:assert/strict';
import { buildExpiringPushBody } from './subscription-expiring';

declare const test: (name: string, fn: () => void) => void;

test('buildExpiringPushBody - d7 본문에 일주일 키워드', () => {
  const r = buildExpiringPushBody({ stage: 'd7', planLabel: 'Plus 멤버십' });
  assert.ok(r.title.includes('일주일'));
  assert.ok(r.body.includes('일주일'));
  assert.ok(r.body.includes('Plus 멤버십'));
  assert.ok(r.url.startsWith('/membership/checkout'));
});

test('buildExpiringPushBody - d3 본문에 3일 키워드', () => {
  const r = buildExpiringPushBody({ stage: 'd3', planLabel: 'Plus 멤버십' });
  assert.ok(r.title.includes('3일') || r.title.includes('만료 3일'));
  assert.ok(r.body.includes('3일'));
});

test('buildExpiringPushBody - d0 본문에 오늘 키워드', () => {
  const r = buildExpiringPushBody({ stage: 'd0', planLabel: 'Premium 멤버십' });
  assert.ok(r.title.includes('오늘'));
  assert.ok(r.body.includes('Premium'));
  assert.ok(r.body.includes('오늘'));
});

test('buildExpiringPushBody - 3 stage 본문 모두 다름', () => {
  const a = buildExpiringPushBody({ stage: 'd7', planLabel: 'X' });
  const b = buildExpiringPushBody({ stage: 'd3', planLabel: 'X' });
  const c = buildExpiringPushBody({ stage: 'd0', planLabel: 'X' });
  assert.notEqual(a.title, b.title);
  assert.notEqual(b.title, c.title);
  assert.notEqual(a.body, b.body);
});

test('buildExpiringPushBody - url 동일 (CTA 통일)', () => {
  const a = buildExpiringPushBody({ stage: 'd7', planLabel: 'X' });
  const b = buildExpiringPushBody({ stage: 'd0', planLabel: 'X' });
  assert.equal(a.url, b.url);
});
