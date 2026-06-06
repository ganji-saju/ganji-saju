import assert from 'node:assert/strict';
import { buildMemberHeader, formatBirth } from './detail-view';

declare const test: (name: string, fn: () => void | Promise<void>) => void;
const NOW = '2026-06-06T00:00:00.000Z';

const base = {
  id: 'u-1', email: 'hong@example.com', createdAt: '2026-05-07T00:00:00.000Z',
  profile: { displayName: '홍길동', birthYear: 1999, birthMonth: 4, birthDay: 1, birthHour: 14, gender: 'female' },
  ltvWon: 39000, subscriptionStatus: null as string | null,
  lastActiveAt: '2026-06-04T00:00:00.000Z', refundableWon: 9000,
};

test('buildMemberHeader: admin 이메일 마스킹 + 경과일/비활동일', () => {
  const h = buildMemberHeader(base, 'admin', NOW);
  assert.equal(h.emailMasked, 'h***@e***.com');
  assert.equal(h.displayName, '홍길동');
  assert.equal(h.ageDays, 30);
  assert.equal(h.inactiveDays, 2);
  assert.equal(h.ltvWon, 39000);
  assert.equal(h.refundableWon, 9000);
  assert.equal(h.isSuper, false);
});

test('buildMemberHeader: super 이메일 원본 + isSuper', () => {
  const h = buildMemberHeader(base, 'super_admin', NOW);
  assert.equal(h.emailMasked, 'hong@example.com');
  assert.equal(h.isSuper, true);
});

test('buildMemberHeader: displayName 폴백, lastActive 없으면 inactiveDays null', () => {
  const h = buildMemberHeader({ ...base, profile: { ...base.profile, displayName: null }, lastActiveAt: null }, 'admin', NOW);
  assert.equal(h.displayName, '회원-u-1');
  assert.equal(h.inactiveDays, null);
});

test('formatBirth: admin 연도만, super 전체', () => {
  assert.equal(formatBirth(1999, 4, 1, 'admin'), '1999-**-**');
  assert.equal(formatBirth(1999, 4, 1, 'super_admin'), '1999-04-01');
  assert.equal(formatBirth(null, null, null, 'admin'), null);
});
