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
  assert.equal(
    (await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: keep.client })).previousRenewsAt,
    '2026-11-12T00:00:00.000Z',
    '차감 **직전** 값을 돌려준다(잠금이 "이 주문 기간이 구독의 끝인가"를 본다)'
  );
  assert.deepEqual(keep.writes, [{ patch: { renews_at: '2026-10-13T00:00:00.000Z', updated_at: NOW.toISOString() }, where: ['user_id', 'u1'] }]);

  const end = fakeTable({ renews_at: '2026-10-01T00:00:00.000Z' });
  await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: end.client });
  assert.deepEqual(end.writes[0].patch, { renews_at: NOW.toISOString(), status: 'expired', updated_at: NOW.toISOString() });

  const none = fakeTable(null);
  assert.deepEqual(await shortenMembershipForRefund('u1', { days: 30, now: NOW, service: none.client }), { previousRenewsAt: null, next: null });
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

// 지급·웹훅은 DB·PG 를 직접 불러 행동 테스트가 안 된다 — 호출 위치를 소스로 고정한다.
//   (원장 전이 markPaymentOrderRefunded 는 아래 "markPaymentOrderRefunded 실행" 테스트가 가짜 DB 로 실제로 돌린다.)
test('지급이 일수를 기록 · 웹훅은 부분취소·전 회수 구분', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');

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

/** PostgREST 흉내 — select·delete·update 체인(then/maybeSingle 로 실행) · insert · order/range(1000행 페이지). SQL 처럼 `NULL = x` 는 거짓.
 *  필터 인자는 calls 에 기록. failOn 은 'table'(모든 연산) 또는 'table:delete' 처럼 연산 하나만. */
function fakeDb(tables: Record<string, Row[]>, failOn: string | string[] = []) {
  const failing = [failOn].flat();
  const inserted: Row[] = [];
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let mode: 'select' | 'delete' | 'update' = 'select';
      let patch: Row = {};
      const sorts: string[] = [];
      let window: [number, number] | null = null;
      const log = (op: string, args: unknown[]) => calls.push({ table, op, args });
      const at = (r: Row, col: string) => (r[col] == null ? NaN : Date.parse(String(r[col])));
      const run = () => {
        if (failing.includes(table) || failing.includes(`${table}:${mode}`)) return { data: null, error: { message: 'boom' } };
        const rows = tables[table] ?? [];
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        for (const col of [...sorts].reverse()) matched.sort((a, b) => String(a[col]).localeCompare(String(b[col])));
        const hits = window ? matched.slice(window[0], window[1] + 1) : matched;
        if (mode === 'delete') tables[table] = rows.filter((r) => !hits.includes(r));
        if (mode === 'update') hits.forEach((r) => Object.assign(r, patch));
        return { data: hits, error: null };
      };
      const chain: Record<string, unknown> = {};
      const filter = (op: string, args: unknown[], f: (r: Row) => boolean) => (log(op, args), filters.push(f), chain);
      Object.assign(chain, {
        select: () => chain,
        delete: () => ((mode = 'delete'), log('delete', []), chain),
        update: (p: Row) => ((mode = 'update'), (patch = p), log('update', [p]), chain),
        eq: (col: string, val: unknown) => filter('eq', [col, val], (r) => r[col] != null && r[col] === val),
        neq: (col: string, val: unknown) => filter('neq', [col, val], (r) => r[col] != null && r[col] !== val),
        in: (col: string, vals: unknown[]) => filter('in', [col, vals], (r) => vals.includes(r[col])),
        not: (col: string, op: string, list: string) =>
          filter('not', [col, op, list], (r) => op === 'in' && !list.slice(1, -1).split(',').includes(String(r[col]))),
        contains: (col: string, obj: Row) =>
          filter('contains', [col, obj], (r) => Object.entries(obj).every(([k, v]) => (r[col] as Row | null)?.[k] === v)),
        gte: (col: string, v: string) => filter('gte', [col, v], (r) => at(r, col) >= Date.parse(v)),
        lt: (col: string, v: string) => filter('lt', [col, v], (r) => at(r, col) < Date.parse(v)),
        order: (col: string) => (log('order', [col]), sorts.push(col), chain),
        range: (from: number, to: number) => (log('range', [from, to]), (window = [from, to]), chain),
        maybeSingle: () => {
          const { data, error } = run();
          return Promise.resolve({ data: data?.[0] ?? null, error });
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
        insert: (rows: Row | Row[]) => {
          inserted.push(...[rows].flat());
          return Promise.resolve({ error: null });
        },
      });
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, tables, inserted, calls };
}

const P = { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' };
/** 안전 조건 통과 — 환불하는 주문의 마지막 기간 end(P.end) = 환불 직전 구독 renews_at. */
const CUR = { orderId: 'ord_m', renewsAtBeforeRefund: P.end };
const LOCK_NOW = new Date('2026-09-10T00:00:00.000Z');
const use = (id: string, userId: string, feature: string, createdAt: string, meta: Row) => ({
  id,
  user_id: userId,
  type: 'use',
  feature,
  created_at: createdAt,
  metadata: meta,
});
/** 멤버십으로 연 오늘 상세 행 — created_at 은 UTC, dayKey 는 KST 날짜(실제 기록과 같게). */
const memberDetail = (id: string, createdAt: string, dayKey: string, userId = 'u1') =>
  use(id, userId, 'detail_report', createdAt, {
    kind: 'today_fortune_premium_access',
    sourceSessionId: `sess_${id}`,
    readingKey: 'rk1',
    dayKey,
    via: 'membership',
  });
const snap = (id: string, occurredOn: string, createdAt: string, extra: Row = {}) => ({
  id,
  user_id: 'u1',
  scope_key: `today-detail:rk1:${occurredOn}:general`,
  occurred_on: occurredOn,
  concern_id: 'general',
  access_source: 'membership',
  created_at: createdAt,
  ...extra,
});
const ids = (rows: Row[] | undefined) => (rows ?? []).map((r) => r.id);

test('lockMembershipContentForRefund — 창 안의 멤버십 열람 행만 지운다(창 밖·쿠폰·다른 사용자·다른 기능·지급 행은 남긴다) · 감사에 지운 것의 식별자', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const db = fakeDb({
    credit_transactions: [
      use('cal_in', 'u1', 'calendar', '2026-09-01T00:00:00.000Z', { kind: 'fortune_calendar_month_access', readingKey: 'rk1', yearMonth: '2026-09', via: 'membership' }), // 시작 경계 포함
      memberDetail('det_in', '2026-09-05T00:00:00.000Z', '2026-09-05'),
      use('det_before', 'u1', 'detail_report', '2026-08-31T23:59:59.000Z', { via: 'membership' }), // 앞 결제 기간
      use('det_after_now', 'u1', 'detail_report', '2026-09-10T00:00:00.000Z', { via: 'membership' }), // min(end, now) 끝 경계 제외
      use('other_user', 'u2', 'calendar', '2026-09-05T00:00:00.000Z', { via: 'membership' }),
      use('dialogue', 'u1', 'dialogue', '2026-09-05T00:00:00.000Z', { via: 'membership' }),
      { id: 'grant', user_id: 'u1', type: 'purchase', feature: 'calendar', created_at: '2026-09-05T00:00:00.000Z', metadata: { via: 'membership' } },
    ],
    today_fortune_result_snapshots: [
      snap('s_in', '2026-09-05', '2026-09-05T00:00:00.000Z'),
      snap('s_calendar_day', '2026-09-01', '2026-09-01T02:00:00.000Z', { access_source: 'coin-session' }), // 달력만 연 날은 상세 스냅샷을 잠글 날이 아니다
    ],
    product_entitlements: [],
  });
  const result = await lockMembershipContentForRefund('u1', [P], { reason: 'admin_refund', actor: 'admin', paymentKey: 'pk_m', now: LOCK_NOW, ...CUR }, db.client);

  assert.deepEqual(result, { accessDeleted: 2, snapshotsDeleted: 1 });
  assert.deepEqual(ids(db.tables.credit_transactions), ['det_before', 'det_after_now', 'other_user', 'dialogue', 'grant']);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_calendar_day']);
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
      access: [
        { feature: 'calendar', kind: 'fortune_calendar_month_access', readingKey: 'rk1', yearMonth: '2026-09', dayKey: null },
        { feature: 'detail_report', kind: 'today_fortune_premium_access', readingKey: 'rk1', yearMonth: null, dayKey: '2026-09-05' },
      ],
      snapshots: [{ id: 's_in', scopeKey: 'today-detail:rk1:2026-09-05:general' }],
      windows: [{ start: P.start, end: LOCK_NOW.toISOString() }],
      reason: 'admin_refund',
      actor: 'admin',
      paymentKey: 'pk_m',
      lockedAt: LOCK_NOW.toISOString(),
    },
  });
  assert.ok(!JSON.stringify(db.inserted[0]).includes('sess_'), '감사엔 지정한 식별자만(metadata 를 통째로 복사하지 않는다)');
});

// 리뷰 실측(과소 잠금): 'membership' 표식은 그날 첫 POST 스냅샷에만 붙는다. 같은 멤버십 행으로 연 GET(coin-session)·주제 전환(reused)·
//   다른 사주(coin-daily) 스냅샷이 남아 스냅샷 링크·/my/results 로 계속 보였다 → 스냅샷은 표식이 아니라 **날** 로 판정한다.
test('멤버십만인 날 — 그날 스냅샷은 표식과 무관하게 전부 잠근다(GET·주제 전환·다른 사주) · 멤버십 상세 행이 없는 날·다른 사용자는 남긴다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const db = fakeDb({
    credit_transactions: [memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05')],
    today_fortune_result_snapshots: [
      snap('s_mem', '2026-09-05', '2026-09-05T01:00:00.000Z'),
      snap('s_get', '2026-09-05', '2026-09-05T02:00:00.000Z', { access_source: 'coin-session' }),
      snap('s_concern', '2026-09-05', '2026-09-05T03:00:00.000Z', { access_source: 'reused', concern_id: 'love' }),
      snap('s_other_saju', '2026-09-05', '2026-09-05T04:00:00.000Z', { access_source: 'coin-daily', scope_key: 'today-detail:rk2:2026-09-05:general' }),
      snap('s_no_member_day', '2026-09-06', '2026-09-06T01:00:00.000Z', { access_source: 'coin-session' }),
      { ...snap('s_u2', '2026-09-05', '2026-09-05T01:00:00.000Z'), user_id: 'u2' },
    ],
    product_entitlements: [],
  });
  const result = await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: LOCK_NOW, ...CUR }, db.client);
  assert.deepEqual(result, { accessDeleted: 1, snapshotsDeleted: 4 });
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_no_member_day', 's_u2']);
});

// 반대 방향(과다 잠금): 그날 전·카드·쿠폰으로도 열 수 있었다면 그날 스냅샷은 산 것이다 — 멤버십 환불이 지우면 안 된다.
test('그날 다른 근거가 있으면 그날 스냅샷 유지 — 전 결제(charged)·today-detail 카드 이용권(KST 날짜)·카카오 쿠폰 · 멤버십만인 날만 잠김', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const db = fakeDb({
    credit_transactions: [
      memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05'),
      memberDetail('d6', '2026-09-06T01:00:00.000Z', '2026-09-06'),
      memberDetail('d7', '2026-09-07T01:00:00.000Z', '2026-09-07'),
      memberDetail('d8', '2026-09-08T01:00:00.000Z', '2026-09-08'),
      { ...use('charged5', 'u1', 'detail_report', '2026-09-05T05:00:00.000Z', { kind: 'today_fortune_premium_access', dayKey: '2026-09-05', charged: true }), amount: -1 },
      use('coupon7', 'u1', 'detail_report', '2026-09-07T05:00:00.000Z', { kind: 'today_fortune_premium_access', dayKey: '2026-09-07' }),
      use('u2_charged8', 'u2', 'detail_report', '2026-09-08T05:00:00.000Z', { dayKey: '2026-09-08', charged: true }), // 다른 사용자 근거는 무관
      use('member_prev8', 'u1', 'detail_report', '2026-08-08T05:00:00.000Z', { via: 'membership' }), // 창 밖 멤버십 행은 근거가 아니다
    ],
    today_fortune_result_snapshots: [
      snap('s5', '2026-09-05', '2026-09-05T01:00:00.000Z'),
      snap('s6', '2026-09-06', '2026-09-06T01:00:00.000Z'),
      snap('s7', '2026-09-07', '2026-09-07T01:00:00.000Z'),
      snap('s8', '2026-09-08', '2026-09-08T01:00:00.000Z'),
    ],
    product_entitlements: [
      // UTC 09-05 15:00 = KST 09-06 00:00 — 카드 이용권의 날짜는 KST(hasTodayDetailEntitlementForDay 와 같은 기준).
      { id: 'card6', user_id: 'u1', product_id: 'today-detail', created_at: '2026-09-05T15:00:00.000Z' },
      { id: 'card_u2', user_id: 'u2', product_id: 'today-detail', created_at: '2026-09-08T01:00:00.000Z' },
    ],
  });
  const result = await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: LOCK_NOW, ...CUR }, db.client);
  assert.deepEqual(result, { accessDeleted: 4, snapshotsDeleted: 1 }, '멤버십 열람 행은 날과 무관하게 전부 지운다(근거 있는 날은 그 근거가 연다)');
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s5', 's6', 's7']);
  assert.deepEqual(ids(db.tables.credit_transactions), ['charged5', 'coupon7', 'u2_charged8', 'member_prev8'], '근거 행은 그대로');
});

test('창 밖 스냅샷 유지 — 잠글 날이어도 창 시작 전(앞 기간)에 만든 스냅샷은 남긴다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const db = fakeDb({
    // 창 시작 09-01 00:00Z = KST 09-01 09:00. 같은 KST 날에 앞 기간(08:00)과 이 기간(10:00) 이 겹친다.
    credit_transactions: [
      memberDetail('d1_prev', '2026-08-31T23:00:00.000Z', '2026-09-01'), // 앞 기간 멤버십 행 — 남지만 "다른 근거"는 아니다
      memberDetail('d1', '2026-09-01T01:00:00.000Z', '2026-09-01'),
    ],
    today_fortune_result_snapshots: [
      snap('s_prev_period', '2026-09-01', '2026-08-31T23:00:00.000Z'),
      snap('s_this_period', '2026-09-01', '2026-09-01T01:00:00.000Z'),
    ],
    product_entitlements: [],
  });
  await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: LOCK_NOW, ...CUR }, db.client);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_prev_period']);
  assert.deepEqual(ids(db.tables.credit_transactions), ['d1_prev']);
});

test('주제 단품(재물·일, 전역) 보유자 — 그 주제 스냅샷은 단품이 연 것이라 남긴다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const db = fakeDb({
    credit_transactions: [memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05')],
    today_fortune_result_snapshots: [
      snap('s_general', '2026-09-05', '2026-09-05T01:00:00.000Z'),
      snap('s_wealth', '2026-09-05', '2026-09-05T02:00:00.000Z', { concern_id: 'wealth', access_source: 'topic-product' }),
      snap('s_career', '2026-09-05', '2026-09-05T03:00:00.000Z', { concern_id: 'career' }),
    ],
    product_entitlements: [{ id: 'mp', user_id: 'u1', product_id: 'money-pattern', created_at: '2026-07-01T00:00:00.000Z' }],
  });
  await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: LOCK_NOW, ...CUR }, db.client);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_wealth'], '일(work-flow)은 안 샀으니 career 는 잠긴다');
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
  assert.deepEqual(await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: later, ...CUR }, db.client), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(ids(db.tables.credit_transactions), ['p2', 'after'], 'end(10/01) 시각 행은 이 기간이 아니다');
  assert.deepEqual(await lockMembershipContentForRefund('u1', [P, second], { reason: 'r', now: later, orderId: 'ord_m', renewsAtBeforeRefund: second.end }, db.client), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(ids(db.tables.credit_transactions), ['after']);
});

// 리뷰: 기간 기록 없는 옛 주문은 조용히 건너뛰었다 → 건너뛴 사유를 감사행으로(last_error 아님 — 실패가 아니다).
test('lockMembershipContentForRefund — 기간 기록 없음·구독 모름/없음/무기한·끝 불일치·미래 창은 지우지 않고 건너뛴 사유를 감사행으로 · 사용자 없으면 던진다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const future = { start: '2026-11-01T00:00:00.000Z', end: '2026-12-01T00:00:00.000Z' };
  const cases: Array<[Array<{ start: string; end: string }>, string | null | undefined, string, Row]> = [
    [[], P.end, 'no_membership_periods', {}],
    [[P], undefined, 'subscription_unknown', { orderEnd: P.end }], // 구독 차감이 실패해 환불 직전 끝을 모름
    [[P], null, 'window_not_current', { orderEnd: P.end, subscriptionRenewsAt: null }], // 구독 행 없음·무기한
    [[P], '2026-10-01T00:00:01.001Z', 'window_not_current', { orderEnd: P.end, subscriptionRenewsAt: '2026-10-01T00:00:01.001Z' }], // 1초 넘게 어긋남
    [[{ start: 'x', end: 'y' }], P.end, 'window_not_current', { orderEnd: 'y', subscriptionRenewsAt: P.end }],
    [[future], future.end, 'no_elapsed_window', {}], // 앞 기간에 이어 붙은 결제를 그 기간 시작 전에 환불 — 지금까지 연 건 앞 결제 몫이다.
  ];
  for (const [windows, renewsAtBeforeRefund, skipReason, extra] of cases) {
    const db = fakeDb({
      credit_transactions: [memberDetail('x', '2026-09-05T00:00:00.000Z', '2026-09-05')],
      today_fortune_result_snapshots: [snap('s', '2026-09-05', '2026-09-05T00:00:00.000Z')],
    });
    const options = { reason: 'r', paymentKey: 'pk', now: LOCK_NOW, orderId: 'ord_m', renewsAtBeforeRefund };
    assert.deepEqual(await lockMembershipContentForRefund('u1', windows, options, db.client), { accessDeleted: 0, snapshotsDeleted: 0 });
    assert.deepEqual(db.calls.filter((c) => c.op === 'delete'), [], `${skipReason} — 지우는 쿼리 없음`);
    assert.deepEqual(ids(db.tables.credit_transactions), ['x']);
    assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s']);
    assert.deepEqual(db.inserted, [
      {
        user_id: 'u1',
        amount: 0,
        type: 'purchase',
        feature: 'entitlement_revoke',
        metadata: { kind: 'membership_content_lock_skipped', skipReason, windows, ...extra, reason: 'r', actor: null, paymentKey: 'pk', lockedAt: LOCK_NOW.toISOString() },
      },
    ]);
  }
  // ±1초 안은 같은 끝(ISO 표기·ms 차이) — 잠근다.
  const near = fakeDb({ credit_transactions: [memberDetail('x', '2026-09-05T00:00:00.000Z', '2026-09-05')] });
  const nearOptions = { reason: 'r', now: LOCK_NOW, orderId: 'ord_m', renewsAtBeforeRefund: '2026-10-01T00:00:01.000+00:00' };
  assert.deepEqual(await lockMembershipContentForRefund('u1', [P], nearOptions, near.client), { accessDeleted: 1, snapshotsDeleted: 0 });
  await assert.rejects(lockMembershipContentForRefund('', [P], { reason: 'r', ...CUR }, fakeDb({}).client));
});

test('lockMembershipContentForRefund — DB 오류는 던진다(호출부가 주문에 흔적)', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  for (const table of ['payment_orders', 'credit_transactions', 'today_fortune_result_snapshots', 'product_entitlements', 'credit_transactions:delete']) {
    const tables = { credit_transactions: [memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05')] };
    await assert.rejects(lockMembershipContentForRefund('u1', [P], { reason: 'r', now: LOCK_NOW, ...CUR }, fakeDb(tables, table).client), /boom/, table);
  }
});

// 재리뷰 실측(비멱등): 열람 행을 먼저 지우고 스냅샷 삭제가 실패하면 재실행이 {0,0} — 잠글 날을 다시 못 구해 스냅샷이 영구히 남았다.
//   → 열람 행은 **읽기만** 해서 날을 계산하고, 스냅샷 → 열람 행 순서로 지운다. 어느 단계에서 실패해도 재실행이 같은 끝 상태를 만든다.
test('lockMembershipContentForRefund — 부분 실패 후 재실행해도 한 번에 성공한 것과 같은 결과(스냅샷 실패·열람 행 삭제 실패)', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const fresh = () => ({
    credit_transactions: [
      memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05'),
      use('cal', 'u1', 'calendar', '2026-09-03T00:00:00.000Z', { via: 'membership' }),
      use('coupon6', 'u1', 'detail_report', '2026-09-06T05:00:00.000Z', { dayKey: '2026-09-06' }),
    ],
    today_fortune_result_snapshots: [snap('s5', '2026-09-05', '2026-09-05T01:00:00.000Z'), snap('s6', '2026-09-06', '2026-09-06T01:00:00.000Z')],
    product_entitlements: [],
  });
  const options = { reason: 'r', now: LOCK_NOW, ...CUR };
  const clean = fakeDb(fresh());
  assert.deepEqual(await lockMembershipContentForRefund('u1', [P], options, clean.client), { accessDeleted: 2, snapshotsDeleted: 1 });
  const want = { access: ids(clean.tables.credit_transactions), snapshots: ids(clean.tables.today_fortune_result_snapshots) };
  assert.deepEqual(want, { access: ['coupon6'], snapshots: ['s6'] });

  for (const failOn of ['today_fortune_result_snapshots', 'credit_transactions:delete']) {
    const tables = fresh();
    await assert.rejects(lockMembershipContentForRefund('u1', [P], options, fakeDb(tables, failOn).client), /boom/, failOn);
    assert.ok(ids(tables.credit_transactions).includes('d5'), `${failOn} 실패 — 열람 행은 남아 재실행이 잠글 날을 다시 구한다`);
    const retry = fakeDb(tables);
    await lockMembershipContentForRefund('u1', [P], options, retry.client);
    assert.deepEqual({ access: ids(tables.credit_transactions), snapshots: ids(tables.today_fortune_result_snapshots) }, want, failOn);
    assert.equal((retry.inserted[0].metadata as Row).kind, 'membership_content_locked');
  }
});

// 재리뷰: 스냅샷 삭제의 created_at < 창 끝 조건을 지워도 초록이었다 — 잠글 날이어도 창 끝 이후(다음 기간)에 만든 스냅샷은 남아야 한다.
test('창 끝 이후 스냅샷 유지 — 잠글 날이 창 끝에 걸치면 끝 이후에 만든 그날 스냅샷은 다음 기간 몫', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  // 창 끝 10-01 00:00Z = KST 10-01 09:00. 같은 KST 날에 이 기간(08:00)과 다음 기간(10:00)이 겹친다.
  const db = fakeDb({
    credit_transactions: [memberDetail('d_last', '2026-09-30T23:00:00.000Z', '2026-10-01')],
    today_fortune_result_snapshots: [
      snap('s_this_period', '2026-10-01', '2026-09-30T23:30:00.000Z'),
      snap('s_next_period', '2026-10-01', '2026-10-01T01:00:00.000Z'),
    ],
    product_entitlements: [],
  });
  await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: new Date('2026-12-01T00:00:00.000Z'), ...CUR }, db.client);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_next_period']);
});

// 재리뷰: 근거 조회가 사용자 상세 이력 전체를 정렬·limit 없이 1회 읽었다(PostgREST 1000행 절단 → 근거 누락 = 산 날 스냅샷 삭제).
test('다른 근거 조회 — 잠글 날 범위(KST)로 좁히고 1000행 넘으면 페이지를 넘겨 읽는다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  // 09-05(KST) 에 쿠폰 상세 1000행 — created_at 정렬상 첫 페이지를 꽉 채운다. 09-06 근거(전 결제)는 1001번째.
  const filler = Array.from({ length: 1000 }, (_, i) =>
    use(`c${String(i).padStart(4, '0')}`, 'u1', 'detail_report', new Date(Date.parse('2026-09-05T02:00:00.000Z') + i * 1000).toISOString(), { dayKey: '2026-09-05' })
  );
  const db = fakeDb({
    credit_transactions: [
      memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05'),
      memberDetail('d6', '2026-09-06T01:00:00.000Z', '2026-09-06'),
      memberDetail('d7', '2026-09-07T01:00:00.000Z', '2026-09-07'),
      ...filler,
      { ...use('charged6', 'u1', 'detail_report', '2026-09-06T05:00:00.000Z', { dayKey: '2026-09-06', charged: true }), amount: -1 },
    ],
    today_fortune_result_snapshots: [
      snap('s5', '2026-09-05', '2026-09-05T01:00:00.000Z'),
      snap('s6', '2026-09-06', '2026-09-06T01:00:00.000Z'),
      snap('s7', '2026-09-07', '2026-09-07T01:00:00.000Z'),
    ],
    product_entitlements: [],
  });
  await lockMembershipContentForRefund('u1', [P], { reason: 'r', now: LOCK_NOW, ...CUR }, db.client);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s5', 's6'], '09-06 근거는 두 번째 페이지에 있다');
  const evidence = db.calls.filter((c) => c.table === 'credit_transactions' && ['gte', 'lt', 'range'].includes(c.op));
  assert.ok(evidence.some((c) => c.op === 'gte' && (c.args as string[])[1] === '2026-09-04T15:00:00.000Z'), '첫 잠글 날(09-05 KST) 0시부터');
  assert.ok(evidence.some((c) => c.op === 'lt' && (c.args as string[])[1] === '2026-09-07T15:00:00.000Z'), '마지막 잠글 날(09-07 KST) 끝까지');
  assert.deepEqual(
    evidence.filter((c) => c.op === 'range').map((c) => c.args),
    [
      [0, 999],
      [1000, 1999],
    ]
  );
});

// ── 재리뷰 실측(낡은 창 과다 삭제) — 지급 때 기록한 창이 이후 타임라인 변화로 어긋나 **다른 결제의 열람**을 지웠다.
//   사용자 대리 결정(안전 기본값): 이 주문의 마지막 기간 end = 환불 직전 구독 renews_at(±1초)이고 다른 주문이 그 끝을 기록하지 않았을 때만 잠근다.
const T = (day: string) => `2026-${day}T00:00:00.000Z`;
const membershipOrder = (orderId: string, periods: Array<{ start: string; end: string }>, extra: Row = {}) => ({
  order_id: orderId,
  user_id: 'u1',
  package_id: 'membership_premium',
  status: 'fulfilled',
  amount: 49000,
  payment_key: `pk_${orderId}`,
  metadata: { membershipDaysGranted: 30 * periods.length, membershipPeriods: periods },
  ...extra,
});

test('PROBE2 해제→재구매→환불 — 옛 주문의 창은 구독 끝이 아니다 → 재구매 주문이 연 열람을 지우지 않고 skip(window_not_current)', async () => {
  const { markPaymentOrderRefunded } = await import('./payments/order-ledger');
  const A = { start: T('01-01'), end: T('01-31') }; // 01-10 관리자 해제(renews_at = 01-10)
  const B = { start: T('01-12'), end: T('02-11') }; // 01-12 재구매 — 구독 끝 = B.end
  const db = fakeDb({
    payment_orders: [membershipOrder('ord_a', [A]), membershipOrder('ord_b', [B])],
    subscriptions: [{ user_id: 'u1', renews_at: B.end }],
    credit_transactions: [memberDetail('b_view', '2026-01-20T01:00:00.000Z', '2026-01-20')], // B 기간에 연 열람(A 기록 창 안)
    today_fortune_result_snapshots: [snap('b_snap', '2026-01-20', '2026-01-20T01:00:00.000Z')],
    product_entitlements: [],
  });
  await markPaymentOrderRefunded({ orderId: 'ord_a', reason: 'admin_refund', source: 'admin-refund' }, db.client);
  assert.deepEqual(ids(db.tables.credit_transactions), ['b_view']);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['b_snap']);
  assert.deepEqual(
    db.inserted.map((r) => ({ ...(r.metadata as Row), lockedAt: undefined })),
    [
      {
        kind: 'membership_content_lock_skipped',
        skipReason: 'window_not_current',
        windows: [A],
        orderEnd: A.end,
        subscriptionRenewsAt: B.end, // 차감 **직전** 값(shortenMembershipForRefund 가 읽은 것)
        reason: 'admin_refund',
        actor: 'admin-refund',
        paymentKey: 'pk_ord_a',
        lockedAt: undefined,
      },
    ]
  );
  assert.equal(db.tables.payment_orders[0].last_error, 'admin_refund', 'skip 은 실패가 아니다(last_error 아님)');
});

test('PROBE3 연속 A·B → A 환불 → C 재구매 → B 환불 — B 의 기록 창은 C 가 쓰는 시간이라 skip(끝 불일치 · 같은 끝을 C 가 기록)', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const A = { start: T('07-01'), end: T('07-31') };
  const B = { start: T('07-31'), end: T('08-30') };
  const lockAt = new Date(T('08-15'));
  const views = () => [memberDetail('c_view', '2026-08-10T01:00:00.000Z', '2026-08-10')]; // C 가 연 열람(B 기록 창 안)

  // (가) A 환불이 구독을 만료시킨 뒤(08-05) C 재구매 → 구독 끝 = C.end ≠ B.end.
  const C1 = { start: T('08-05'), end: T('09-04') };
  const late = fakeDb({
    payment_orders: [membershipOrder('ord_a', [A], { status: 'refunded' }), membershipOrder('ord_b', [B]), membershipOrder('ord_c', [C1])],
    credit_transactions: views(),
  });
  const lateOptions = { reason: 'r', now: lockAt, orderId: 'ord_b', renewsAtBeforeRefund: C1.end };
  assert.deepEqual(await lockMembershipContentForRefund('u1', [B], lateOptions, late.client), { accessDeleted: 0, snapshotsDeleted: 0 });
  assert.deepEqual(ids(late.tables.credit_transactions), ['c_view']);
  assert.equal((late.inserted[0].metadata as Row).skipReason, 'window_not_current');

  // (나) A 를 07-10 에 환불(구독 끝 07-31)하고 만료 전 C 재구매 → C 는 07-31 에 이어 붙어 **B 와 같은 끝**(08-30). 끝만 보면 통과한다.
  const C2 = { start: T('07-31'), end: T('08-30') };
  const same = fakeDb({
    payment_orders: [membershipOrder('ord_a', [A], { status: 'refunded' }), membershipOrder('ord_b', [B]), membershipOrder('ord_c', [C2])],
    credit_transactions: views(),
  });
  const sameOptions = { reason: 'r', now: lockAt, orderId: 'ord_b', renewsAtBeforeRefund: B.end };
  assert.deepEqual(await lockMembershipContentForRefund('u1', [B], sameOptions, same.client), { accessDeleted: 0, snapshotsDeleted: 0 });
  assert.deepEqual(ids(same.tables.credit_transactions), ['c_view']);
  assert.deepEqual(
    { ...(same.inserted[0].metadata as Row), lockedAt: undefined },
    {
      kind: 'membership_content_lock_skipped',
      skipReason: 'window_not_current',
      windows: [B],
      orderEnd: B.end,
      subscriptionRenewsAt: B.end,
      claimedByOrderId: 'ord_c',
      reason: 'r',
      actor: null,
      paymentKey: null,
      lockedAt: undefined,
    }
  );
  assert.ok(same.calls.some((c) => c.table === 'payment_orders' && c.op === 'neq' && (c.args as string[])[1] === 'ord_b'), '자기 주문은 뺀다');
  assert.ok(same.calls.some((c) => c.table === 'payment_orders' && c.op === 'eq' && (c.args as string[])[1] === 'u1'), '그 사용자 주문만');
});

test('정상 — 연속 A·B 중 가장 최근(이어진) B 를 환불하면 B 창만 잠근다(A 창의 열람은 남는다) · 재시도 누적 기간도 끝이 맞으면 잠근다', async () => {
  const { lockMembershipContentForRefund } = await import('./subscription');
  const A = { start: T('07-01'), end: T('07-31') };
  const B = { start: T('07-31'), end: T('08-30') };
  const db = fakeDb({
    payment_orders: [membershipOrder('ord_a', [A]), membershipOrder('ord_b', [B])],
    credit_transactions: [
      use('a_cal', 'u1', 'calendar', '2026-07-10T00:00:00.000Z', { via: 'membership' }),
      use('b_cal', 'u1', 'calendar', '2026-08-05T00:00:00.000Z', { via: 'membership' }),
    ],
  });
  const options = { reason: 'r', now: new Date(T('08-10')), orderId: 'ord_b', renewsAtBeforeRefund: B.end };
  assert.deepEqual(await lockMembershipContentForRefund('u1', [B], options, db.client), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(ids(db.tables.credit_transactions), ['a_cal']);

  // 지급 재시도로 두 기간이 한 주문에 쌓여도(자기 주문은 비교에서 뺀다) 마지막 끝이 구독 끝이면 잠근다.
  const retried = fakeDb({
    payment_orders: [membershipOrder('ord_b', [A, B])],
    credit_transactions: [use('a_cal', 'u1', 'calendar', '2026-07-10T00:00:00.000Z', { via: 'membership' })],
  });
  assert.deepEqual(await lockMembershipContentForRefund('u1', [A, B], options, retried.client), { accessDeleted: 1, snapshotsDeleted: 0 });
});

// ── 훅 실행 — 원장 전이 함수를 가짜 DB 로 실제로 돌린다(소스 모양 고정만으로는 분기가 실제로 타는지 모른다).
//   dispatchGaRefund 는 VERCEL_ENV=production 이 아니면 DB·네트워크 전에 돌아간다(여기선 항상 그렇다 — 아래 가드).
// 실행 시각과 무관하게 이미 시작한 창 · end = 구독 renews_at(안전 조건 통과 — 이 주문이 구독의 현재 끝).
const CURRENT_PERIOD = { start: '2026-01-01T00:00:00.000Z', end: '2099-02-01T00:00:00.000Z' };
function refundDb(failOn: string[] = []) {
  return fakeDb(
    {
      payment_orders: [
        {
          order_id: 'ord_m',
          user_id: 'u1',
          package_id: 'membership_premium',
          status: 'fulfilled',
          amount: 49000,
          payment_key: 'pk_m',
          metadata: { membershipDaysGranted: 30, membershipPeriods: [CURRENT_PERIOD] },
        },
      ],
      subscriptions: [{ user_id: 'u1', renews_at: '2099-02-01T00:00:00.000Z' }],
      credit_transactions: [memberDetail('d_jan', '2026-01-10T01:00:00.000Z', '2026-01-10')],
      today_fortune_result_snapshots: [snap('s_jan', '2026-01-10', '2026-01-10T01:00:00.000Z')],
      product_entitlements: [],
    },
    failOn
  );
}

test('markPaymentOrderRefunded 실행 — 전액이면 구독 차감 + 잠금 · partial 이면 둘 다 안 함 · 멱등 재호출은 다시 잠그지 않음', async () => {
  assert.notEqual(process.env.VERCEL_ENV, 'production', 'GA refund 가 네트워크를 타지 않는 전제');
  const { markPaymentOrderRefunded } = await import('./payments/order-ledger');
  const input = { orderId: 'ord_m', reason: 'admin_refund', source: 'admin-refund' as const };

  const full = refundDb();
  await markPaymentOrderRefunded(input, full.client);
  assert.equal(full.tables.payment_orders[0].status, 'refunded');
  assert.equal(full.tables.subscriptions[0].renews_at, '2099-01-02T00:00:00.000Z', '구독에서 30일');
  assert.deepEqual(ids(full.tables.credit_transactions), [], '멤버십 열람 행 잠금');
  assert.deepEqual(ids(full.tables.today_fortune_result_snapshots), [], '멤버십만인 날 스냅샷 잠금');
  assert.equal(full.inserted.length, 1);
  assert.equal((full.inserted[0].metadata as Row).kind, 'membership_content_locked');
  assert.equal((full.inserted[0].metadata as Row).paymentKey, 'pk_m');
  assert.equal(full.tables.payment_orders[0].last_error, 'admin_refund', '실패 없으면 환불 사유 그대로');

  // 멱등: 이미 refunded — 사이에 새로 생긴 멤버십 행이 있어도 다시 잠그지 않는다(관리자 환불·나이스 통보·정산 겹침).
  full.tables.credit_transactions.push(memberDetail('d_jan2', '2026-01-11T01:00:00.000Z', '2026-01-11'));
  const again = await markPaymentOrderRefunded(input, full.client);
  assert.equal(again.orderId, 'ord_m', '기존 행을 돌려준다');
  assert.deepEqual(ids(full.tables.credit_transactions), ['d_jan2']);
  assert.equal(full.inserted.length, 1, '감사행도 1개 그대로');
  assert.equal(full.tables.subscriptions[0].renews_at, '2099-01-02T00:00:00.000Z', '두 번 빼지 않는다');

  const partial = refundDb();
  await markPaymentOrderRefunded({ ...input, partial: true }, partial.client);
  assert.equal(partial.tables.payment_orders[0].status, 'refunded');
  assert.deepEqual(ids(partial.tables.credit_transactions), ['d_jan'], '부분환불은 잠그지 않는다(B단계)');
  assert.deepEqual(ids(partial.tables.today_fortune_result_snapshots), ['s_jan']);
  assert.equal(partial.inserted.length, 0);
  assert.equal(partial.tables.subscriptions[0].renews_at, '2099-02-01T00:00:00.000Z');
});

// 리뷰: 후처리 실패는 last_error 에 환불 사유 뒤로 이어 붙인다(덮지 않는다).
test('markPaymentOrderRefunded 실행 — 차감 실패면 환불 직전 끝을 몰라 잠그지 않고(skip 감사) · 잠금 실패는 last_error 에 흔적', async () => {
  const { markPaymentOrderRefunded } = await import('./payments/order-ledger');
  const input = { orderId: 'ord_m', reason: 'admin_refund', source: 'admin-refund' as const };
  const shortenFailed = refundDb(['subscriptions']);
  await markPaymentOrderRefunded(input, shortenFailed.client);
  assert.equal(shortenFailed.tables.payment_orders[0].last_error, 'admin_refund | membership_shorten_failed: boom');
  assert.equal(shortenFailed.tables.payment_orders[0].status, 'refunded', '후처리 실패가 전이를 되돌리지 않는다');
  assert.deepEqual(ids(shortenFailed.tables.credit_transactions), ['d_jan'], '판단 근거가 없으면 지우지 않는다');
  assert.equal((shortenFailed.inserted[0].metadata as Row).skipReason, 'subscription_unknown');

  const lockFailed = refundDb(['credit_transactions']);
  await markPaymentOrderRefunded(input, lockFailed.client);
  assert.equal(lockFailed.tables.payment_orders[0].last_error, 'admin_refund | membership_lock_failed: boom');
  assert.equal(lockFailed.tables.subscriptions[0].renews_at, '2099-01-02T00:00:00.000Z', '차감은 됐다');
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

test('잠금 훅은 구독 차감 뒤 · 멤버십 경로만 via 표식', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  // 분기·멱등·흔적은 "markPaymentOrderRefunded 실행" 테스트가 실제로 돌려 본다. 여기선 실행으로 안 드러나는 순서만.
  const ledger = read('payments/order-ledger.ts');
  const refunded = ledger.slice(ledger.indexOf('export async function markPaymentOrderRefunded'));
  assert.ok(
    /if \(membershipDays > 0\) \{[\s\S]*?await shortenMembershipForRefund\([\s\S]*?await lockMembershipContentForRefund\(/.test(refunded),
    '구독 차감 뒤에 잠근다'
  );

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
