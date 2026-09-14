// 2026-09-13 — 멤버십 환불 시 구독 종료(사용자 요청). 구독은 사용자당 1행이고 결제(30일)·관리자 부여가 renews_at 끝에 누적된다.
//   "지금 종료"는 다른 기간까지 날리고, 상태만 cancelled 는 혜택이 안 끊긴다(isEntitledStatus 가 cancelled 를 권한으로 본다).
// 2026-09-14 — 결제별 기간 원장(membership_periods, 086 · docs/membership-period-ledger-design.md). 지급·부여·해제·환불이 전부 표를 갱신하고
//   환불 잠금 창은 표의 그 결제 행에서 나온다(추정 창·claimant·window_not_current 휴리스틱 삭제). 아래 시나리오는 실제 연산을 가짜 DB 로 돌린다.
//   리뷰 반영: #820 일수 차감 폴백 삭제(정본은 표 하나) · 상향 자가치유 · 겹침 배제 제약(가짜 DB 도 흉내) · 레거시 전 주제 근거 · 잠금 ① 페이지네이션.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { activateMembershipSubscription, expireMembershipNow, lockMembershipContentForRefund, refundMembershipPeriod } from './subscription';
import { markPaymentOrderRefunded } from './payments/order-ledger';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = new Date('2026-09-13T00:00:00.000Z');
const DAY = 86_400_000;

// ─────────────────────────────────────────────────────────────
// 가짜 DB — PostgREST 흉내. select·delete·update·upsert 체인(then/maybeSingle/single 로 실행) · insert(표에도 들어간다) · order/range.
//   SQL 처럼 `NULL = x` 는 거짓 · 필터 인자는 calls 에 기록 · **유일 키(id)로 끝나지 않는 정렬의 range 는 throw**(같은 created_at 이
//   페이지 경계에 걸리면 행을 건너뛰거나 겹친다) · range 없는 select 는 1000행에서 자른다(PostgREST max-rows).
//   membership_periods 는 배제 제약(membership_periods_live_no_overlap)을 흉내 — 같은 사용자의 살아 있는 [start, end) 가 겹치는 insert·update 는
//   23P01 로 거부(update 는 되돌린다) → 모든 시나리오가 "겹치지 않는 사슬" 불변식을 자동으로 검증한다.
//   failOn 은 'table'(모든 연산) 또는 'table:delete'·'table:insert' 처럼 연산 하나만.
// ─────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
const MAX_ROWS = 1000;
const EXCLUDED = { code: '23P01', message: 'conflicting key value violates exclusion constraint "membership_periods_live_no_overlap"' };
const liveClash = (a: Row, b: Row) =>
  a !== b &&
  a.user_id === b.user_id &&
  a.voided_at == null &&
  b.voided_at == null &&
  Date.parse(String(a.start_at)) < Date.parse(String(b.end_at)) &&
  Date.parse(String(b.start_at)) < Date.parse(String(a.end_at));

function fakeDb(tables: Record<string, Row[]>, failOn: string | string[] = []) {
  const failing = [failOn].flat();
  const inserted: Row[] = [];
  const calls: Array<{ table: string; op: string; args: unknown[] }> = [];
  let seq = 0;
  const client = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let mode: 'select' | 'delete' | 'update' | 'upsert' = 'select';
      let patch: Row = {};
      let conflict = '';
      const sorts: string[] = [];
      let window: [number, number] | null = null;
      const log = (op: string, args: unknown[]) => calls.push({ table, op, args });
      const fails = (op: string) => failing.includes(table) || failing.includes(`${table}:${op}`);
      const at = (r: Row, col: string) => (r[col] == null ? NaN : Date.parse(String(r[col])));
      const run = () => {
        if (fails(mode)) return { data: null, error: { message: 'boom' } };
        const rows = (tables[table] ??= []);
        if (mode === 'upsert') {
          const hit = rows.find((r) => r[conflict] === patch[conflict]);
          if (hit) Object.assign(hit, patch);
          else rows.push({ ...patch });
          return { data: [hit ?? rows[rows.length - 1]], error: null };
        }
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        for (const col of [...sorts].reverse()) matched.sort((a, b) => String(a[col]).localeCompare(String(b[col])));
        const hits = window ? matched.slice(window[0], window[1] + 1) : mode === 'select' ? matched.slice(0, MAX_ROWS) : matched;
        if (mode === 'delete') tables[table] = rows.filter((r) => !hits.includes(r));
        if (mode === 'update') {
          const before = hits.map((r) => ({ ...r }));
          hits.forEach((r) => Object.assign(r, patch));
          if (table === 'membership_periods' && hits.some((a) => rows.some((b) => liveClash(a, b)))) {
            hits.forEach((r, i) => Object.assign(r, before[i]));
            return { data: null, error: EXCLUDED };
          }
        }
        return { data: hits, error: null };
      };
      const chain: Record<string, unknown> = {};
      const filter = (op: string, args: unknown[], f: (r: Row) => boolean) => (log(op, args), filters.push(f), chain);
      Object.assign(chain, {
        select: () => chain,
        delete: () => ((mode = 'delete'), log('delete', []), chain),
        update: (p: Row) => ((mode = 'update'), (patch = p), log('update', [p]), chain),
        upsert: (p: Row, opts: { onConflict: string }) => ((mode = 'upsert'), (patch = p), (conflict = opts.onConflict), log('upsert', [p]), chain),
        eq: (col: string, val: unknown) => filter('eq', [col, val], (r) => r[col] != null && r[col] === val),
        neq: (col: string, val: unknown) => filter('neq', [col, val], (r) => r[col] != null && r[col] !== val),
        is: (col: string, val: null) => filter('is', [col, val], (r) => (val === null ? r[col] == null : r[col] === val)),
        in: (col: string, vals: unknown[]) => filter('in', [col, vals], (r) => vals.includes(r[col])),
        not: (col: string, op: string, list: string) =>
          filter('not', [col, op, list], (r) => op === 'in' && !list.slice(1, -1).split(',').includes(String(r[col]))),
        contains: (col: string, obj: Row) =>
          filter('contains', [col, obj], (r) => Object.entries(obj).every(([k, v]) => (r[col] as Row | null)?.[k] === v)),
        gte: (col: string, v: string) => filter('gte', [col, v], (r) => at(r, col) >= Date.parse(v)),
        lt: (col: string, v: string) => filter('lt', [col, v], (r) => at(r, col) < Date.parse(v)),
        order: (col: string) => (log('order', [col]), sorts.push(col), chain),
        range: (from: number, to: number) => {
          if (sorts[sorts.length - 1] !== 'id') throw new Error(`${table}: 유일 키(id)로 끝나지 않는 정렬의 range`);
          return log('range', [from, to]), (window = [from, to]), chain;
        },
        maybeSingle: () => {
          const { data, error } = run();
          return Promise.resolve({ data: data?.[0] ?? null, error });
        },
        single: () => {
          const { data, error } = run();
          return Promise.resolve({ data: data?.[0] ?? null, error });
        },
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
        insert: (rows: Row | Row[]) => {
          log('insert', [rows]);
          if (fails('insert')) return Promise.resolve({ error: { message: 'boom' } });
          const list = [rows].flat();
          const defaults = table === 'membership_periods' ? { voided_at: null, void_reason: null } : {};
          const next = list.map((r) => ({ id: `${table}_${++seq}`, ...defaults, ...r }));
          const existing = (tables[table] ??= []);
          if (table === 'membership_periods' && next.some((a) => [...existing, ...next].some((b) => liveClash(a, b)))) {
            return Promise.resolve({ error: EXCLUDED });
          }
          inserted.push(...list);
          existing.push(...next);
          return Promise.resolve({ error: null });
        },
      });
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, tables, inserted, calls };
}

/** 열람 행 id(감사행 entitlement_revoke 는 뺀다 — insert 가 표에 들어가므로). */
const ids = (rows: Row[] | undefined) => (rows ?? []).filter((r) => r.feature !== 'entitlement_revoke').map((r) => r.id);
const audits = (db: { inserted: Row[] }) => db.inserted.filter((r) => r.feature === 'entitlement_revoke').map((r) => r.metadata as Row);

test('가짜 DB 는 유일 키(id)로 끝나지 않는 정렬의 range 를 거부한다(페이지가 행을 건너뛰거나 겹치는 코드를 초록으로 두지 않게)', () => {
  const db = fakeDb({ t: [] });
  type Q = { order: (c: string) => Q; range: (a: number, b: number) => unknown };
  const q = () => db.client.from('t').select('*') as unknown as Q;
  assert.throws(() => q().range(0, 999), /유일 키\(id\)/);
  assert.throws(() => q().order('created_at').range(0, 999), /유일 키\(id\)/, '같은 created_at 이 페이지 경계에 걸리면 순서가 흔들린다');
  assert.doesNotThrow(() => q().order('created_at').order('id').range(0, 999));
});

test('가짜 DB 는 range 없는 select 를 1000행에서 자른다(PostgREST max-rows) — 페이지 없이 읽는 코드를 초록으로 두지 않게', async () => {
  const db = fakeDb({ t: Array.from({ length: 1001 }, (_, i) => ({ id: i })) });
  const { data } = (await db.client.from('t').select('*')) as { data: Row[] };
  assert.equal(data.length, 1000);
});

test('가짜 DB 는 살아 있는 기간 겹침을 거부한다(배제 제약 흉내, 23P01) — 맞닿음·다른 사용자·무효 행은 허용 · 거부된 update 는 되돌린다', async () => {
  const period = (id: string, start: string, end: string) => ({ id, user_id: 'u1', source: 'admin_grant', order_id: null, start_at: start, end_at: end, voided_at: null, void_reason: null });
  const db = fakeDb({ membership_periods: [period('a', '2026-07-01T00:00:00.000Z', '2026-07-31T00:00:00.000Z')] });
  const table = () => db.client.from('membership_periods');
  const clash = await table().insert({ user_id: 'u1', source: 'admin_grant', start_at: '2026-07-30T00:00:00.000Z', end_at: '2026-08-10T00:00:00.000Z' });
  assert.equal(clash.error?.code, '23P01');
  assert.equal(db.tables.membership_periods.length, 1, '거부된 insert 는 표에 없다');
  for (const ok of <Row[]>[
    { user_id: 'u1', source: 'admin_grant', start_at: '2026-07-31T00:00:00.000Z', end_at: '2026-08-10T00:00:00.000Z' }, // 맞닿음
    { user_id: 'u2', source: 'admin_grant', start_at: '2026-07-10T00:00:00.000Z', end_at: '2026-07-20T00:00:00.000Z' }, // 다른 사용자
    { user_id: 'u1', source: 'admin_grant', start_at: '2026-07-10T00:00:00.000Z', end_at: '2026-07-20T00:00:00.000Z', voided_at: '2026-07-05T00:00:00.000Z' }, // 무효 행
  ]) {
    assert.equal((await table().insert(ok)).error, null);
  }
  const voided = db.tables.membership_periods.find((r) => r.voided_at != null)!;
  assert.equal((await table().update({ voided_at: null }).eq('id', voided.id as string)).error?.code, '23P01', '무효 행을 되살려 겹치게');
  assert.equal(voided.voided_at, '2026-07-05T00:00:00.000Z', '거부된 update 는 되돌린다');
  assert.equal((await table().update({ start_at: '2026-07-20T00:00:00.000Z' }).eq('start_at', '2026-07-31T00:00:00.000Z')).error?.code, '23P01', '당겨서 겹치게');
});

// ── 시나리오 — 실제 연산(지급·부여·해제·환불+잠금)을 한 사용자 타임라인으로 돌린다 ──
const T = (monthDay: string) => `2026-${monthDay}T00:00:00.000Z`;
const PLAN = 'premium_monthly' as const;
const use = (id: string, userId: string, feature: string, createdAt: string, meta: Row) => ({
  id,
  user_id: userId,
  type: 'use',
  feature,
  created_at: createdAt,
  metadata: meta,
});
/** 멤버십으로 연 달력 행. */
const mcal = (id: string, createdAt: string) => use(id, 'u1', 'calendar', createdAt, { kind: 'fortune_calendar_month_access', via: 'membership' });
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

function world(views: Row[] = [], snapshots: Row[] = []) {
  const db = fakeDb({
    subscriptions: [],
    membership_periods: [],
    credit_transactions: views,
    today_fortune_result_snapshots: snapshots,
    product_entitlements: [],
  });
  const opts = (at: string) => ({ now: new Date(at), service: db.client });
  return {
    db,
    buy: (orderId: string, at: string) => activateMembershipSubscription('u1', { plan: PLAN, orderId, ...opts(at) }),
    grant: (days: number, at: string) => activateMembershipSubscription('u1', { plan: PLAN, days, ...opts(at) }),
    revoke: (at: string) => expireMembershipNow('u1', opts(at)),
    refund: async (orderId: string, at: string) => {
      assert.equal(await refundMembershipPeriod('u1', orderId, opts(at)), true);
      return lockMembershipContentForRefund('u1', orderId, { reason: 'r', now: new Date(at) }, db.client);
    },
    /** 살아 있는 기간 사슬 [주문 또는 source, start, end]. */
    chain: () =>
      db.tables.membership_periods
        .filter((r) => r.voided_at == null)
        .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)))
        .map((r) => [r.order_id ?? r.source, r.start_at, r.end_at]),
    sub: () => ({ status: db.tables.subscriptions[0]?.status, renewsAt: db.tables.subscriptions[0]?.renews_at }),
    views: () => ids(db.tables.credit_transactions),
  };
}

test('연속 A·B 에서 A 환불 — B 가 A 가 비운 만큼 당겨지고(구독 끝도) A 창만 잠근다 · 이어서 B 환불은 B 창만', async () => {
  const w = world([mcal('before', T('06-20')), mcal('a_view', T('07-05'))]);
  await w.buy('ord_a', T('07-01'));
  await w.buy('ord_b', T('07-05'));
  assert.deepEqual(w.chain(), [['ord_a', T('07-01'), T('07-31')], ['ord_b', T('07-31'), T('08-30')]], '뒤 결제는 사슬 끝에 이어 붙는다');
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('08-30') });

  assert.deepEqual(await w.refund('ord_a', T('07-10')), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(w.chain(), [['ord_b', T('07-10'), T('08-09')]], 'A 가 남긴 21일만큼 B 가 당겨져 환불 시각에 이어 붙는다');
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('08-09') });
  assert.deepEqual(w.views(), ['before'], 'A 창 [07-01, 07-10) 만 — 앞 기간 열람은 남는다');
  assert.deepEqual(audits(w.db)[0].windows, [{ start: T('07-01'), end: T('07-10') }]);

  w.db.tables.credit_transactions.push(mcal('b_view', T('07-15')));
  assert.deepEqual(await w.refund('ord_b', T('07-20')), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(w.views(), ['before']);
  assert.deepEqual(audits(w.db)[1].windows, [{ start: T('07-10'), end: T('07-20') }], 'B 의 당겨진 창');
  assert.deepEqual(w.sub(), { status: 'expired', renewsAt: T('07-20') }, '살아 있는 기간이 없으면 즉시 만료');
});

test('B 먼저 환불(아직 시작 안 한 미래 기간) — 잠글 게 없고(skip 감사) 뒤 기간 C 를 B 전체만큼 당긴다 · A 열람은 남는다', async () => {
  const w = world([mcal('a_view', T('07-05'))]);
  await w.buy('ord_a', T('07-01'));
  await w.buy('ord_b', T('07-05'));
  await w.buy('ord_c', T('07-06'));
  assert.deepEqual(await w.refund('ord_b', T('07-10')), { accessDeleted: 0, snapshotsDeleted: 0 });
  assert.deepEqual(w.chain(), [['ord_a', T('07-01'), T('07-31')], ['ord_c', T('07-31'), T('08-30')]]);
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('08-30') });
  assert.deepEqual(w.views(), ['a_view']);
  assert.deepEqual(audits(w.db), [
    {
      kind: 'membership_content_lock_skipped',
      skipReason: 'no_elapsed_window',
      periods: [{ start: T('07-31'), end: T('08-30'), voidedAt: T('07-10') }],
      orderId: 'ord_b',
      reason: 'r',
      actor: null,
      paymentKey: null,
      lockedAt: T('07-10'),
    },
  ]);
  assert.equal(w.db.calls.filter((c) => c.op === 'delete').length, 0);
});

test('해제 → 재구매 → 옛 주문 환불 — 옛 창은 해제 시각에서 끝나 재구매 기간의 열람·스냅샷을 지우지 않는다(과다 없음)', async () => {
  const w = world(
    [mcal('a_view', T('01-05')), memberDetail('b_view', '2026-01-15T01:00:00.000Z', '2026-01-15')],
    [snap('b_snap', '2026-01-15', '2026-01-15T01:00:00.000Z')]
  );
  await w.buy('ord_a', T('01-01'));
  await w.revoke(T('01-10'));
  assert.deepEqual(w.chain(), [['ord_a', T('01-01'), T('01-10')]], '진행 중 기간은 해제 시각에서 끝');
  assert.deepEqual(w.sub(), { status: 'expired', renewsAt: T('01-10') });
  await w.buy('ord_b', T('01-12'));
  assert.deepEqual(w.chain(), [['ord_a', T('01-01'), T('01-10')], ['ord_b', T('01-12'), T('02-11')]], '재구매는 지금부터(옛 끝에 붙지 않는다)');

  assert.deepEqual(await w.refund('ord_a', T('01-20')), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(w.views(), ['b_view']);
  assert.deepEqual(ids(w.db.tables.today_fortune_result_snapshots), ['b_snap']);
  assert.deepEqual(w.chain(), [['ord_b', T('01-12'), T('02-11')]], '이미 끝난 기간 환불은 뒤를 당기지 않는다');
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('02-11') });
});

test('환불 → 재구매 → 환불 — 새 결제 창은 새 결제 행에서 나와 그 결제로 연 열람을 잠근다(과소 없음)', async () => {
  const w = world([mcal('a_view', T('03-02'))]);
  await w.buy('ord_a', T('03-01'));
  assert.deepEqual(await w.refund('ord_a', T('03-05')), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(w.sub(), { status: 'expired', renewsAt: T('03-05') });
  await w.buy('ord_c', T('03-10'));
  assert.deepEqual(w.chain(), [['ord_c', T('03-10'), T('04-09')]]);
  w.db.tables.credit_transactions.push(mcal('c_view', T('03-15')));
  assert.deepEqual(await w.refund('ord_c', T('03-20')), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(w.views(), []);
});

test('관리자 부여가 결제 사이에 끼면 — 앞 결제 환불이 부여·뒤 결제를 함께 당기고, 뒤 결제 환불은 부여 기간 열람을 지우지 않는다', async () => {
  const w = world();
  await w.buy('ord_a', T('05-01'));
  await w.grant(10, T('05-05'));
  await w.buy('ord_b', T('05-06'));
  assert.deepEqual(w.chain(), [
    ['ord_a', T('05-01'), T('05-31')],
    ['admin_grant', T('05-31'), T('06-10')],
    ['ord_b', T('06-10'), T('07-10')],
  ]);
  await w.refund('ord_a', T('05-15'));
  assert.deepEqual(w.chain(), [
    ['admin_grant', T('05-15'), T('05-25')],
    ['ord_b', T('05-25'), T('06-24')],
  ]);
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('06-24') });
  w.db.tables.credit_transactions.push(mcal('g_view', T('05-20')), mcal('b_view', T('05-28')));
  assert.deepEqual(await w.refund('ord_b', T('06-01')), { accessDeleted: 1, snapshotsDeleted: 0 });
  assert.deepEqual(w.views(), ['g_view'], '부여 기간 열람은 결제 환불과 무관');
  assert.deepEqual(w.sub(), { status: 'expired', renewsAt: T('06-01') }, '남은 부여 기간이 이미 끝났으면 만료');
});

test('지급 재시도 멱등 — 같은 주문의 기간 행이 있으면 새 행·연장 없음(granted false) · 앞 시도가 구독 갱신 전에 끊겼으면 구독만 맞춘다 · 환불된 주문은 되살리지 않는다', async () => {
  const w = world();
  assert.equal((await w.buy('ord_a', T('07-01'))).granted, true);
  const retry = await w.buy('ord_a', T('07-02'));
  assert.equal(retry.granted, false);
  assert.equal(retry.subscription.renewsAt, T('07-31'));
  assert.equal(w.db.tables.membership_periods.length, 1, '+60 버그 — 재시도가 30일을 더 붙이지 않는다');
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('07-31') });

  const torn = fakeDb({
    subscriptions: [],
    membership_periods: [{ id: 'p', user_id: 'u1', source: 'payment', order_id: 'ord_a', start_at: T('07-01'), end_at: T('07-31'), voided_at: null, void_reason: null }],
  });
  const repaired = await activateMembershipSubscription('u1', { plan: PLAN, orderId: 'ord_a', now: new Date(T('07-02')), service: torn.client });
  assert.equal(repaired.granted, false);
  assert.equal(torn.tables.membership_periods.length, 1);
  assert.deepEqual([torn.tables.subscriptions[0].status, torn.tables.subscriptions[0].renews_at], ['active', T('07-31')]);

  await w.refund('ord_a', T('07-10'));
  assert.equal((await w.buy('ord_a', T('07-11'))).granted, false, '무효된 주문의 재시도도 다시 지급하지 않는다');
  assert.deepEqual(w.chain(), []);
});

test('관리자 해제(#821) — 진행 중 기간은 지금에서 끝, 미래 기간은 무효(admin_revoke), 지난 기간은 그대로 · 구독 expired + renews_at 지금(그 사용자만)', async () => {
  const period = (id: string, start: string, end: string, userId = 'u1') => ({ id, user_id: userId, source: 'payment', order_id: `ord_${id}`, start_at: start, end_at: end, voided_at: null, void_reason: null });
  const db = fakeDb({
    subscriptions: [{ user_id: 'u1', status: 'active', renews_at: T('10-31') }, { user_id: 'u2', status: 'active', renews_at: T('10-31') }],
    membership_periods: [period('past', T('08-01'), T('08-31')), period('now', T('09-01'), T('10-01')), period('next', T('10-01'), T('10-31')), period('u2', T('09-01'), T('10-01'), 'u2')],
  });
  await expireMembershipNow('u1', { now: NOW, service: db.client });
  const byId = Object.fromEntries(db.tables.membership_periods.map((r) => [r.id, r]));
  assert.equal(byId.past.end_at, T('08-31'));
  assert.equal(byId.now.end_at, NOW.toISOString());
  assert.deepEqual([byId.next.voided_at, byId.next.void_reason, byId.next.end_at], [NOW.toISOString(), 'admin_revoke', T('10-31')]);
  assert.equal(byId.u2.end_at, T('10-01'));
  assert.deepEqual(db.tables.subscriptions[0], { user_id: 'u1', status: 'expired', renews_at: NOW.toISOString(), updated_at: NOW.toISOString() });
  assert.equal(db.tables.subscriptions[1].status, 'active');

  const route = fs.readFileSync(path.resolve(__dirname, '../app/api/admin/membership/grant/route.ts'), 'utf8');
  assert.ok(/\} else \{\s*await expireMembershipNow\(userId\);/.test(route));
  assert.ok(!/updateSubscriptionStatus\(userId, 'cancelled'\)/.test(route), 'cancelled 로는 혜택이 안 끊긴다');
});

// 리뷰 BUG1(P1): 086 적용~배포 사이 옛 코드 결제 O 가 구독만 +30일 — base 를 표 끝으로 잡으면 새 결제 Q 가 O 의 30일을 덮어 유료 기간이 사라진다.
test('상향 자가치유(P1) — 구독 끝이 표보다 뒤면 그 틈을 legacy 행으로 메우고 이어 붙인다 · 새 결제 환불은 옛 구독 끝으로 복귀 · 행이 없어도 같다', async () => {
  const w = world();
  w.db.tables.membership_periods.push({ id: 'l', user_id: 'u1', source: 'legacy', order_id: null, start_at: T('09-01'), end_at: T('09-30'), voided_at: null, void_reason: null });
  w.db.tables.subscriptions.push({ user_id: 'u1', status: 'active', plan: PLAN, renews_at: T('10-30') }); // 옛 코드 결제 O
  await w.buy('ord_q', T('09-10'));
  assert.deepEqual(w.chain(), [
    ['legacy', T('09-01'), T('09-30')],
    ['legacy', T('09-30'), T('10-30')],
    ['ord_q', T('10-30'), T('11-29')],
  ]);
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('11-29') }, 'O 의 30일 뒤에 붙는다(10-30 이 아니라)');
  assert.deepEqual(await w.refund('ord_q', T('09-15')), { accessDeleted: 0, snapshotsDeleted: 0 });
  assert.deepEqual(w.sub(), { status: 'active', renewsAt: T('10-30') }, 'Q 환불은 Q 만 — O 의 30일은 남는다');

  const bare = world();
  bare.db.tables.subscriptions.push({ user_id: 'u1', status: 'active', plan: PLAN, renews_at: T('10-30') });
  await bare.grant(10, T('09-10'));
  assert.deepEqual(bare.chain(), [['legacy', T('09-10'), T('10-30')], ['admin_grant', T('10-30'), T('11-09')]], '관리자 부여도 같은 경로 · 틈은 지금부터');
  assert.deepEqual(bare.sub(), { status: 'active', renewsAt: T('11-09') });
});

// ─────────────────────────────────────────────────────────────
// 잠금 규칙(A단계 유지) — via:'membership' 열람 행 · 스냅샷 날 단위 판정 · 근거 조회 범위+페이지네이션.
//   창은 표의 무효 행: [start_at, min(end_at, voided_at)).
// ─────────────────────────────────────────────────────────────
const P = { start: '2026-09-01T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z' };
const LOCK_NOW = new Date('2026-09-10T00:00:00.000Z');
const refundedRow = (voidedAt: string) => ({
  id: 'p_m',
  user_id: 'u1',
  source: 'payment',
  order_id: 'ord_m',
  start_at: P.start,
  end_at: P.end,
  voided_at: voidedAt,
  void_reason: 'refund',
});
function lockDb(tables: Record<string, Row[]>, voidedAt = LOCK_NOW.toISOString(), failOn: string | string[] = []) {
  return fakeDb({ membership_periods: [refundedRow(voidedAt)], today_fortune_result_snapshots: [], product_entitlements: [], ...tables }, failOn);
}
const lock = (db: ReturnType<typeof fakeDb>, extra: { actor?: string; paymentKey?: string } = {}) =>
  lockMembershipContentForRefund('u1', 'ord_m', { reason: 'r', now: LOCK_NOW, ...extra }, db.client);

test('lockMembershipContentForRefund — 창 안의 멤버십 열람 행만 지운다(창 밖·쿠폰·다른 사용자·다른 기능·지급 행은 남긴다) · 감사에 지운 것의 식별자', async () => {
  const db = lockDb({
    credit_transactions: [
      use('cal_in', 'u1', 'calendar', '2026-09-01T00:00:00.000Z', { kind: 'fortune_calendar_month_access', readingKey: 'rk1', yearMonth: '2026-09', via: 'membership' }), // 시작 경계 포함
      memberDetail('det_in', '2026-09-05T00:00:00.000Z', '2026-09-05'),
      use('det_before', 'u1', 'detail_report', '2026-08-31T23:59:59.000Z', { via: 'membership' }), // 앞 결제 기간
      use('det_after_void', 'u1', 'detail_report', '2026-09-10T00:00:00.000Z', { via: 'membership' }), // min(end, voided_at) 끝 경계 제외
      use('other_user', 'u2', 'calendar', '2026-09-05T00:00:00.000Z', { via: 'membership' }),
      use('dialogue', 'u1', 'dialogue', '2026-09-05T00:00:00.000Z', { via: 'membership' }),
      { id: 'grant', user_id: 'u1', type: 'purchase', feature: 'calendar', created_at: '2026-09-05T00:00:00.000Z', metadata: { via: 'membership' } },
    ],
    today_fortune_result_snapshots: [
      snap('s_in', '2026-09-05', '2026-09-05T00:00:00.000Z'),
      snap('s_calendar_day', '2026-09-01', '2026-09-01T02:00:00.000Z', { access_source: 'coin-session' }), // 달력만 연 날은 상세 스냅샷을 잠글 날이 아니다
    ],
  });
  const result = await lock(db, { actor: 'admin', paymentKey: 'pk_m' });

  assert.deepEqual(result, { accessDeleted: 2, snapshotsDeleted: 1 });
  assert.deepEqual(ids(db.tables.credit_transactions), ['det_before', 'det_after_void', 'other_user', 'dialogue', 'grant']);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_calendar_day']);
  assert.equal(db.inserted.length, 1, '감사행은 1개');
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
      orderId: 'ord_m',
      reason: 'r',
      actor: 'admin',
      paymentKey: 'pk_m',
      lockedAt: LOCK_NOW.toISOString(),
    },
  });
  assert.ok(!JSON.stringify(db.inserted[0]).includes('sess_'), '감사엔 지정한 식별자만(metadata 를 통째로 복사하지 않는다)');
  assert.ok(db.calls.some((c) => c.table === 'membership_periods' && c.op === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'u1'), '그 사용자의 기간만');
});

// 리뷰 실측(과소 잠금): 'membership' 표식은 그날 첫 POST 스냅샷에만 붙는다 → 스냅샷은 표식이 아니라 **날** 로 판정한다.
test('멤버십만인 날 — 그날 스냅샷은 표식과 무관하게 전부 잠근다(GET·주제 전환·다른 사주) · 멤버십 상세 행이 없는 날·다른 사용자는 남긴다', async () => {
  const db = lockDb({
    credit_transactions: [memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05')],
    today_fortune_result_snapshots: [
      snap('s_mem', '2026-09-05', '2026-09-05T01:00:00.000Z'),
      snap('s_get', '2026-09-05', '2026-09-05T02:00:00.000Z', { access_source: 'coin-session' }),
      snap('s_concern', '2026-09-05', '2026-09-05T03:00:00.000Z', { access_source: 'reused', concern_id: 'love' }),
      snap('s_other_saju', '2026-09-05', '2026-09-05T04:00:00.000Z', { access_source: 'coin-daily', scope_key: 'today-detail:rk2:2026-09-05:general' }),
      snap('s_no_member_day', '2026-09-06', '2026-09-06T01:00:00.000Z', { access_source: 'coin-session' }),
      { ...snap('s_u2', '2026-09-05', '2026-09-05T01:00:00.000Z'), user_id: 'u2' },
    ],
  });
  assert.deepEqual(await lock(db), { accessDeleted: 1, snapshotsDeleted: 4 });
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_no_member_day', 's_u2']);
});

// 반대 방향(과다 잠금): 그날 전·카드·쿠폰으로도 열 수 있었다면 그날 스냅샷은 산 것이다.
test('그날 다른 근거가 있으면 그날 스냅샷 유지 — 전 결제(charged)·today-detail 카드 이용권(KST 날짜)·카카오 쿠폰 · 멤버십만인 날만 잠김', async () => {
  const db = lockDb({
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
  assert.deepEqual(await lock(db), { accessDeleted: 4, snapshotsDeleted: 1 }, '멤버십 열람 행은 날과 무관하게 전부 지운다(근거 있는 날은 그 근거가 연다)');
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s5', 's6', 's7']);
  assert.deepEqual(ids(db.tables.credit_transactions), ['charged5', 'coupon7', 'u2_charged8', 'member_prev8'], '근거 행은 그대로');
});

test('창 밖 스냅샷 유지 — 잠글 날이어도 창 시작 전(앞 기간)·창 끝 이후(다음 기간)에 만든 그날 스냅샷은 남긴다', async () => {
  // 창 시작 09-01 00:00Z = KST 09-01 09:00. 같은 KST 날에 앞 기간(08:00)과 이 기간(10:00) 이 겹친다.
  const before = lockDb({
    credit_transactions: [memberDetail('d1_prev', '2026-08-31T23:00:00.000Z', '2026-09-01'), memberDetail('d1', '2026-09-01T01:00:00.000Z', '2026-09-01')],
    today_fortune_result_snapshots: [snap('s_prev_period', '2026-09-01', '2026-08-31T23:00:00.000Z'), snap('s_this_period', '2026-09-01', '2026-09-01T01:00:00.000Z')],
  });
  await lock(before);
  assert.deepEqual(ids(before.tables.today_fortune_result_snapshots), ['s_prev_period']);
  assert.deepEqual(ids(before.tables.credit_transactions), ['d1_prev'], '앞 기간 멤버십 행은 남지만 "다른 근거"는 아니다');

  // 창 끝 10-01 00:00Z(이미 끝난 기간을 뒤늦게 환불 — voided_at 12-01, 창은 end 까지) = KST 10-01 09:00.
  const after = lockDb(
    {
      credit_transactions: [memberDetail('d_last', '2026-09-30T23:00:00.000Z', '2026-10-01'), mcal('next_cal', '2026-10-01T00:00:00.000Z')],
      today_fortune_result_snapshots: [snap('s_this_period', '2026-10-01', '2026-09-30T23:30:00.000Z'), snap('s_next_period', '2026-10-01', '2026-10-01T01:00:00.000Z')],
    },
    '2026-12-01T00:00:00.000Z'
  );
  await lock(after);
  assert.deepEqual(ids(after.tables.today_fortune_result_snapshots), ['s_next_period']);
  assert.deepEqual(ids(after.tables.credit_transactions), ['next_cal'], 'end 시각 행은 다음 기간 몫');
});

test('주제 단품(재물·일, 전역) 보유자 — 그 주제 스냅샷은 단품이 연 것이라 남긴다', async () => {
  const db = lockDb({
    credit_transactions: [memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05')],
    today_fortune_result_snapshots: [
      snap('s_general', '2026-09-05', '2026-09-05T01:00:00.000Z'),
      snap('s_wealth', '2026-09-05', '2026-09-05T02:00:00.000Z', { concern_id: 'wealth', access_source: 'topic-product' }),
      snap('s_career', '2026-09-05', '2026-09-05T03:00:00.000Z', { concern_id: 'career' }),
    ],
    product_entitlements: [{ id: 'mp', user_id: 'u1', product_id: 'money-pattern', created_at: '2026-07-01T00:00:00.000Z' }],
  });
  await lock(db);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s_wealth'], '일(work-flow)은 안 샀으니 career 는 잠긴다');

  // 레거시 전 구매(credit_transactions taste_product) — 앱 게이트(getTasteProductEntitlement 2순위)가 여는 주제는 근거다.
  const legacy = lockDb({
    credit_transactions: [
      memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05'),
      { id: 'wf', user_id: 'u1', type: 'purchase', feature: 'taste_product', created_at: '2026-06-01T00:00:00.000Z', metadata: { kind: 'taste_product', productId: 'work-flow', scopeKey: null } },
      { id: 'mp_u2', user_id: 'u2', type: 'purchase', feature: 'taste_product', created_at: '2026-06-01T00:00:00.000Z', metadata: { kind: 'taste_product', productId: 'money-pattern', scopeKey: null } },
    ],
    today_fortune_result_snapshots: [
      snap('s_general', '2026-09-05', '2026-09-05T01:00:00.000Z'),
      snap('s_wealth', '2026-09-05', '2026-09-05T02:00:00.000Z', { concern_id: 'wealth' }),
      snap('s_career', '2026-09-05', '2026-09-05T03:00:00.000Z', { concern_id: 'career', access_source: 'topic-product' }),
    ],
  });
  await lock(legacy);
  assert.deepEqual(ids(legacy.tables.today_fortune_result_snapshots), ['s_career'], '다른 사용자의 레거시 구매는 근거가 아니다');
});

test('lockMembershipContentForRefund — 표에 무효된 이 주문 기간이 없으면(086 이전 지급·환불 연산 실패) 지우지 않고 사유를 감사행으로 · 사용자 없으면 던진다', async () => {
  const live = { ...refundedRow(''), voided_at: null, void_reason: null };
  const otherOrder = { ...refundedRow(LOCK_NOW.toISOString()), order_id: 'ord_x' };
  for (const periods of [[], [live], [otherOrder]]) {
    const db = fakeDb({ membership_periods: periods, credit_transactions: [memberDetail('x', '2026-09-05T00:00:00.000Z', '2026-09-05')] });
    assert.deepEqual(await lock(db, { paymentKey: 'pk' }), { accessDeleted: 0, snapshotsDeleted: 0 });
    assert.deepEqual(db.calls.filter((c) => c.op === 'delete'), []);
    assert.deepEqual(ids(db.tables.credit_transactions), ['x']);
    assert.deepEqual(audits(db), [
      { kind: 'membership_content_lock_skipped', skipReason: 'no_refunded_period', orderId: 'ord_m', reason: 'r', actor: null, paymentKey: 'pk', lockedAt: LOCK_NOW.toISOString() },
    ]);
  }
  // 관리자 해제로 무효된 미래 기간(voided_at < start) — 창이 비어 잠글 게 없다.
  const future = fakeDb({ membership_periods: [{ ...refundedRow('2026-08-20T00:00:00.000Z'), void_reason: 'admin_revoke' }], credit_transactions: [mcal('x', '2026-09-05T00:00:00.000Z')] });
  await lock(future);
  assert.equal(audits(future)[0].skipReason, 'no_elapsed_window');
  assert.deepEqual(ids(future.tables.credit_transactions), ['x']);
  await assert.rejects(lockMembershipContentForRefund('', 'ord_m', { reason: 'r' }, fakeDb({}).client));
});

test('lockMembershipContentForRefund — DB 오류는 던진다(호출부가 주문에 흔적)', async () => {
  for (const table of ['membership_periods', 'credit_transactions', 'today_fortune_result_snapshots', 'product_entitlements', 'credit_transactions:delete', 'credit_transactions:insert']) {
    const db = lockDb({ credit_transactions: [memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05')] }, LOCK_NOW.toISOString(), table);
    await assert.rejects(lock(db), /boom/, table);
  }
});

// 설계 5번 — 감사 먼저(write-ahead): 지울 식별자를 감사행으로 먼저 남기고 지운다. 어디서 끊겨도 식별자가 남고, 재실행은 표로 같은 창을 계산한다.
test('감사 먼저 + 부분 실패 재실행 — 감사 실패면 아무것도 안 지우고, 스냅샷·열람 행 삭제 실패 뒤 재실행은 한 번에 성공한 것과 같은 끝 상태', async () => {
  const fresh = () => ({
    credit_transactions: [
      memberDetail('d5', '2026-09-05T01:00:00.000Z', '2026-09-05'),
      mcal('cal', '2026-09-03T00:00:00.000Z'),
      use('coupon6', 'u1', 'detail_report', '2026-09-06T05:00:00.000Z', { dayKey: '2026-09-06' }),
    ],
    today_fortune_result_snapshots: [snap('s5', '2026-09-05', '2026-09-05T01:00:00.000Z'), snap('s6', '2026-09-06', '2026-09-06T01:00:00.000Z')],
  });
  const clean = lockDb(fresh());
  assert.deepEqual(await lock(clean), { accessDeleted: 2, snapshotsDeleted: 1 });
  const want = { access: ids(clean.tables.credit_transactions), snapshots: ids(clean.tables.today_fortune_result_snapshots) };
  assert.deepEqual(want, { access: ['coupon6'], snapshots: ['s6'] });
  const order = clean.calls.filter((c) => ['insert', 'delete'].includes(c.op)).map((c) => `${c.table}:${c.op}`);
  assert.deepEqual(order, ['credit_transactions:insert', 'today_fortune_result_snapshots:delete', 'credit_transactions:delete'], '감사 → 스냅샷 → 열람 행');

  const auditFailed = lockDb(fresh(), LOCK_NOW.toISOString(), 'credit_transactions:insert');
  await assert.rejects(lock(auditFailed), /boom/);
  assert.deepEqual(auditFailed.calls.filter((c) => c.op === 'delete'), [], '감사를 못 남기면 지우지 않는다');

  for (const failOn of ['today_fortune_result_snapshots:delete', 'credit_transactions:delete']) {
    const broken = lockDb(fresh(), LOCK_NOW.toISOString(), failOn);
    await assert.rejects(lock(broken), /boom/, failOn);
    assert.equal(audits(broken)[0].kind, 'membership_content_locked', `${failOn} — 식별자는 이미 남았다`);
    assert.deepEqual((audits(broken)[0].snapshots as Row[]).map((s) => s.id), ['s5']);
    assert.ok(ids(broken.tables.credit_transactions).includes('d5'), `${failOn} — 열람 행이 남아 재실행이 잠글 날을 다시 구한다`);
    const retry = fakeDb(broken.tables);
    await lock(retry);
    assert.deepEqual({ access: ids(broken.tables.credit_transactions), snapshots: ids(broken.tables.today_fortune_result_snapshots) }, want, failOn);
  }
});

// 재리뷰: 근거 조회가 사용자 상세 이력 전체를 정렬·limit 없이 1회 읽었다(PostgREST 1000행 절단 → 근거 누락 = 산 날 스냅샷 삭제).
test('다른 근거 조회 — 잠글 날 범위(KST)로 좁히고 1000행 넘으면 정렬된 페이지를 넘겨 읽는다', async () => {
  // 09-05(KST) 에 쿠폰 상세 1000행 — created_at 정렬상 첫 페이지를 꽉 채운다. 09-06 근거(전 결제)는 1001번째.
  const filler = Array.from({ length: 1000 }, (_, i) =>
    use(`c${String(i).padStart(4, '0')}`, 'u1', 'detail_report', new Date(Date.parse('2026-09-05T02:00:00.000Z') + i * 1000).toISOString(), { dayKey: '2026-09-05' })
  );
  const db = lockDb({
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
  });
  await lock(db);
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), ['s5', 's6'], '09-06 근거는 두 번째 페이지에 있다');
  const evidence = db.calls.filter((c) => c.table === 'credit_transactions' && ['gte', 'lt', 'range'].includes(c.op));
  assert.ok(evidence.some((c) => c.op === 'gte' && (c.args as string[])[1] === '2026-09-04T15:00:00.000Z'), '첫 잠글 날(09-05 KST) 0시부터');
  assert.ok(evidence.some((c) => c.op === 'lt' && (c.args as string[])[1] === '2026-09-07T15:00:00.000Z'), '마지막 잠글 날(09-07 KST) 끝까지');
  assert.deepEqual(
    evidence.filter((c) => c.op === 'range').map((c) => c.args),
    [
      [0, 999], // ① 창 안 멤버십 열람 행(3행 — 1페이지)
      [0, 999], // 근거 1페이지(꽉 참)
      [1000, 1999],
    ]
  );
});

// 리뷰(과소): ①(창 안 멤버십 열람 행)도 range 없이 읽으면 1000행에서 잘려 나머지는 영구히 안 잠긴다(재실행도 같은 1000행만 본다).
test('잠금 ① — 창 안 멤버십 열람 행이 1000행을 넘어도 정렬된 페이지로 전부 지운다', async () => {
  const many = Array.from({ length: 1205 }, (_, i) => mcal(`m${String(i).padStart(4, '0')}`, new Date(Date.parse(P.start) + i * 60_000).toISOString()));
  const db = lockDb({ credit_transactions: many });
  assert.deepEqual(await lock(db), { accessDeleted: 1205, snapshotsDeleted: 0 });
  assert.deepEqual(ids(db.tables.credit_transactions), []);
});

// ── 훅 실행 — 원장 전이 함수를 가짜 DB 로 실제로 돌린다(실제 시각 기준 — 창은 지금 전후로 잡는다).
//   dispatchGaRefund·운영 메일은 VERCEL_ENV=production 이 아니면 DB·네트워크 전에 돌아간다(여기선 항상 그렇다 — 아래 가드).
const kstDay = (value: string) => new Date(Date.parse(value) + 9 * 3_600_000).toISOString().slice(0, 10);
function hookDb(options: { ledger?: boolean; fulfilled?: boolean; failOn?: string[] } = {}) {
  const base = Date.now();
  const at = (days: number) => new Date(base + days * DAY).toISOString();
  const viewAt = at(-5);
  const period = (id: string, orderId: string, start: string, end: string) => ({ id, user_id: 'u1', source: 'payment', order_id: orderId, start_at: start, end_at: end, voided_at: null, void_reason: null });
  const ledger = options.ledger !== false;
  const db = fakeDb(
    {
      payment_orders: [
        { order_id: 'ord_m', user_id: 'u1', package_id: 'membership_premium', status: 'fulfilled', amount: 49000, payment_key: 'pk_m', metadata: {}, fulfilled_at: options.fulfilled === false ? null : at(-10) },
      ],
      subscriptions: [{ user_id: 'u1', status: 'active', renews_at: ledger ? at(50) : at(20) }],
      membership_periods: ledger
        ? [period('p_m', 'ord_m', at(-10), at(20)), period('p_b', 'ord_b', at(20), at(50))]
        : [{ id: 'l', user_id: 'u1', source: 'legacy', order_id: null, start_at: at(-10), end_at: at(20), voided_at: null, void_reason: null }],
      credit_transactions: [memberDetail('d_m', viewAt, kstDay(viewAt))],
      today_fortune_result_snapshots: [snap('s_m', kstDay(viewAt), viewAt)],
      product_entitlements: [],
    },
    options.failOn ?? []
  );
  return { db, at };
}
const input = { orderId: 'ord_m', reason: 'admin_refund', source: 'admin-refund' as const };

test('markPaymentOrderRefunded 실행 — 전액이면 원장(무효·당기기·구독) + 잠금 · partial 이면 둘 다 안 함 · 멱등 재호출은 다시 하지 않음', async () => {
  assert.notEqual(process.env.VERCEL_ENV, 'production', 'GA refund·운영 메일이 네트워크를 타지 않는 전제');
  const { db } = hookDb();
  await markPaymentOrderRefunded(input, db.client);
  const after = Date.now();
  const byId = Object.fromEntries(db.tables.membership_periods.map((r) => [r.id, r]));
  assert.equal(db.tables.payment_orders[0].status, 'refunded');
  assert.equal(byId.p_m.void_reason, 'refund');
  assert.ok(Math.abs(Date.parse(String(byId.p_b.start_at)) - after) < 5000, '뒤 결제가 환불 시각으로 당겨진다');
  assert.equal(Date.parse(String(byId.p_b.end_at)) - Date.parse(String(byId.p_b.start_at)), 30 * DAY);
  assert.equal(db.tables.subscriptions[0].renews_at, byId.p_b.end_at, '구독 끝 = 살아 있는 끝');
  assert.deepEqual(ids(db.tables.credit_transactions), [], '멤버십 열람 행 잠금');
  assert.deepEqual(ids(db.tables.today_fortune_result_snapshots), [], '멤버십만인 날 스냅샷 잠금');
  assert.deepEqual(audits(db).map((m) => [m.kind, m.paymentKey, m.orderId]), [['membership_content_locked', 'pk_m', 'ord_m']]);
  assert.equal(db.tables.payment_orders[0].last_error, 'admin_refund', '실패 없으면 환불 사유 그대로');

  // 멱등: 이미 refunded — 사이에 새로 생긴 멤버십 행이 있어도 다시 잠그지 않고 두 번 당기지 않는다.
  const renewsAt = db.tables.subscriptions[0].renews_at;
  db.tables.credit_transactions.push(memberDetail('d_new', new Date().toISOString(), kstDay(new Date().toISOString())));
  assert.equal((await markPaymentOrderRefunded(input, db.client)).orderId, 'ord_m', '기존 행을 돌려준다');
  assert.deepEqual(ids(db.tables.credit_transactions), ['d_new']);
  assert.equal(audits(db).length, 1);
  assert.equal(db.tables.subscriptions[0].renews_at, renewsAt);

  const partial = hookDb().db;
  await markPaymentOrderRefunded({ ...input, partial: true }, partial.client);
  assert.equal(partial.tables.payment_orders[0].status, 'refunded');
  assert.deepEqual(ids(partial.tables.credit_transactions), ['d_m'], '부분환불은 잠그지 않는다(B단계)');
  assert.equal(partial.inserted.length, 0);
  assert.ok(partial.tables.membership_periods.every((r) => r.voided_at == null), '부분환불은 기간·구독 유지');
});

// #820 일수 차감 폴백은 삭제 — 표에 없는 주문의 구독을 추정으로 깎지 않고 드러낸다(086 적용~배포 사이 옛 코드 지급 등, 수동 차감).
test('markPaymentOrderRefunded 실행 — 표에 없는 지급 주문은 표·구독 무변경 + last_error membership_period_missing · 지급 안 된 주문은 경보 없음', async () => {
  const { db } = hookDb({ ledger: false });
  const before = JSON.stringify([db.tables.subscriptions, db.tables.membership_periods]);
  await markPaymentOrderRefunded(input, db.client);
  assert.equal(JSON.stringify([db.tables.subscriptions, db.tables.membership_periods]), before, '구독·표를 추정으로 깎지 않는다');
  assert.deepEqual(ids(db.tables.credit_transactions), ['d_m'], '창을 모르면 지우지 않는다');
  assert.equal(audits(db)[0].skipReason, 'no_refunded_period');
  assert.match(String(db.tables.payment_orders[0].last_error), /^admin_refund \| membership_period_missing: /);

  const unpaid = hookDb({ ledger: false, fulfilled: false }).db;
  const unpaidBefore = JSON.stringify([unpaid.tables.subscriptions, unpaid.tables.membership_periods]);
  await markPaymentOrderRefunded(input, unpaid.client);
  assert.equal(JSON.stringify([unpaid.tables.subscriptions, unpaid.tables.membership_periods]), unpaidBefore);
  assert.equal(unpaid.tables.payment_orders[0].last_error, 'admin_refund', '받은 적 없는 기간 — 경보 없음');
});

// 리뷰 M1: 해제로 무효된 옛 결제의 환불은 "표가 아는 주문"(무효 행 있음) — 경보도 차감도 없어야 한다.
test('markPaymentOrderRefunded 실행 — 해제 → 재구매 Q → 해제로 무효된 옛 결제 P 환불: Q·구독 active 유지 · membership_period_missing 없음', async () => {
  const { db, at } = hookDb();
  db.tables.membership_periods = [];
  db.tables.subscriptions = [];
  const op = (days: number) => ({ plan: PLAN, now: new Date(at(days)), service: db.client });
  await activateMembershipSubscription('u1', { ...op(-10), orderId: 'ord_o' });
  await activateMembershipSubscription('u1', { ...op(-9), orderId: 'ord_m' }); // P = O 뒤 미래 기간
  await expireMembershipNow('u1', { now: new Date(at(-5)), service: db.client }); // O 는 해제 시각에서 끝, P 무효(admin_revoke)
  await activateMembershipSubscription('u1', { ...op(-3), orderId: 'ord_q' });
  const before = JSON.stringify([db.tables.subscriptions, db.tables.membership_periods]);
  await markPaymentOrderRefunded(input, db.client);
  assert.equal(JSON.stringify([db.tables.subscriptions, db.tables.membership_periods]), before, 'Q 기간·구독 그대로');
  assert.deepEqual([db.tables.subscriptions[0].status, db.tables.subscriptions[0].renews_at], ['active', at(27)]);
  assert.equal(db.tables.payment_orders[0].last_error, 'admin_refund', '표가 아는 주문 — 경보 없음');
  assert.equal(audits(db)[0].skipReason, 'no_elapsed_window');
});

// 후처리 실패는 last_error 에 환불 사유 뒤로 이어 붙인다(덮지 않는다). 원장 실패를 '표에 없음'으로 겹쳐 적지 않는다.
test('markPaymentOrderRefunded 실행 — 원장·잠금 실패는 last_error 에 이어 붙여 흔적 · 원장 실패면 구독 무변경 · 감사 실패면 지우지 않음', async () => {
  const ledgerFailed = hookDb({ failOn: ['membership_periods'] }).db;
  const renewsAt = ledgerFailed.tables.subscriptions[0].renews_at;
  await markPaymentOrderRefunded(input, ledgerFailed.client);
  assert.equal(ledgerFailed.tables.payment_orders[0].last_error, 'admin_refund | membership_shorten_failed: boom | membership_lock_failed: boom');
  assert.equal(ledgerFailed.tables.payment_orders[0].status, 'refunded', '후처리 실패가 전이를 되돌리지 않는다');
  assert.equal(ledgerFailed.tables.subscriptions[0].renews_at, renewsAt, '원장 실패면 구독도 그대로');
  assert.deepEqual(ids(ledgerFailed.tables.credit_transactions), ['d_m']);

  const auditFailed = hookDb({ failOn: ['credit_transactions:insert'] }).db;
  await markPaymentOrderRefunded(input, auditFailed.client);
  assert.equal(auditFailed.tables.payment_orders[0].last_error, 'admin_refund | membership_lock_failed: boom');
  assert.deepEqual(ids(auditFailed.tables.credit_transactions), ['d_m'], '감사 먼저 — 못 남기면 안 지운다');
  assert.equal(auditFailed.tables.membership_periods.find((r) => r.id === 'p_m')?.void_reason, 'refund', '원장은 됐다');
});

// 지급·웹훅은 DB·PG 를 직접 불러 행동 테스트가 안 된다 — 호출 위치를 소스로 고정한다.
test('지급은 주문 id 로 원장 행을 만든다(#820 일수 기록 없음) · 웹훅은 부분취소·전 회수 구분', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  const fulfillment = read('payments/fulfillment.ts');
  assert.ok(
    /activateMembershipSubscription\(claimed\.userId, \{\s*plan: pkg\.subscriptionPlan,\s*days: MEMBERSHIP_PERIOD_DAYS,\s*orderId: claimed\.orderId,\s*\}\)/.test(fulfillment),
    '재시도 판정·환불이 이 주문 행을 찾는다'
  );
  assert.ok(!/membershipDaysGranted/.test(fulfillment + read('payments/order-ledger.ts')), '정본은 표 하나');
  const webhook = read('../app/api/payments/webhook/nicepay/route.ts');
  assert.ok(/partial: \/partial\/i\.test\(status\),/.test(webhook), '부분취소는 구독 유지(관리자 부분환불과 같은 결과)');
  assert.ok(/packageCredits: creditsToRevokeOnCancel\(pkg\),/.test(webhook));
});

test('멤버십 경로만 via 표식 — 레거시 전·쿠폰 0원 지급은 표식 없음(환불로 지우면 산 열람이 사라진다)', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
  const calendar = read('credits/calendar-access.ts');
  assert.ok(/if \(await getMemberTier\(userId\)\) \{\s*await recordFortuneCalendarMonthAccess\(userId, readingKey, year, month, 'membership'\);/.test(calendar));
  assert.equal((calendar.match(/'membership'\)/g) ?? []).length, 1);
  const detail = read('credits/detail-report-access.ts');
  assert.ok(/if \(await getMemberTier\(userId\)\) \{\s*await recordTodayFortunePremiumAccess\(userId, readingKey, sourceSessionId, dayKey, 'membership'\);/.test(detail));
  assert.equal((detail.match(/'membership'\)/g) ?? []).length, 1);
  assert.ok(/\.\.\.\(via \? \{ via \} : \{\}\)/.test(calendar) && /\.\.\.\(via \? \{ via \} : \{\}\)/.test(detail));
  const coupon = read('../app/api/coupons/kakao-friend/redeem/route.ts');
  assert.ok(/recordTodayFortunePremiumAccess\(user\.id, readingKey, sourceSessionId, todayKey\);/.test(coupon), '쿠폰 0원 지급은 표식 없음(환불 대상 아님)');
  const unlock = read('../app/api/today-fortune/unlock/route.ts');
  assert.ok(/accessSource: 'viaMembership' in access && access\.viaMembership \? 'membership' : responseAccess,/.test(unlock), '멤버십으로 만든 스냅샷 표식');
});
