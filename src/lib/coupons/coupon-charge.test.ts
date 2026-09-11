// 할인쿠폰 청구·귀속 흐름. 이 파일이 지키는 것은 **표시가 = 청구가** 와 요구 4·6·7 이다.
//
// 가짜 DB 는 eq/is/gt/lt 필터를 **실제로 적용**한다. 그래서 귀속 UPDATE 에서 CAS 조건
// (`bound_user_id is null` 등)을 하나라도 빠뜨리면 경합 테스트가 깨진다.
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  bindCouponClaim,
  COUPON_POOL_DEFAULTS,
  COUPON_SUBJECT_DAILY_LIMIT,
  resolveChargeForUser,
  type CouponViewer,
} from './coupon-charge';
import { STAGING_TEST_BATCH, type CouponEnv } from './discount-coupon';
import { createPaymentOrder } from '@/lib/payments/order-ledger';
import { getPackage, type PaymentPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

type Row = Record<string, unknown>;
type Filter = { op: 'eq' | 'is' | 'gt' | 'lt'; col: string; val: unknown };

const NOW = new Date('2026-09-11T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

interface FakeDb {
  client: SupabaseClient;
  coupons: Row[];
  tiers: Record<string, Row>;
  orders: Row[];
  inserted: Row[];
  updates: number;
  /** 081 consume_rate_counter 흉내 — `${bucket}|${period}` → 사용량. */
  counters: Map<string, number>;
  rpcCalls: number;
  /** 코드로 discount_coupons 를 조회한 횟수(= 오라클이 실제로 답한 횟수). */
  codeLookups: number;
  /** true 면 RPC 가 오류를 낸다(장애 흉내). */
  rpcDown?: boolean;
}

function cmp(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const ta = Date.parse(String(a));
  const tb = Date.parse(String(b));
  return ta - tb;
}

function matches(row: Row, filters: Filter[]) {
  return filters.every(({ op, col, val }) => {
    const v = row[col];
    if (op === 'eq') return v === val;
    if (op === 'is') return v == null && val === null;
    if (v == null) return false;
    return op === 'gt' ? cmp(v, val) > 0 : cmp(v, val) < 0;
  });
}

function fakeDb(seed: { coupons?: Row[]; orders?: Row[]; tiers?: Record<string, Row> } = {}): FakeDb {
  const db: FakeDb = {
    client: null as unknown as SupabaseClient,
    coupons: seed.coupons ?? [],
    orders: seed.orders ?? [],
    tiers: seed.tiers ?? {
      '10': { percent: 10, max_discount_won: null, disabled_at: null },
      '30': { percent: 30, max_discount_won: null, disabled_at: null },
      '50': { percent: 50, max_discount_won: null, disabled_at: null },
    },
    inserted: [],
    updates: 0,
    counters: new Map(),
    rpcCalls: 0,
    codeLookups: 0,
  };
  const withTier = (row: Row) => ({ ...row, coupon_tiers: db.tiers[String(row.tier)] ?? null });

  function builder(table: string) {
    const filters: Filter[] = [];
    let patch: Row | null = null;
    let insertRow: Row | null = null;
    const rowsOf = (): Row[] =>
      table === 'discount_coupons'
        ? db.coupons
        : table === 'rate_counters'
          ? Array.from(db.counters, ([key, used_count]) => {
              const [bucket, period_key] = key.split('|');
              return { bucket, period_key, used_count };
            })
          : db.orders;
    const run = (): { data: unknown; error: unknown } => {
      if (insertRow) {
        const row = { order_id: 'ord_test', ...insertRow };
        db.inserted.push(row);
        return { data: row, error: null };
      }
      const hits = rowsOf().filter((row) => matches(row, filters));
      if (table === 'discount_coupons' && !patch && filters.some((f) => f.op === 'eq' && f.col === 'code')) {
        db.codeLookups += 1;
      }
      if (patch) {
        db.updates += 1;
        // 부분 유니크 인덱스 discount_coupons_one_live_per_user 흉내(요구 6 은 DB 가 자른다):
        //   UPDATE 뒤 상태에서 (bound_user_id, released_at is null) 인 행이 한 사용자에 둘이면 거부.
        //   새 귀속뿐 아니라 released 되돌리기(보상)도 자리를 다시 차지하므로 **모든** UPDATE 뒤를 본다.
        if (table === 'discount_coupons') {
          const next = db.coupons.map((c) => (hits.includes(c) ? { ...c, ...patch } : c));
          const live = next.filter((c) => c.bound_user_id && !c.released_at).map((c) => c.bound_user_id);
          if (new Set(live).size !== live.length) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
        }
        for (const row of hits) Object.assign(row, patch);
      }
      return { data: table === 'discount_coupons' ? hits.map(withTier) : hits, error: null };
    };
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: (p: Row) => ((patch = p), chain),
      insert: (p: Row) => ((insertRow = p), chain),
      eq: (col: string, val: unknown) => (filters.push({ op: 'eq', col, val }), chain),
      is: (col: string, val: unknown) => (filters.push({ op: 'is', col, val }), chain),
      gt: (col: string, val: unknown) => (filters.push({ op: 'gt', col, val }), chain),
      lt: (col: string, val: unknown) => (filters.push({ op: 'lt', col, val }), chain),
      limit: () => chain,
      maybeSingle: () => {
        const { data, error } = run();
        return Promise.resolve({ data: Array.isArray(data) ? (data[0] ?? null) : data, error });
      },
      single: () => Promise.resolve(run()),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return chain;
  }

  // 081 consume_rate_counter 흉내: 한도 안이면 +1 한 값, 한도에 닿아 있으면 null.
  db.client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, params: { p_bucket: string; p_period_key: string; p_limit: number }) => {
      db.rpcCalls += 1;
      if (db.rpcDown) return Promise.resolve({ data: null, error: { message: 'rpc down' } });
      assert.equal(fn, 'consume_rate_counter');
      const key = `${params.p_bucket}|${params.p_period_key}`;
      const used = db.counters.get(key) ?? 0;
      if (params.p_limit <= 0 || used >= params.p_limit) return Promise.resolve({ data: null, error: null });
      db.counters.set(key, used + 1);
      return Promise.resolve({ data: used + 1, error: null });
    },
  } as unknown as SupabaseClient;
  return db;
}

function coupon(code: string, overrides: Row = {}): Row {
  return {
    code,
    tier: code.slice(5, 7),
    batch: '2026-09-강남전단',
    bound_user_id: null,
    bound_at: null,
    bound_percent: null,
    bound_max_discount_won: null,
    bound_origin: null,
    expires_at: '2027-12-31T14:59:59+00:00',
    disabled_at: null,
    released_at: null,
    ...overrides,
  };
}

const TODAY_DETAIL = getPackage('taste_today_detail')!; // 3,300
const opts = (db: FakeDb, env: CouponEnv = 'production') => ({ env, service: db.client, now: NOW });
const bind = (db: FakeDb, claim: NonNullable<Awaited<ReturnType<typeof resolveChargeForUser>>['claim']>, userId: string) =>
  bindCouponClaim(claim, userId, { origin: 'production', service: db.client, now: NOW });

test('coupon-charge — 전단 첫 사용: 입력한 코드로 미리보기하고 prepare 가 귀속한다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'GANJI-30-0001', opts(db));
  assert.equal(quote.listAmount, 3300);
  assert.equal(quote.chargeAmount, 2310, '3,300 × 30% = 990 할인');
  assert.equal(quote.couponCode, 'ganji300001');
  assert.equal(quote.reason, null);
  assert.equal(db.updates, 0, '미리보기는 쓰지 않는다');

  const bound = await bind(db, quote.claim!, 'u1');
  assert.deepEqual(bound, { code: 'ganji300001', percent: 30, maxDiscountWon: null });
  assert.equal(db.coupons[0].bound_user_id, 'u1');
  assert.equal(db.coupons[0].bound_percent, 30, '귀속 순간 요율 스냅샷');
  assert.equal(db.coupons[0].bound_origin, 'production');
});

// 🔴 표시가 = 청구가. 화면 금액과 createPaymentOrder 가 넣는 amount 가 한 원이라도 다르면
//   confirm:66 / nicepay-return:216 대조에서 거부되거나 다른 금액이 청구된다.
test('coupon-charge — 화면 금액(quote.chargeAmount) = createPaymentOrder 의 order.amount', async () => {
  for (const [pkgId, tier] of [
    ['taste_today_detail', '30'],
    ['membership_premium', '50'],
    ['bundle_comprehensive', '10'],
    ['lifetime_report', '30'],
  ] as const) {
    const db = fakeDb({ coupons: [coupon(`ganji${tier}0001`)] });
    const pkg = getPackage(pkgId)!;
    const quote = await resolveChargeForUser(pkg, { id: 'u1' }, `ganji-${tier}-0001`, opts(db));
    const bound = await bind(db, quote.claim!, 'u1');
    await createPaymentOrder(
      {
        userId: 'u1',
        pkg,
        listAmount: quote.listAmount,
        coupon: bound,
        acceptedKinds: [],
        recordedPolicyVersionIds: [],
      },
      db.client
    );
    const inserted = db.inserted.at(-1)!;
    assert.equal(inserted.amount, quote.chargeAmount, `${pkgId} 화면 ≠ 청구`);
    assert.equal(inserted.discount_won, quote.discountWon, pkgId);
    assert.equal(inserted.coupon_code, `ganji${tier}0001`, pkgId);
  }
});

test('coupon-charge — 요구 7: 귀속된 계정은 코드를 다시 안 넣어도 여러 상품에 계속 할인된다', async () => {
  const db = fakeDb({
    coupons: [coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(90 * 24 * HOUR), bound_percent: 30 })],
  });
  for (const pkgId of ['taste_today_detail', 'taste_tarot_daily', 'membership_premium']) {
    const pkg = getPackage(pkgId)!;
    const quote = await resolveChargeForUser(pkg, { id: 'u1' }, null, opts(db));
    assert.equal(quote.couponCode, 'ganji300001', pkgId);
    assert.equal(quote.chargeAmount, pkg.price - Math.floor((pkg.price * 30) / 100), pkgId);
    assert.equal(quote.claim?.mode, 'self', pkgId);
    assert.ok(await bind(db, quote.claim!, 'u1'), pkgId);
  }
  assert.equal(db.updates, 0, '본인 재사용은 쓰지 않는다(스냅샷 보존)');
  assert.equal(db.rpcCalls, 0, '본인 코드는 조회 예산을 쓰지 않는다');
});

test('coupon-charge — 관리자가 요율을 내려도 이미 귀속된 고객은 스냅샷대로, 새 고객은 새 요율', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 30 }),
      coupon('ganji300002'),
    ],
  });
  db.tiers['30'].percent = 10; // 관리자가 30 → 10 으로 내림
  const old = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, null, opts(db));
  assert.equal(old.percent, 30);
  const fresh = await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, 'ganji-30-0002', opts(db));
  assert.equal(fresh.percent, 10, '코드 숫자(30)가 아니라 등급 정본(10)');
  assert.equal(fresh.chargeAmount, 2970);
});

test('coupon-charge — 요구 4: 동시에 두 명이 같은 코드를 넣어도 한 명만 귀속된다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  const q1 = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db));
  const q2 = await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, 'ganji-30-0001', opts(db));
  assert.equal(q1.claim?.mode, 'claim');
  assert.equal(q2.claim?.mode, 'claim', '둘 다 미리보기 시점엔 비어 있었다');
  assert.ok(await bind(db, q1.claim!, 'u1'));
  assert.equal(await bind(db, q2.claim!, 'u2'), null, '두 번째는 0행 → prepare 가 멈춘다');
  assert.equal(db.coupons[0].bound_user_id, 'u1');

  // 이후 u2 가 다시 오면 미리보기에서부터 거부된다.
  const again = await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, 'ganji-30-0001', opts(db));
  assert.equal(again.reason, 'bound_to_other');
  assert.equal(again.chargeAmount, 3300);
  assert.equal(again.claim, null);
});

test('coupon-charge — 24시간 미결제 회수: 결제 흔적이 없으면 다른 사람이 가져간다', async () => {
  const db = fakeDb({
    coupons: [coupon('ganji300001', { bound_user_id: 'bot', bound_at: ago(25 * HOUR), bound_percent: 30 })],
    orders: [
      { coupon_code: 'ganji300001', user_id: 'bot', status: 'expired', expires_at: ago(24 * HOUR) },
      // 결제창을 열었다 닫은 주문 — 45분 만료가 지났으니 크론이 아직 안 돌았어도 풀린다.
      { coupon_code: 'ganji300001', user_id: 'bot', status: 'prepared', expires_at: ago(HOUR) },
    ],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, 'ganji-30-0001', opts(db));
  assert.equal(quote.claim?.mode, 'reclaim');
  assert.equal(quote.claim?.holderUserId, 'bot');
  assert.ok(await bind(db, quote.claim!, 'u2'));
  assert.equal(db.coupons[0].bound_user_id, 'u2');
  assert.equal(db.coupons[0].bound_at, NOW.toISOString(), '회수하면 새 귀속 시각');
});

// 🔴 설계 §5-2 SQL 의 막는 상태 목록에 fulfilled 가 없었다 — 그대로면 이 테스트가 red.
test('coupon-charge — 결제를 마친 사람의 쿠폰은 24시간이 지나도 회수되지 않는다', async () => {
  for (const status of ['fulfilled', 'refunded', 'in_progress']) {
    const db = fakeDb({
      coupons: [coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(30 * 24 * HOUR), bound_percent: 30 })],
      orders: [{ coupon_code: 'ganji300001', user_id: 'u1', status, expires_at: ago(29 * 24 * HOUR) }],
    });
    const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, 'ganji-30-0001', opts(db));
    assert.equal(quote.reason, 'bound_to_other', status);
    assert.equal(quote.chargeAmount, 3300, status);
  }
});

test('coupon-charge — 회수 CAS: 미리보기 뒤 24시간 조건이 깨지면(관리자 재귀속 등) 가져가지 못한다', async () => {
  const db = fakeDb({
    coupons: [coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(25 * HOUR), bound_percent: 30 })],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, 'ganji-30-0001', opts(db));
  assert.equal(quote.claim?.mode, 'reclaim');
  db.coupons[0].bound_at = ago(HOUR); // 그 사이 관리자 재귀속 등으로 24h 조건이 깨짐
  assert.equal(await bind(db, quote.claim!, 'u2'), null);
  assert.equal(db.coupons[0].bound_user_id, 'u1');
});

test('coupon-charge — 요구 6: **살아 있는** 쿠폰이 있는 계정이 다른 코드를 넣으면 거부하고 기존 쿠폰을 계속 적용', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji100001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 10 }),
      coupon('ganji500002'),
    ],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-50-0002', opts(db));
  assert.equal(quote.reason, 'account_has_other');
  assert.equal(quote.couponCode, 'ganji100001', '넣은 50% 가 아니라 등록된 10%');
  assert.equal(quote.chargeAmount, 2970);
  assert.equal(db.rpcCalls + db.codeLookups, 0, '예산도 조회도 쓰지 않는다');
  assert.equal(db.coupons[1].bound_user_id, null);
});

test('coupon-charge — 요구 6: 다른 탭에서 방금 다른 코드를 귀속했으면 DB 유니크가 막는다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001'), coupon('ganji300002')] });
  const q1 = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db));
  const q2 = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db));
  assert.ok(await bind(db, q1.claim!, 'u1'));
  assert.equal(await bind(db, q2.claim!, 'u1'), null, '23505 → null');
  assert.equal(db.coupons[1].bound_user_id, null);
});

test('coupon-charge — 등록된 쿠폰이 만료·회수되면 할인 없이 정가(이유는 보여 준다)', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', {
        bound_user_id: 'u1',
        bound_at: ago(HOUR),
        bound_percent: 30,
        expires_at: ago(1000),
      }),
    ],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, null, opts(db));
  assert.equal(quote.chargeAmount, 3300);
  assert.equal(quote.reason, 'expired');
  assert.equal(quote.claim, null);
});

test('coupon-charge — staging 호스트에서는 staging-test 배치만, 운영에서는 그 배치를 거부', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001'), coupon('ganji300002', { batch: STAGING_TEST_BATCH })] });
  // 환경이 안 맞는 코드는 **없는 코드와 같은 답** — 만료 문구·응답 시간으로 존재가 새지 않게(리뷰 발견).
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db, 'test'))).reason, 'not_found');
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db, 'production'))).reason, 'not_found');
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db, 'test'))).chargeAmount, 2310);
  // 환경을 모르는 호스트(프리뷰·*.vercel.app 별칭)는 둘 다 거부.
  for (const code of ['ganji-30-0001', 'ganji-30-0002']) {
    assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, code, opts(db, null))).reason, 'env_mismatch', code);
  }
});

test('coupon-charge — 전(재화) 상품은 할인하지 않고, 코드를 조회·귀속하지도 않는다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji500001')] });
  const quote = await resolveChargeForUser(getPackage('taste_dialogue_entry')!, { id: 'u1' }, 'ganji-50-0001', opts(db));
  assert.equal(quote.reason, 'not_eligible');
  assert.equal(quote.chargeAmount, quote.listAmount);
  assert.equal(quote.claim, null);
  assert.equal(db.rpcCalls + db.codeLookups, 0);
});

test('coupon-charge — 비로그인은 DB 를 전혀 건드리지 않는다(익명 추측 창구 없음)', async () => {
  const untouchable = new Proxy({}, {
    get() {
      throw new Error('비로그인 경로가 DB 를 조회했다');
    },
  }) as SupabaseClient;
  const quote = await resolveChargeForUser(TODAY_DETAIL, null, 'ganji-30-0001', {
    env: 'production',
    service: untouchable,
    now: NOW,
  });
  assert.equal(quote.chargeAmount, 3300);
  assert.equal(quote.reason, null);
});

test('coupon-charge — 쿠폰 없는 일반 결제는 종전과 같다(할인 0 · 추측 시도 0 · 쓰기 0)', async () => {
  const db = fakeDb();
  const pkg = getPackage('taste_tarot_daily') as PaymentPackage;
  const quote = await resolveChargeForUser(pkg, { id: 'u1' }, null, opts(db));
  assert.deepEqual(
    { list: quote.listAmount, charge: quote.chargeAmount, code: quote.couponCode, reason: quote.reason },
    { list: pkg.price, charge: pkg.price, code: null, reason: null }
  );
  assert.equal(db.rpcCalls + db.updates, 0);
});

// ─────────────────────────────────────────────────────────────
// 요구 6 = "동시에 1개" (2026-09-11 사용자 결정, migration 080)
// ─────────────────────────────────────────────────────────────

// 🔴 079 는 죽은 쿠폰도 자리를 차지해, "소진된 배치를 끄고 재발행" 하면 끈 배치의 정상 고객이
//   재발행 코드를 영구히 못 썼다(리뷰어 2명 독립 지목).
test('coupon-charge — 동시에 1개: 배치가 회수된 고객은 재발행 코드를 쓸 수 있다(옛 쿠폰은 자리에서 빠진다)', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(10 * 24 * HOUR), bound_percent: 30, disabled_at: ago(HOUR) }),
      coupon('ganji300777'),
    ],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0777', opts(db));
  assert.equal(quote.reason, null, '죽은 쿠폰은 account_has_other 로 막지 않는다');
  assert.equal(quote.chargeAmount, 2310);
  assert.equal(quote.claim?.releaseCode, 'ganji300001');
  assert.equal(db.updates, 0, '미리보기는 쓰지 않는다');

  assert.ok(await bind(db, quote.claim!, 'u1'));
  assert.equal(db.coupons[0].released_at, NOW.toISOString(), '옛 쿠폰은 released');
  assert.equal(db.coupons[0].bound_user_id, 'u1', '행을 지우거나 비우지 않는다(감사 증거)');
  assert.equal(db.coupons[1].bound_user_id, 'u1');

  // 이후 코드 없이 와도 새 쿠폰이 붙는다(귀속 조회가 released 를 뺀다).
  const later = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, null, opts(db));
  assert.equal(later.couponCode, 'ganji300777');
});

test('coupon-charge — 동시에 1개: 만료·등급 회수된 쿠폰도 새 코드로 바꿀 수 있다', async () => {
  for (const dead of [
    { expires_at: ago(1000) },
    { __tierDisabled: true },
  ]) {
    const db = fakeDb({
      coupons: [
        coupon('ganji500001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 50, ...(dead.expires_at ? { expires_at: dead.expires_at } : {}) }),
        coupon('ganji300002'),
      ],
    });
    if (dead.__tierDisabled) db.tiers['50'].disabled_at = ago(HOUR);
    const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db));
    assert.equal(quote.claim?.releaseCode, 'ganji500001', JSON.stringify(dead));
    assert.ok(await bind(db, quote.claim!, 'u1'), JSON.stringify(dead));
    assert.equal(db.coupons[1].bound_user_id, 'u1');
  }
});

test('coupon-charge — 동시에 1개: released 는 종료 상태 — 관리자가 되살려도 누구도 못 쓴다', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(30 * 24 * HOUR), bound_percent: 30, released_at: ago(HOUR) }),
      coupon('ganji100002', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 10 }),
    ],
  });
  // 원래 주인: 지금 쿠폰(10%)이 살아 있으니 그걸 쓴다. 코드 없이 와도 released 행이 아니라 새 행이 붙는다.
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, null, opts(db))).couponCode, 'ganji100002');
  // 남: 결제 흔적 없는 24h+ 귀속이지만 released 라 회수 대상도 아니다(전단 코드 부활 금지 — 요구 4).
  const other = await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, 'ganji-30-0001', opts(db));
  assert.equal(other.reason, 'disabled');
  assert.equal(other.claim, null);
  // CAS 도 released 행을 건드리지 않는다(판정을 우회해도 DB 조건이 막는다).
  assert.equal(
    await bind(db, { code: 'ganji300001', mode: 'reclaim', percent: 30, maxDiscountWon: null, holderUserId: 'u1', releaseCode: null }, 'u2'),
    null
  );
});

test('coupon-charge — 동시에 1개: 살아 있는 쿠폰은 여전히 자리를 지킨다(두 탭 경합도 DB 가 한 건만)', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 30, expires_at: ago(1000) }),
      coupon('ganji300002'),
      coupon('ganji300003'),
    ],
  });
  const tabA = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db));
  const tabB = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0003', opts(db));
  assert.ok(await bind(db, tabA.claim!, 'u1'));
  assert.equal(await bind(db, tabB.claim!, 'u1'), null, '옛 쿠폰은 이미 빠졌고, 새 쿠폰이 자리를 차지 → 23505');
  assert.equal(db.coupons[2].bound_user_id, null);
  // 이제 살아 있는 쿠폰(0002)이 있으니 다른 코드는 account_has_other.
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0003', opts(db))).reason, 'account_has_other');
});

// staging 에서 실물 쿠폰을 '죽었다' 고 보고 released 를 찍으면 staging 이 프로덕션 고객의 쿠폰을 지운다(같은 DB).
test('coupon-charge — 동시에 1개: 환경이 안 맞는 (살아 있는) 쿠폰은 죽은 게 아니다 — 자리를 비우지 않는다', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 30 }), // 실물
      coupon('ganji300002', { batch: STAGING_TEST_BATCH }),
    ],
  });
  const onStaging = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db, 'test'));
  assert.equal(onStaging.reason, 'account_has_other');
  assert.equal(onStaging.claim, null);
  assert.equal(db.coupons[0].released_at, null);
});

// 🔴 리뷰 발견(2026-09-11): 위 테스트는 **살아 있는** 실물 쿠폰만 시드해, 죽은 실물 쿠폰을 staging 이 비우는
//   경로를 못 봤다(거짓 green). 죽은 실물 쿠폰도 staging 은 건드리면 안 된다.
test('coupon-charge — 동시에 1개: staging 은 **죽은 실물** 쿠폰도 비우지 않는다(staging-test 행만)', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 30, disabled_at: ago(HOUR) }), // 죽은 실물
      coupon('ganji300002', { batch: STAGING_TEST_BATCH }),
    ],
  });
  const onStaging = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db, 'test'));
  assert.equal(onStaging.reason, 'account_has_other');
  assert.equal(onStaging.claim, null);
  assert.equal(db.coupons[0].released_at, null, '프로덕션 행이 종료 상태가 되면 안 된다');

  // 반대로 운영은 죽은 staging-test 쿠폰을 비울 수 있다(테스트 쿠폰이 실계정 자리를 영구 점유하지 않게).
  const prod = fakeDb({
    coupons: [
      coupon('ganji300009', { batch: STAGING_TEST_BATCH, bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 30, expires_at: ago(1000) }),
      coupon('ganji300010'),
    ],
  });
  const q = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0010', opts(prod, 'production'));
  assert.equal(q.claim?.releaseCode, 'ganji300009');
  assert.ok(await bind(prod, q.claim!, 'u1'));
});

// 🔴 리뷰 발견(2026-09-11): release 와 새 귀속은 원자적이지 않다. 새 귀속이 경합에서 지면 옛 쿠폰을 되돌려야 한다
//   — "죽음"은 일시적일 수 있다(관리자가 배치를 되살림). 안 되돌리면 되살아났을 본인 쿠폰(요구 7)을 영구히 잃는다.
test('coupon-charge — 동시에 1개: 새 귀속이 경합에서 지면 옛 쿠폰을 되돌린다(되살리면 다시 쓴다)', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(10 * 24 * HOUR), bound_percent: 30, disabled_at: ago(HOUR) }),
      coupon('ganji300777'),
    ],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0777', opts(db));
  assert.equal(quote.claim?.releaseCode, 'ganji300001');
  // 그 사이 다른 사람이 0777 을 먼저 귀속.
  Object.assign(db.coupons[1], { bound_user_id: 'u2', bound_at: NOW.toISOString(), bound_percent: 30 });

  assert.equal(await bind(db, quote.claim!, 'u1'), null, '새 귀속 실패 → prepare 는 멈춘다');
  assert.equal(db.coupons[0].released_at, null, '옛 쿠폰은 자리로 돌아온다');

  // 관리자가 배치를 되살리면 원래 쿠폰이 다시 붙는다.
  db.coupons[0].disabled_at = null;
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, null, opts(db))).couponCode, 'ganji300001');
});

// ─────────────────────────────────────────────────────────────
// S2 — 새 코드 조회 예산(081 rate_counters · docs/coupon-lookup-cap-proposal.md)
// ─────────────────────────────────────────────────────────────

const KAKAO = (id: string): CouponViewer['identities'] => [{ provider: 'kakao', id }];
const valid = (n: number) => `ganji-30-${String(n).padStart(4, '0')}`;
/** 무료 이메일 계정들로 open 풀을 다 태운다(주체당 한도 안에서 여러 계정). */
async function drainOpenPool(db: FakeDb, env: 'production' | 'test' = 'production') {
  let spent = 0;
  for (let acct = 0; spent < COUPON_POOL_DEFAULTS.open; acct += 1) {
    for (let i = 0; i < COUPON_SUBJECT_DAILY_LIMIT && spent < COUPON_POOL_DEFAULTS.open; i += 1, spent += 1) {
      await resolveChargeForUser(TODAY_DETAIL, { id: `bot${acct}` }, valid(9000 + spent), opts(db, env));
    }
  }
}

test('S2 — 주체(계정)당 하루 10회, 적중 포함 — 한도 뒤엔 맞는 코드든 아니든 **조회 없이** 같은 답', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  for (let i = 0; i < COUPON_SUBJECT_DAILY_LIMIT; i += 1) {
    await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, valid(100 + i), opts(db));
  }
  const lookupsBefore = db.codeLookups;
  const real = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db));
  const fake = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0002', opts(db));
  assert.equal(real.reason, 'rate_limited');
  assert.equal(fake.reason, 'rate_limited', '유효·무효가 같은 답이어야 오라클이 안 열린다');
  assert.equal(db.codeLookups, lookupsBefore, '한도 뒤엔 조회 자체를 하지 않는다');
  assert.equal(real.chargeAmount, 3300);
});

// 🔴 리뷰 발견(2026-09-11): 체크아웃은 탭·앱 복귀 때마다 헤더의 router.refresh() 로 다시 렌더된다.
//   매번 과금하면 결제 전에 앱을 오간 정상 고객이 코드 하나로 한도에 걸린다 → 같은 (주체, 코드)는 하루 1회만 과금.
test('S2 — 같은 코드는 렌더·복귀 재렌더·prepare 를 몇 번 거쳐도 하루 1회만 과금된다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  for (let i = 0; i < COUPON_SUBJECT_DAILY_LIMIT + 5; i += 1) {
    const q = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db));
    assert.equal(q.chargeAmount, 2310, `재렌더 ${i}`);
  }
  const prepare = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db));
  assert.ok(await bind(db, prepare.claim!, 'u1'));
  assert.equal(db.counters.get(`coupon:production:acct:u1|2026-09-11`), 1);
  assert.equal(db.counters.get(`coupon:production:pool:open|2026-09-11`), 1);
});

// 표시를 과금 **전에** 하면, 한도에 막힌 질문이 표시돼 같은 코드를 두 번째 물을 때 공짜로 답을 얻는다.
test('S2 — 한도에 막힌 질문은 "이미 본 코드"로 표시되지 않는다(두 번 물어 우회 불가)', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  for (let i = 0; i < COUPON_SUBJECT_DAILY_LIMIT; i += 1) {
    await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, valid(100 + i), opts(db));
  }
  const lookups = db.codeLookups;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db))).reason, 'rate_limited');
  }
  assert.equal(db.codeLookups, lookups, '막힌 뒤로는 몇 번을 물어도 조회하지 않는다');
});

// 🔴 풀이 하나면 무료 계정 몇 개로 전 고객이 막힌다(S1 의 약점). 등급을 나누면 피해가 무료 이메일 풀 안에 갇힌다.
test('S2 — 무료 계정으로 open 풀을 태워도 소셜·결제 고객은 막히지 않는다(DoS 격리)', async () => {
  const db = fakeDb({
    coupons: [coupon('ganji300001'), coupon('ganji300002'), coupon('ganji300003')],
    orders: [{ user_id: 'payer', status: 'fulfilled', amount: 3300, metadata: { origin: { env: 'production', host: 'ganjisaju.kr' } } }],
  });
  await drainOpenPool(db);
  const email = await resolveChargeForUser(TODAY_DETAIL, { id: 'fresh' }, 'ganji-30-0001', opts(db));
  assert.equal(email.reason, 'busy', 'open 풀 소진 — 이 사람 탓이 아니므로 rate_limited 와 다른 사유');
  const social = await resolveChargeForUser(TODAY_DETAIL, { id: 'k1', identities: KAKAO('777') }, 'ganji-30-0002', opts(db));
  assert.equal(social.chargeAmount, 2310);
  const paid = await resolveChargeForUser(TODAY_DETAIL, { id: 'payer' }, 'ganji-30-0003', opts(db));
  assert.equal(paid.chargeAmount, 2310);
});

// 🔴 user_metadata 는 사용자가 supabase.auth.updateUser({data}) 로 덮어쓴다 — 카카오를 사칭해도 등급이 오르면 안 된다.
test('S2 — user_metadata 로 카카오를 사칭해도 소셜 등급이 되지 않는다(identities[] 만 믿는다)', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  await drainOpenPool(db);
  const forged = { id: 'forger', user_metadata: { provider_id: '777', sub: '777' }, identities: [{ provider: 'email', id: 'forger' }] } as CouponViewer;
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, forged, 'ganji-30-0001', opts(db))).reason, 'busy');
});

test('S2 — 소셜 신원은 계정이 바뀌어도 같은 주체다(탈퇴·재가입으로 한도가 초기화되지 않는다)', async () => {
  const db = fakeDb();
  for (let i = 0; i < COUPON_SUBJECT_DAILY_LIMIT; i += 1) {
    await resolveChargeForUser(TODAY_DETAIL, { id: 'old-account', identities: KAKAO('777') }, valid(200 + i), opts(db));
  }
  const reborn = await resolveChargeForUser(TODAY_DETAIL, { id: 'new-account', identities: KAKAO('777') }, valid(300), opts(db));
  assert.equal(reborn.reason, 'rate_limited');
});

test('S2 — 결제 등급은 프로덕션 실결제만: staging 샌드박스·환불·0원 주문은 아니다', async () => {
  const cases: Array<[string, Record<string, unknown>, 'busy' | null]> = [
    ['prod', { status: 'fulfilled', amount: 3300, metadata: { origin: { env: 'production' } } }, null],
    ['legacy', { status: 'fulfilled', amount: 990, metadata: {} }, null], // 2026-08-29 이전(origin 없음)은 실매출 관례
    ['staging', { status: 'fulfilled', amount: 3300, metadata: { origin: { env: 'staging' } } }, 'busy'],
    // 리뷰 발견: 허용목록 밖 호스트로 들어온 새 주문은 origin 'unknown' — 매출 집계엔 남기지만 등급엔 못 쓴다
    ['unknown-host', { status: 'fulfilled', amount: 3300, metadata: { origin: { env: 'unknown', host: 'staging.ganjisaju.kr.' } } }, 'busy'],
    ['refunded', { status: 'refunded', amount: 3300, metadata: { origin: { env: 'production' } } }, 'busy'],
    ['prepared', { status: 'prepared', amount: 3300, metadata: { origin: { env: 'production' } } }, 'busy'],
  ];
  for (const [name, order, expected] of cases) {
    const db = fakeDb({ coupons: [coupon('ganji300001')], orders: [{ user_id: 'x', ...order }] });
    await drainOpenPool(db);
    const q = await resolveChargeForUser(TODAY_DETAIL, { id: 'x' }, 'ganji-30-0001', opts(db));
    assert.equal(q.reason, expected, name);
  }
});

test('S2 — staging(test) 예산은 프로덕션과 따로 센다(같은 DB)', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  await drainOpenPool(db, 'test');
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db))).chargeAmount, 2310);
});

test('S2 — 익명 로그인·환경 불명은 예산도 조회도 쓰지 않는다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  const anon = await resolveChargeForUser(TODAY_DETAIL, { id: 'a1', is_anonymous: true }, 'ganji-30-0001', opts(db));
  assert.equal(anon.chargeAmount, 3300);
  const preview = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db, null));
  assert.equal(preview.reason, 'env_mismatch');
  assert.equal(db.rpcCalls + db.codeLookups, 0);
});

// 🔴 실패-닫힘: 카운터가 죽으면 상한이 조용히 사라지는 게 아니라 새 코드 조회가 막힌다(PR3 의 fail-open 교훈).
test('S2 — 카운터 RPC 가 죽으면 새 코드 조회를 막는다 — 등록된 쿠폰·일반 결제는 그대로', async () => {
  const db = fakeDb({
    coupons: [coupon('ganji300001'), coupon('ganji300002', { bound_user_id: 'u2', bound_at: ago(HOUR), bound_percent: 30 })],
  });
  db.rpcDown = true;
  const probe = await resolveChargeForUser(TODAY_DETAIL, { id: 'u1' }, 'ganji-30-0001', opts(db));
  assert.equal(probe.reason, 'rate_limited');
  assert.equal(probe.chargeAmount, 3300, '정가 결제는 가능');
  assert.equal(db.codeLookups, 0);
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'u2' }, null, opts(db))).chargeAmount, 2310);
});

// 리뷰 발견: Number('') 가 0 이라, 운영자가 값을 비우면 기본값이 아니라 풀이 통째로 닫혔다.
test('S2 — COUPON_POOL_* 가 빈 값·공백이면 기본값, 0 을 명시할 때만 닫힌다', async () => {
  const saved = process.env.COUPON_POOL_OPEN;
  try {
    for (const [value, expectBusyAt] of [['', COUPON_POOL_DEFAULTS.open], [' \t', COUPON_POOL_DEFAULTS.open], ['0', 0]] as const) {
      process.env.COUPON_POOL_OPEN = value;
      const db = fakeDb({ coupons: [coupon('ganji300001')] });
      // 첫 조회가 예산을 통과하는지부터 본다 — 이걸 안 보면 처음부터 닫힌 풀도 통과한다(뮤테이션으로 확인한 구멍).
      const first = await resolveChargeForUser(TODAY_DETAIL, { id: 'p0' }, valid(4999), opts(db));
      assert.equal(first.reason, expectBusyAt > 0 ? 'not_found' : 'busy', `first ${JSON.stringify(value)}`);
      for (let n = 1; n < expectBusyAt; n += 1) {
        await resolveChargeForUser(TODAY_DETAIL, { id: `p${Math.floor(n / COUPON_SUBJECT_DAILY_LIMIT)}` }, valid(5000 + n), opts(db));
      }
      assert.equal((await resolveChargeForUser(TODAY_DETAIL, { id: 'last' }, 'ganji-30-0001', opts(db))).reason, 'busy', JSON.stringify(value));
    }
  } finally {
    if (saved === undefined) delete process.env.COUPON_POOL_OPEN;
    else process.env.COUPON_POOL_OPEN = saved;
  }
});
