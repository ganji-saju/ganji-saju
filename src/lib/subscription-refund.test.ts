// 2026-09-13 — 멤버십 환불 시 구독 종료(사용자 요청). 구독은 사용자당 1행이고 결제(30일)·관리자 부여가 renews_at 끝에 누적된다.
//   "지금 종료"는 다른 기간까지 날리고, 상태만 cancelled 는 혜택이 안 끊긴다(isEntitledStatus 가 cancelled 를 권한으로 본다) →
//   **그 결제가 구독에 실제로 더한 일수(지급 기록)만 뺀다**. 결과가 지금 이전이면 즉시 만료(renews_at 도 지금으로).
//   리뷰 발견: "항상 30일"은 미지급(승인만)·지급 재시도(+60)·부분취소에서 틀린 값을 뺀다 → 지급이 주문에 일수를 기록한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { refundedMembershipRenewal, shortenMembershipForRefund } from './subscription';
import { membershipDaysToRemove, recordMembershipDaysGranted } from './payments/order-ledger';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = new Date('2026-09-13T00:00:00.000Z');

test('환불된 결제가 더한 일수만 뺀다 — 남은 기간(다른 결제·관리자 부여)은 유지', () => {
  assert.deepEqual(refundedMembershipRenewal('2026-11-12T00:00:00.000Z', NOW, 30), { status: null, renewsAt: '2026-10-13T00:00:00.000Z' });
  assert.deepEqual(refundedMembershipRenewal('2026-12-12T00:00:00.000Z', NOW, 60), { status: null, renewsAt: '2026-10-13T00:00:00.000Z' });
});

test('빼고 나면 지금 이전이면 즉시 만료 — renews_at 도 지금으로(재구매 때 옛 기간이 되살아나지 않게)', () => {
  assert.deepEqual(refundedMembershipRenewal('2026-10-01T00:00:00.000Z', NOW, 30), { status: 'expired', renewsAt: NOW.toISOString() });
  assert.deepEqual(refundedMembershipRenewal('2026-10-13T00:00:00.000Z', NOW, 30), { status: 'expired', renewsAt: NOW.toISOString() }, '딱 지금이면 만료');
});

test('renews_at 이 없는(무기한) 행은 이 결제가 만든 기간이 아니라 손대지 않는다', () => {
  assert.equal(refundedMembershipRenewal(null, NOW, 30), null);
});

test('뺄 일수는 지급 기록 그대로 — 미지급 0 · 재시도 누적 60 · 부분취소 0 · 멤버십 아님 0', () => {
  const membership = (metadata: Record<string, unknown>) => ({ packageId: 'membership_premium', metadata });
  assert.equal(membershipDaysToRemove(membership({ membershipDaysGranted: 30 }), false), 30);
  assert.equal(membershipDaysToRemove(membership({ membershipDaysGranted: 60 }), false), 60);
  assert.equal(membershipDaysToRemove(membership({}), false), 0, '승인만 되고 지급 전 실패한 주문 — 받은 적 없는 기간을 빼면 관리자 부여분이 깎인다');
  assert.equal(membershipDaysToRemove(membership({ membershipDaysGranted: 30 }), true), 0, '부분취소는 구독 유지');
  assert.equal(membershipDaysToRemove({ packageId: 'taste_today_detail', metadata: { membershipDaysGranted: 30 } }, false), 0);
});

// select→update 흉내 — eq 인자까지 기록한다(엉뚱한 컬럼으로 바꾸면 프로덕션에선 0행 갱신 = 조용한 미차감).
function fakeTable(row: Record<string, unknown> | null) {
  const writes: Array<{ patch: Record<string, unknown>; where: [string, unknown] }> = [];
  const client = {
    from: () => {
      let patch: Record<string, unknown> | null = null;
      const chain = {
        select: () => chain,
        update: (p: Record<string, unknown>) => ((patch = p), chain),
        eq: (col: string, val: unknown) => (patch ? Promise.resolve((writes.push({ patch, where: [col, val] }), { error: null })) : chain),
        maybeSingle: () => Promise.resolve({ data: row, error: null }),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, writes };
}

test('shortenMembershipForRefund — 그 사용자 행에 계산 결과를 쓰고, 만료면 status 도 바꾼다', async () => {
  const keep = fakeTable({ renews_at: '2026-11-12T00:00:00.000Z' });
  await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: keep.client });
  assert.deepEqual(keep.writes, [{ patch: { renews_at: '2026-10-13T00:00:00.000Z', updated_at: NOW.toISOString() }, where: ['user_id', 'u1'] }]);

  const end = fakeTable({ renews_at: '2026-10-01T00:00:00.000Z' });
  await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: end.client });
  assert.deepEqual(end.writes[0].patch, { renews_at: NOW.toISOString(), status: 'expired', updated_at: NOW.toISOString() });

  const none = fakeTable(null);
  assert.equal(await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: none.client }), null);
  assert.equal(none.writes.length, 0, '구독 행이 없으면 쓰지 않는다');
});

test('recordMembershipDaysGranted — 주문 metadata 에 누적(재시도로 두 번 돌면 60), 다른 키는 보존', async () => {
  const first = fakeTable({ metadata: { origin: { env: 'production' } } });
  await recordMembershipDaysGranted('ord_m', 30, first.client);
  assert.deepEqual(first.writes, [{ patch: { metadata: { origin: { env: 'production' }, membershipDaysGranted: 30 } }, where: ['order_id', 'ord_m'] }]);
  const retry = fakeTable({ metadata: { membershipDaysGranted: 30 } });
  await recordMembershipDaysGranted('ord_m', 30, retry.client);
  assert.equal((retry.writes[0].patch.metadata as Record<string, unknown>).membershipDaysGranted, 60);
});

// 원장 함수·지급·웹훅은 DB·PG 를 직접 불러 행동 테스트가 안 된다 — 호출 위치를 소스로 고정한다.
test('구독 차감은 방금 refunded 로 바뀐 분기에서만(정확히 1회) · 실패는 주문에 흔적 · 지급이 일수를 기록 · 웹훅은 부분취소·전 회수 구분', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  const ledger = read('payments/order-ledger.ts');
  const refunded = ledger.slice(ledger.indexOf('export async function markPaymentOrderRefunded'));
  const transitioned = refunded.slice(refunded.indexOf('if (data) {'), refunded.indexOf('// 갱신된 행이 없음'));
  const idempotent = refunded.slice(refunded.indexOf('// 갱신된 행이 없음'), refunded.indexOf('\n}\n'));
  assert.ok(/\.neq\('status', 'refunded'\)/.test(refunded), '이미 refunded 면 전이하지 않는 조건부 UPDATE 가 1회 보장의 근거다');
  assert.ok(/const membershipDays = membershipDaysToRemove\(order, input\.partial === true\);\s*if \(membershipDays > 0\) \{\s*await shortenMembershipForRefund\(order\.userId, \{ days: membershipDays \}\)\.catch\(/.test(transitioned));
  assert.ok(/membership_shorten_failed[\s\S]*\.update\(\{ last_error: message \}\)/.test(transitioned), '실패를 삼키면 영구 누락 — 주문에 흔적');
  assert.ok(!/shortenMembershipForRefund/.test(idempotent), '멱등 재호출 분기에서 또 빼면 관리자 환불·통보가 겹칠 때 두 번 빠진다');

  const fulfillment = read('payments/fulfillment.ts');
  assert.ok(
    /days: MEMBERSHIP_PERIOD_DAYS,\s*\}\)\s*: null;[\s\S]{0,300}?if \(subscription\) \{\s*await recordMembershipDaysGranted\(\s*claimed\.orderId,\s*MEMBERSHIP_PERIOD_DAYS,\s*undefined,\s*membershipPeriodEndingAt\(subscription\.renewsAt, MEMBERSHIP_PERIOD_DAYS\)\s*\);/.test(fulfillment),
    '지급이 일수와 그 기간(새 renews_at 기준)을 같이 기록한다'
  );

  const webhook = read('../app/api/payments/webhook/nicepay/route.ts');
  assert.ok(/partial: \/partial\/i\.test\(status\),/.test(webhook), '부분취소는 구독 유지(관리자 부분환불과 같은 결과)');
  // 회수할 전은 결제가 실제로 지급한 전(creditsToRevokeOnCancel — coin-sunset.test 에서 값으로 고정).
  assert.ok(/packageCredits: creditsToRevokeOnCancel\(pkg\),/.test(webhook));
});

// 2026-09-14 — 관리자 "멤버십 해제"가 cancelled 라 renews_at 까지 혜택이 남고 사용자가 재개할 수 있었다(사용자 요청: 해제하면 종료).
test('관리자 해제는 지금 만료 — status expired + renews_at 지금(재구매 때 되살아나지 않게), 그 사용자 행만', async () => {
  const { expireMembershipNow } = await import('./subscription');
  const db = fakeTable(null);
  await expireMembershipNow('u1', { now: NOW, service: db.client });
  assert.deepEqual(db.writes, [
    { patch: { status: 'expired', renews_at: NOW.toISOString(), updated_at: NOW.toISOString() }, where: ['user_id', 'u1'] },
  ]);
  const route = fs.readFileSync(path.resolve(__dirname, '../app/api/admin/membership/grant/route.ts'), 'utf8');
  assert.ok(/\} else \{\s*await expireMembershipNow\(userId\);/.test(route));
  assert.ok(!/updateSubscriptionStatus\(userId, 'cancelled'\)/.test(route), 'cancelled 로는 혜택이 안 끊긴다');
});

// ─────────────────────────────────────────────────────────────
// 2026-09-14 — 멤버십 전액환불이면 그 결제 기간에 **멤버십 혜택으로 연** 달력·상세풀이 열람을 잠근다(사용자 결정).
//   잠금은 삭제다 — unlock_credit_feature_once 는 행이 남아 있으면 reused(무과금)로 다시 연다. 부분환불은 B단계(범위 밖).
// ─────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

/** delete().eq().in().contains().gte().lt().select() · insert() 흉내 — SQL 처럼 `NULL = x` 는 거짓. 필터 인자는 calls 에 기록. */
function fakeDb(tables: Record<string, Row[]>, failOn?: string) {
  const inserted: Row[] = [];
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      const log = (op: string, args: unknown[]) => calls.push({ table, op, args });
      const at = (r: Row, col: string) => (r[col] == null ? NaN : Date.parse(String(r[col])));
      const chain = {
        delete: () => (log('delete', []), chain),
        eq: (col: string, val: unknown) => (log('eq', [col, val]), filters.push((r) => r[col] != null && r[col] === val), chain),
        in: (col: string, vals: unknown[]) => (log('in', [col, vals]), filters.push((r) => vals.includes(r[col])), chain),
        contains: (col: string, obj: Row) => (
          log('contains', [col, obj]),
          filters.push((r) => Object.entries(obj).every(([k, v]) => (r[col] as Row | null)?.[k] === v)),
          chain
        ),
        gte: (col: string, v: string) => (log('gte', [col, v]), filters.push((r) => at(r, col) >= Date.parse(v)), chain),
        lt: (col: string, v: string) => (log('lt', [col, v]), filters.push((r) => at(r, col) < Date.parse(v)), chain),
        select: () => {
          if (failOn === table) return Promise.resolve({ data: null, error: { message: 'boom' } });
          const hits = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
          tables[table] = (tables[table] ?? []).filter((r) => !hits.includes(r));
          return Promise.resolve({ data: hits, error: null });
        },
        insert: (rows: Row | Row[]) => {
          inserted.push(...[rows].flat());
          return Promise.resolve({ error: null });
        },
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, tables, inserted, calls };
}

const P = { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' };
const LOCK_NOW = new Date('2026-09-10T00:00:00.000Z');
const use = (id: string, userId: string, feature: string, createdAt: string, meta: Row) => ({
  id,
  user_id: userId,
  type: 'use',
  feature,
  created_at: createdAt,
  metadata: meta,
});

test('lockMembershipContentForRefund — 창 안의 멤버십 열람·스냅샷만 지우고, 창 밖·쿠폰·다른 사용자·다른 기능은 남긴다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const db = fakeDb({
    credit_transactions: [
      use('cal_in', 'u1', 'calendar', '2026-09-01T00:00:00.000Z', { kind: 'fortune_calendar_month_access', via: 'membership' }), // 시작 경계 포함
      use('det_in', 'u1', 'detail_report', '2026-09-05T00:00:00.000Z', { kind: 'today_fortune_premium_access', via: 'membership' }),
      use('det_before', 'u1', 'detail_report', '2026-08-31T23:59:59.000Z', { via: 'membership' }), // 앞 결제 기간
      use('det_after_now', 'u1', 'detail_report', '2026-09-10T00:00:00.000Z', { via: 'membership' }), // min(end, now) 끝 경계 제외
      use('coupon', 'u1', 'detail_report', '2026-09-05T00:00:00.000Z', { kind: 'today_fortune_premium_access' }), // 카카오 쿠폰(표식 없음)
      use('other_user', 'u2', 'calendar', '2026-09-05T00:00:00.000Z', { via: 'membership' }),
      use('dialogue', 'u1', 'dialogue', '2026-09-05T00:00:00.000Z', { via: 'membership' }),
      { id: 'grant', user_id: 'u1', type: 'purchase', feature: 'calendar', created_at: '2026-09-05T00:00:00.000Z', metadata: { via: 'membership' } },
    ],
    today_fortune_result_snapshots: [
      { id: 's_in', user_id: 'u1', access_source: 'membership', created_at: '2026-09-05T00:00:00.000Z' },
      { id: 's_paid', user_id: 'u1', access_source: 'taste-product', created_at: '2026-09-05T00:00:00.000Z' },
      { id: 's_null', user_id: 'u1', access_source: null, created_at: '2026-09-05T00:00:00.000Z' },
      { id: 's_before', user_id: 'u1', access_source: 'membership', created_at: '2026-08-20T00:00:00.000Z' },
      { id: 's_u2', user_id: 'u2', access_source: 'membership', created_at: '2026-09-05T00:00:00.000Z' },
    ],
  });
  const result = await lockMembershipContentForRefund('u1', [P], { reason: 'admin_refund', actor: 'admin', paymentKey: 'pk_m', now: LOCK_NOW }, db.client);

  assert.deepEqual(result, { accessDeleted: 2, snapshotsDeleted: 1 });
  assert.deepEqual(db.tables.credit_transactions.map((r) => r.id), ['det_before', 'det_after_now', 'coupon', 'other_user', 'dialogue', 'grant']);
  assert.deepEqual(db.tables.today_fortune_result_snapshots.map((r) => r.id), ['s_paid', 's_null', 's_before', 's_u2']);
  assert.equal(db.inserted.length, 1, '감사행은 창 개수와 무관하게 1개');
  assert.deepEqual(db.inserted[0], {
    user_id: 'u1',
    amount: 0,
    type: 'purchase',
    feature: 'entitlement_revoke',
    metadata: {
      kind: 'membership_content_locked',
      accessDeleted: 2,
      snapshotsDeleted: 1,
      windows: [{ start: P.start, end: LOCK_NOW.toISOString() }],
      reason: 'admin_refund',
      actor: 'admin',
      paymentKey: 'pk_m',
      lockedAt: LOCK_NOW.toISOString(),
    },
  });
});

test('lockMembershipContentForRefund — 기간이 이미 끝났으면 end 까지(끝 시각 행은 다음 기간 몫) · 여러 창 합산', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const later = new Date('2026-12-01T00:00:00.000Z');
  const second = { start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T00:00:00.000Z' };
  const db = fakeDb({
    credit_transactions: [
      use('p1', 'u1', 'calendar', '2026-09-20T00:00:00.000Z', { via: 'membership' }),
      use('p2', 'u1', 'calendar', '2026-10-01T00:00:00.000Z', { via: 'membership' }),
      use('after', 'u1', 'calendar', '2026-10-31T00:00:00.000Z', { via: 'membership' }),
    ],
    today_fortune_result_snapshots: [],
  });
  assert.deepEqual(await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: later }, db.client), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(db.tables.credit_transactions.map((r) => r.id), ['p2', 'after'], 'end(10/01) 시각 행은 이 기간이 아니다');
  assert.deepEqual(await lockMembershipContentForRefund('u1', [P, second], { reason: 'r', now: later }, db.client), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(db.tables.credit_transactions.map((r) => r.id), ['after']);
});

test('lockMembershipContentForRefund — 빈·미래·깨진 창은 DB 를 건드리지 않는다 · 사용자 없으면 던진다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  for (const windows of [[], [{ start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' }], [{ start: 'x', end: 'y' }]]) {
    const db = fakeDb({ credit_transactions: [use('x', 'u1', 'calendar', '2026-09-05T00:00:00.000Z', { via: 'membership' })] });
    assert.deepEqual(await lockMembershipContentForRefund('u1', windows, { reason: 'r', now: LOCK_NOW }, db.client), { accessDeleted: 0, snapshotsDeleted: 0 });
    // 미래 창 = 앞 기간에 이어 붙은 결제를 그 기간 시작 전에 환불 — 지금까지 연 건 앞 결제 몫이다.
    assert.equal(db.calls.length, 0, `창 ${JSON.stringify(windows)}`);
    assert.equal(db.inserted.length, 0);
  }
  await assert.rejects(lockMembershipContentForRefund('', [P], { reason: 'r' }, fakeDb({}).client));
});

test('lockMembershipContentForRefund — DB 오류는 던진다(호출부가 주문에 흔적)', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  for (const table of ['credit_transactions', 'today_fortune_result_snapshots']) {
    await assert.rejects(lockMembershipContentForRefund('u1', [P], { reason: 'r', now: LOCK_NOW }, fakeDb({}, table).client), /boom/);
  }
});

test('recordMembershipDaysGranted — 기간을 membershipPeriods 에 누적(재시도 = 2개) · 기간 없으면 키를 만들지 않는다', async () => {
  const { membershipPeriodEndingAt, readMembershipPeriods } = await import('./payments/order-ledger');
  const second = { start: P.end, end: '2026-10-31T00:00:00.000Z' };
  const first = fakeTable({ metadata: { origin: 'x' } });
  await recordMembershipDaysGranted('ord_m', 30, first.client, P);
  assert.deepEqual(first.writes[0].patch, { metadata: { origin: 'x', membershipDaysGranted: 30, membershipPeriods: [P] } });
  const retry = fakeTable({ metadata: { membershipDaysGranted: 30, membershipPeriods: [P] } });
  await recordMembershipDaysGranted('ord_m', 30, retry.client, second);
  assert.deepEqual((retry.writes[0].patch.metadata as Row).membershipPeriods, [P, second]);
  const none = fakeTable({ metadata: {} });
  await recordMembershipDaysGranted('ord_m', 30, none.client);
  assert.ok(!('membershipPeriods' in (none.writes[0].patch.metadata as Row)));

  assert.deepEqual(membershipPeriodEndingAt('2026-10-31T00:00:00.000Z', 30), second);
  assert.equal(membershipPeriodEndingAt(null, 30), undefined, '무기한 구독은 이 결제가 만든 기간이 없다');
  assert.deepEqual(readMembershipPeriods({ membershipPeriods: [P, { start: 1 }, null, 'x'] }), [P]);
  assert.deepEqual(readMembershipPeriods({}), [], '기록 이전 주문 — 잠글 기간 없음');
});

test('잠금 훅은 방금 refunded 로 바뀐 분기에서 구독 차감 뒤(전액환불만) · 실패는 흔적 · 멱등 분기엔 없음 · 멤버십 경로만 via 표식', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  const ledger = read('payments/order-ledger.ts');
  const refunded = ledger.slice(ledger.indexOf('export async function markPaymentOrderRefunded'));
  const transitioned = refunded.slice(refunded.indexOf('if (data) {'), refunded.indexOf('// 갱신된 행이 없음'));
  const idempotent = refunded.slice(refunded.indexOf('// 갱신된 행이 없음'), refunded.indexOf('\n}\n'));
  assert.ok(
    /if \(membershipDays > 0\) \{\s*await shortenMembershipForRefund\([\s\S]*?\}\);\s*(\/\/[^\n]*\n\s*)*await lockMembershipContentForRefund\(order\.userId, readMembershipPeriods\(order\.metadata\), \{[\s\S]*?paymentKey: order\.paymentKey,\s*\}\)\.catch\(/.test(transitioned),
    '전액환불(membershipDays > 0 — 부분취소면 0) 분기 안에서, 구독 차감 뒤에'
  );
  assert.ok(/membership_lock_failed[\s\S]*\.update\(\{ last_error: message \}\)/.test(transitioned), '실패를 삼키면 영구 누락 — 주문에 흔적');
  assert.ok(!/lockMembershipContentForRefund/.test(idempotent), '멱등 재호출 분기에서는 잠그지 않는다');

  const calendar = read('credits/calendar-access.ts');
  assert.ok(/if \(await getMemberTier\(userId\)\) \{\s*await recordFortuneCalendarMonthAccess\(userId, readingKey, year, month, 'membership'\);/.test(calendar));
  assert.equal((calendar.match(/'membership'\)/g) ?? []).length, 1, '레거시 전 경로는 표식 없음 — 환불로 지우면 산 열람이 사라진다');
  const detail = read('credits/detail-report-access.ts');
  assert.ok(/if \(await getMemberTier\(userId\)\) \{\s*await recordTodayFortunePremiumAccess\(userId, readingKey, sourceSessionId, dayKey, 'membership'\);/.test(detail));
  assert.equal((detail.match(/'membership'\)/g) ?? []).length, 1);
  assert.ok(/\.\.\.\(via \? \{ via \} : \{\}\)/.test(calendar) && /\.\.\.\(via \? \{ via \} : \{\}\)/.test(detail));
  const coupon = read('../app/api/coupons/kakao-friend/redeem/route.ts');
  assert.ok(/recordTodayFortunePremiumAccess\(user\.id, readingKey, sourceSessionId, todayKey\);/.test(coupon), '쿠폰 0원 지급은 표식 없음(환불 대상 아님)');

  const unlock = read('../app/api/today-fortune/unlock/route.ts');
  assert.ok(/accessSource: 'viaMembership' in access && access\.viaMembership \? 'membership' : responseAccess,/.test(unlock), '멤버십으로 만든 스냅샷 표식');
});
