// 할인쿠폰 청구·귀속 흐름. 이 파일이 지키는 것은 **표시가 = 청구가** 와 요구 4·6·7 이다.
//
// 가짜 DB 는 eq/is/gt/lt 필터를 **실제로 적용**한다. 그래서 귀속 UPDATE 에서 CAS 조건
// (`bound_user_id is null` 등)을 하나라도 빠뜨리면 경합 테스트가 깨진다.
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bindCouponClaim, COUPON_ATTEMPT_DAILY_LIMIT, resolveChargeForUser } from './coupon-charge';
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
  attempts: number;
}

function cmp(a: unknown, b: unknown) {
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
    attempts: 0,
  };
  const withTier = (row: Row) => ({ ...row, coupon_tiers: db.tiers[String(row.tier)] ?? null });

  function builder(table: string) {
    const filters: Filter[] = [];
    let patch: Row | null = null;
    let insertRow: Row | null = null;
    const rowsOf = () => (table === 'discount_coupons' ? db.coupons : db.orders);
    const run = (): { data: unknown; error: unknown } => {
      if (insertRow) {
        const row = { order_id: 'ord_test', ...insertRow };
        db.inserted.push(row);
        return { data: row, error: null };
      }
      const hits = rowsOf().filter((row) => matches(row, filters));
      if (patch) {
        db.updates += 1;
        // 부분 유니크 인덱스 discount_coupons_one_per_user 흉내(요구 6 은 DB 가 자른다).
        const nextOwner = patch.bound_user_id;
        if (nextOwner && db.coupons.some((c) => c.bound_user_id === nextOwner && !hits.includes(c))) {
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
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

  // 056 RPC 흉내: get = 현재 사용량, consume = 한도 내면 +1.
  db.client = {
    from: (table: string) => builder(table),
    rpc: (fn: string, params: { p_limit?: number }) => {
      if (fn === 'get_member_benefit_used') return Promise.resolve({ data: db.attempts, error: null });
      assert.equal(fn, 'consume_member_benefit');
      if (db.attempts >= (params.p_limit ?? 0)) return Promise.resolve({ data: false, error: null });
      db.attempts += 1;
      return Promise.resolve({ data: true, error: null });
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
    ...overrides,
  };
}

const TODAY_DETAIL = getPackage('taste_today_detail')!; // 3,300
const opts = (db: FakeDb, env: CouponEnv = 'production') => ({ env, service: db.client, now: NOW });
const bind = (db: FakeDb, claim: NonNullable<Awaited<ReturnType<typeof resolveChargeForUser>>['claim']>, userId: string) =>
  bindCouponClaim(claim, userId, { origin: 'production', service: db.client, now: NOW });

test('coupon-charge — 전단 첫 사용: 입력한 코드로 미리보기하고 prepare 가 귀속한다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  const quote = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'GANJI-30-0001', opts(db));
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
    const quote = await resolveChargeForUser(pkg, 'u1', `ganji-${tier}-0001`, opts(db));
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
    const quote = await resolveChargeForUser(pkg, 'u1', null, opts(db));
    assert.equal(quote.couponCode, 'ganji300001', pkgId);
    assert.equal(quote.chargeAmount, pkg.price - Math.floor((pkg.price * 30) / 100), pkgId);
    assert.equal(quote.claim?.mode, 'self', pkgId);
    assert.ok(await bind(db, quote.claim!, 'u1'), pkgId);
  }
  assert.equal(db.updates, 0, '본인 재사용은 쓰지 않는다(스냅샷 보존)');
  assert.equal(db.attempts, 0, '본인 코드는 추측 시도로 세지 않는다');
});

test('coupon-charge — 관리자가 요율을 내려도 이미 귀속된 고객은 스냅샷대로, 새 고객은 새 요율', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 30 }),
      coupon('ganji300002'),
    ],
  });
  db.tiers['30'].percent = 10; // 관리자가 30 → 10 으로 내림
  const old = await resolveChargeForUser(TODAY_DETAIL, 'u1', null, opts(db));
  assert.equal(old.percent, 30);
  const fresh = await resolveChargeForUser(TODAY_DETAIL, 'u2', 'ganji-30-0002', opts(db));
  assert.equal(fresh.percent, 10, '코드 숫자(30)가 아니라 등급 정본(10)');
  assert.equal(fresh.chargeAmount, 2970);
});

test('coupon-charge — 요구 4: 동시에 두 명이 같은 코드를 넣어도 한 명만 귀속된다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  const q1 = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0001', opts(db));
  const q2 = await resolveChargeForUser(TODAY_DETAIL, 'u2', 'ganji-30-0001', opts(db));
  assert.equal(q1.claim?.mode, 'claim');
  assert.equal(q2.claim?.mode, 'claim', '둘 다 미리보기 시점엔 비어 있었다');
  assert.ok(await bind(db, q1.claim!, 'u1'));
  assert.equal(await bind(db, q2.claim!, 'u2'), null, '두 번째는 0행 → prepare 가 멈춘다');
  assert.equal(db.coupons[0].bound_user_id, 'u1');

  // 이후 u2 가 다시 오면 미리보기에서부터 거부된다.
  const again = await resolveChargeForUser(TODAY_DETAIL, 'u2', 'ganji-30-0001', opts(db));
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
  const quote = await resolveChargeForUser(TODAY_DETAIL, 'u2', 'ganji-30-0001', opts(db));
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
    const quote = await resolveChargeForUser(TODAY_DETAIL, 'u2', 'ganji-30-0001', opts(db));
    assert.equal(quote.reason, 'bound_to_other', status);
    assert.equal(quote.chargeAmount, 3300, status);
  }
});

test('coupon-charge — 회수 CAS: 미리보기 뒤 24시간 조건이 깨지면(관리자 재귀속 등) 가져가지 못한다', async () => {
  const db = fakeDb({
    coupons: [coupon('ganji300001', { bound_user_id: 'u1', bound_at: ago(25 * HOUR), bound_percent: 30 })],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, 'u2', 'ganji-30-0001', opts(db));
  assert.equal(quote.claim?.mode, 'reclaim');
  db.coupons[0].bound_at = ago(HOUR); // 그 사이 관리자 재귀속 등으로 24h 조건이 깨짐
  assert.equal(await bind(db, quote.claim!, 'u2'), null);
  assert.equal(db.coupons[0].bound_user_id, 'u1');
});

test('coupon-charge — 요구 6: 쿠폰이 있는 계정이 다른 코드를 넣으면 거부하고 기존 쿠폰을 계속 적용', async () => {
  const db = fakeDb({
    coupons: [
      coupon('ganji100001', { bound_user_id: 'u1', bound_at: ago(HOUR), bound_percent: 10 }),
      coupon('ganji500002'),
    ],
  });
  const quote = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-50-0002', opts(db));
  assert.equal(quote.reason, 'account_has_other');
  assert.equal(quote.couponCode, 'ganji100001', '넣은 50% 가 아니라 등록된 10%');
  assert.equal(quote.chargeAmount, 2970);
  assert.equal(db.attempts, 0, '조회조차 하지 않는다');
  assert.equal(db.coupons[1].bound_user_id, null);
});

test('coupon-charge — 요구 6: 다른 탭에서 방금 다른 코드를 귀속했으면 DB 유니크가 막는다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001'), coupon('ganji300002')] });
  const q1 = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0001', opts(db));
  const q2 = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0002', opts(db));
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
  const quote = await resolveChargeForUser(TODAY_DETAIL, 'u1', null, opts(db));
  assert.equal(quote.chargeAmount, 3300);
  assert.equal(quote.reason, 'expired');
  assert.equal(quote.claim, null);
});

test('coupon-charge — staging 호스트에서는 staging-test 배치만, 운영에서는 그 배치를 거부', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001'), coupon('ganji300002', { batch: STAGING_TEST_BATCH })] });
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0001', opts(db, 'test'))).reason, 'env_mismatch');
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0002', opts(db, 'production'))).reason, 'env_mismatch');
  assert.equal((await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0002', opts(db, 'test'))).chargeAmount, 2310);
  // 환경을 모르는 호스트(프리뷰·*.vercel.app 별칭)는 둘 다 거부.
  for (const code of ['ganji-30-0001', 'ganji-30-0002']) {
    assert.equal((await resolveChargeForUser(TODAY_DETAIL, 'u1', code, opts(db, null))).reason, 'env_mismatch', code);
  }
});

test('coupon-charge — 전(재화) 상품은 할인하지 않고, 코드를 조회·귀속하지도 않는다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji500001')] });
  const quote = await resolveChargeForUser(getPackage('taste_dialogue_entry')!, 'u1', 'ganji-50-0001', opts(db));
  assert.equal(quote.reason, 'not_eligible');
  assert.equal(quote.chargeAmount, quote.listAmount);
  assert.equal(quote.claim, null);
  assert.equal(db.attempts, 0);
});

test('coupon-charge — 추측 시도는 **없는 코드만** 계정당 하루 한도로 센다', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300999')] });
  for (let i = 0; i < COUPON_ATTEMPT_DAILY_LIMIT; i += 1) {
    const q = await resolveChargeForUser(TODAY_DETAIL, 'u1', `ganji-30-${String(i).padStart(4, '0')}`, opts(db));
    assert.equal(q.reason, 'not_found');
  }
  assert.equal(db.attempts, COUPON_ATTEMPT_DAILY_LIMIT);
  const blocked = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0999', opts(db));
  assert.equal(blocked.reason, 'rate_limited', '진짜 코드여도 한도 뒤엔 안 알려 준다');
  assert.equal(blocked.chargeAmount, 3300);
  // 형식이 틀린 입력은 DB 를 안 보므로 세지 않는다.
  await resolveChargeForUser(TODAY_DETAIL, 'u2', 'hello', opts(db));
  assert.equal(db.attempts, COUPON_ATTEMPT_DAILY_LIMIT);
});

// 🔴 리뷰 발견(2026-09-11): 조회마다 세면 맞는 코드가 렌더 1 + prepare 1 로 두 번 차감돼,
//   한도 직전 고객이 "할인가를 보고 → 결제 버튼에서 rate_limited 409" 를 겪었다.
test('coupon-charge — 맞는 코드는 렌더·prepare 를 몇 번 거쳐도 차감하지 않는다(한도 직전 고객도 결제된다)', async () => {
  const db = fakeDb({ coupons: [coupon('ganji300001')] });
  db.attempts = COUPON_ATTEMPT_DAILY_LIMIT - 1; // 오늘 오타 9번
  const render = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0001', opts(db));
  const refresh = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0001', opts(db));
  const prepare = await resolveChargeForUser(TODAY_DETAIL, 'u1', 'ganji-30-0001', opts(db));
  for (const q of [render, refresh, prepare]) assert.equal(q.chargeAmount, 2310);
  assert.ok(await bind(db, prepare.claim!, 'u1'));
  assert.equal(db.attempts, COUPON_ATTEMPT_DAILY_LIMIT - 1, '맞는 코드는 차감 0');
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
  const quote = await resolveChargeForUser(pkg, 'u1', null, opts(db));
  assert.deepEqual(
    { list: quote.listAmount, charge: quote.chargeAmount, code: quote.couponCode, reason: quote.reason },
    { list: pkg.price, charge: pkg.price, code: null, reason: null }
  );
  assert.equal(db.attempts + db.updates, 0);
});
