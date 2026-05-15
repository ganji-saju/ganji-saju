// 2026-05-16 PR #144 — 컴백 리마인더 본문/자격 검증.
import assert from 'node:assert/strict';
import { buildComebackPushBody, isEligibleForComeback } from './comeback-reminder';

declare const test: (name: string, fn: () => void) => void;

test('isEligibleForComeback - lastSeenAt 없으면 null', () => {
  const r = isEligibleForComeback({ lastSeenAt: null, inactivityReminderDays: 3 });
  assert.equal(r, null);
});

test('isEligibleForComeback - 3일 미만 idle 이면 null', () => {
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const r = isEligibleForComeback({ lastSeenAt: oneDayAgo, inactivityReminderDays: 3 });
  assert.equal(r, null);
});

test('isEligibleForComeback - 3일 이상 idle + 설정 3일 → eligible', () => {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const r = isEligibleForComeback({ lastSeenAt: fourDaysAgo, inactivityReminderDays: 3 });
  assert.ok(r);
  assert.equal(r!.daysIdle, 4);
});

test('isEligibleForComeback - 5일 idle + 설정 7일 → null', () => {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const r = isEligibleForComeback({ lastSeenAt: fiveDaysAgo, inactivityReminderDays: 7 });
  assert.equal(r, null);
});

test('isEligibleForComeback - 잘못된 date string 은 null', () => {
  const r = isEligibleForComeback({ lastSeenAt: 'not-a-date', inactivityReminderDays: 3 });
  assert.equal(r, null);
});

test('buildComebackPushBody - 14+ 일은 한참 키워드', () => {
  const r = buildComebackPushBody({ daysIdle: 20 });
  assert.ok(r.title.includes('한참'));
  assert.ok(r.url === '/star-sign');
});

test('buildComebackPushBody - 7-13일은 일주일 키워드', () => {
  const r = buildComebackPushBody({ daysIdle: 8 });
  assert.ok(r.title.includes('일주일'));
});

test('buildComebackPushBody - 3-6일은 며칠 키워드', () => {
  const r = buildComebackPushBody({ daysIdle: 4 });
  assert.ok(r.body.includes('며칠'));
});

test('buildComebackPushBody - 3 단계 본문 모두 다름', () => {
  const a = buildComebackPushBody({ daysIdle: 4 });
  const b = buildComebackPushBody({ daysIdle: 10 });
  const c = buildComebackPushBody({ daysIdle: 20 });
  assert.notEqual(a.title, b.title);
  assert.notEqual(b.title, c.title);
});
