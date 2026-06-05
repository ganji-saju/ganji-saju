// src/lib/admin/user-list-query.test.ts
import assert from 'node:assert/strict';
import {
  parseListParams,
  encodeCursor,
  decodeCursor,
  buildListItem,
  cursorForRow,
  buildCsv,
  type AdminUserSummaryRow,
} from './user-list-query';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = '2026-06-06T00:00:00.000Z';

function row(over: Partial<AdminUserSummaryRow> = {}): AdminUserSummaryRow {
  return {
    user_id: 'u-1',
    email: 'hong@example.com',
    display_name: null,
    signup_at: '2026-06-01T00:00:00.000Z',
    signup_provider: 'google',
    profile_complete: true,
    last_active_at: '2026-06-04T00:00:00.000Z',
    ltv_won: 39000,
    paid_count: 3,
    credit_balance: 5,
    credit_expiring: 2,
    subscription_status: null,
    refundable_won: 9000,
    reading_count: 4,
    chat_count: 12,
    ...over,
  };
}

test('parseListParams: 기본값', () => {
  const p = parseListParams(new URLSearchParams(''));
  assert.equal(p.status, 'all');
  assert.equal(p.paid, 'all');
  assert.equal(p.subscription, 'all');
  assert.equal(p.profile, 'all');
  assert.equal(p.sort, 'signup');
  assert.equal(p.limit, 50);
  assert.equal(p.minLtv, null);
  assert.equal(p.inactiveDays, null);
  assert.deepEqual(p.provider, []);
  assert.equal(p.cursor, null);
});

test('parseListParams: 값 파싱 + 화이트리스트', () => {
  const sp = new URLSearchParams(
    'status=active&paid=yes&subscription=active&profile=complete&sort=ltv&limit=30&minLtv=10000&inactiveDays=30&provider=email,google&cursor=abc'
  );
  const p = parseListParams(sp);
  assert.equal(p.status, 'active');
  assert.equal(p.paid, 'yes');
  assert.equal(p.subscription, 'active');
  assert.equal(p.profile, 'complete');
  assert.equal(p.sort, 'ltv');
  assert.equal(p.limit, 30);
  assert.equal(p.minLtv, 10000);
  assert.equal(p.inactiveDays, 30);
  assert.deepEqual(p.provider, ['email', 'google']);
  assert.equal(p.cursor, 'abc');
});

test('parseListParams: 잘못된 enum/숫자는 기본값으로 폴백', () => {
  const sp = new URLSearchParams('status=garbage&sort=hacker&limit=9999&minLtv=NaN&provider=email,evil');
  const p = parseListParams(sp);
  assert.equal(p.status, 'all');
  assert.equal(p.sort, 'signup');
  assert.equal(p.limit, 100); // clamp max 100
  assert.equal(p.minLtv, null);
  assert.deepEqual(p.provider, ['email']); // evil 제거
});

test('encode/decodeCursor: 라운드트립', () => {
  const c = encodeCursor({ v: '2026-05-30T00:00:00.000Z', id: 'u-123' });
  const back = decodeCursor(c);
  assert.deepEqual(back, { v: '2026-05-30T00:00:00.000Z', id: 'u-123' });
});

test('decodeCursor: 손상값은 null', () => {
  assert.equal(decodeCursor('!!!notbase64!!!'), null);
  assert.equal(decodeCursor(''), null);
});

test('buildListItem: admin 은 이메일 마스킹 + 표시명 폴백', () => {
  const item = buildListItem(row(), 'admin', NOW);
  assert.equal(item.email, 'h***@e***.com');
  assert.equal(item.displayName, '회원-u-1');
});

test('buildListItem: super_admin 은 이메일 원본', () => {
  const item = buildListItem(row(), 'super_admin', NOW);
  assert.equal(item.email, 'hong@example.com');
});

test('buildListItem: display_name 있으면 우선', () => {
  const item = buildListItem(row({ display_name: '홍길동' }), 'admin', NOW);
  assert.equal(item.displayName, '홍길동');
});

test('buildListItem: 뱃지 — 신규(30일내)·환불대상', () => {
  const item = buildListItem(row(), 'admin', NOW);
  assert.ok(item.badges.includes('new'));
  assert.ok(item.badges.includes('refundable'));
  assert.ok(!item.badges.includes('subscribed'));
  assert.ok(!item.badges.includes('at_risk'));
});

test('buildListItem: 뱃지 — 구독중·이탈위험', () => {
  const sub = buildListItem(row({ subscription_status: 'active' }), 'admin', NOW);
  assert.ok(sub.badges.includes('subscribed'));
  const risk = buildListItem(
    row({ last_active_at: '2026-04-01T00:00:00.000Z', ltv_won: 5000, refundable_won: 0, subscription_status: null }),
    'admin',
    NOW
  );
  assert.ok(risk.badges.includes('at_risk'));
});

test('cursorForRow: 정렬키별 커서 값', () => {
  const r = row();
  assert.deepEqual(cursorForRow(r, 'signup'), { v: r.signup_at, id: 'u-1' });
  assert.deepEqual(cursorForRow(r, 'ltv'), { v: '39000', id: 'u-1' });
  assert.deepEqual(cursorForRow(r, 'last_active'), { v: r.last_active_at, id: 'u-1' });
  assert.deepEqual(cursorForRow(r, 'paid_count'), { v: '3', id: 'u-1' });
});

test('buildCsv: admin 은 비식별 컬럼(이메일 제외), 헤더+행', () => {
  const csv = buildCsv([buildListItem(row(), 'admin', NOW)], 'admin');
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'user_id,signup_at,ltv_won,paid_count,subscription_status,last_active_at');
  assert.ok(lines[1].startsWith('u-1,2026-06-01'));
  assert.ok(!csv.includes('hong@example.com'));
  assert.ok(!csv.includes('email'));
});

test('buildCsv: super_admin 은 이메일·표시명 PII 컬럼 포함', () => {
  const csv = buildCsv([buildListItem(row(), 'super_admin', NOW)], 'super_admin');
  const header = csv.trim().split('\n')[0];
  assert.ok(header.includes('email'));
  assert.ok(header.includes('display_name'));
  assert.ok(csv.includes('hong@example.com'));
});

test('buildCsv: 콤마·따옴표 이스케이프', () => {
  const item = buildListItem(row({ display_name: '홍, "길동"' }), 'super_admin', NOW);
  const csv = buildCsv([item], 'super_admin');
  assert.ok(csv.includes('"홍, ""길동"""'));
});
