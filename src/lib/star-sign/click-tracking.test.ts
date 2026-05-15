// 2026-05-16 PR #137 — appendNotifId URL helper 검증.
// dispatch route 내부 함수라 동일 로직 재현 (PR 본문에서 인용).
import assert from 'node:assert/strict';

declare const test: (name: string, fn: () => void) => void;

function appendNotifId(url: string, logId: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}notif=${encodeURIComponent(logId)}`;
}

test('appendNotifId - query string 없을 때 ? 추가', () => {
  assert.equal(appendNotifId('/star-sign/aries', 'abc-123'), '/star-sign/aries?notif=abc-123');
});

test('appendNotifId - 이미 query string 있을 때 & 추가', () => {
  assert.equal(
    appendNotifId('/star-sign/aries?utm=push', 'abc-123'),
    '/star-sign/aries?utm=push&notif=abc-123'
  );
});

test('appendNotifId - logId URL-encode', () => {
  const id = 'abc/123 def';
  const result = appendNotifId('/x', id);
  assert.ok(result.includes('notif=abc%2F123%20def'));
});

test('appendNotifId - 빈 경로 / 도 안전', () => {
  assert.equal(appendNotifId('/', 'abc-123'), '/?notif=abc-123');
});

test('appendNotifId - 표준 UUID 통과', () => {
  const id = '01234567-89ab-cdef-0123-456789abcdef';
  const result = appendNotifId('/notifications', id);
  assert.equal(result, `/notifications?notif=${id}`);
});
