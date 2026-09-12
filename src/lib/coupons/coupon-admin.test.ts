// 할인쿠폰 관리자 조작(PR6 — /admin/coupons). 이 파일이 지키는 것:
//   발급 코드가 인쇄물과 어긋나지 않는다(접두 = 등급) · 무작위 · 관리자 조작이 요구 4·6 과 080 종료 상태를 깨지 않는다 ·
//   staging·로컬(같은 DB)이 실물 쿠폰을 못 건드린다 · 코드 평문이 감사·오류·화면으로 새지 않는다.
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  adminCouponEnv,
  batchAllowedInEnv,
  COUPON_EXPIRY_MAX_DAYS,
  COUPON_ISSUE_MAX,
  COUPON_MIN_CAP_WON,
  couponBatchStats,
  couponCsv,
  couponCsvFileName,
  couponState,
  couponTierStats,
  exportCouponBatch,
  issueCouponBatch,
  kstEndOfDayIso,
  lookupCouponHolder,
  recordCouponAudit,
  releaseCouponsOfUser,
  releaseHeldCoupon,
  restoreCouponBatch,
  revokeCouponBatch,
  setCouponBatchExpiry,
  setCouponTierDisabled,
  updateCouponTier,
  maskCouponCode,
  normalizeBatchName,
  pickSerials,
  scrubCouponCodes,
  validateIssueInput,
  validateTierInput,
  type AdminCouponOrder,
  type AdminCouponRow,
  type AdminTierRow,
} from './coupon-admin';
import { STAGING_TEST_BATCH } from './discount-coupon';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const CODE_RE = /ganji[\s\-_]*(10|20|30|40|50)[\s\-_]*\d{4}/i;

test('kstEndOfDayIso — KST 그날 23:59:59 = 079 기본값과 같은 순간, 없는 날짜는 null', () => {
  assert.equal(kstEndOfDayIso('2027-12-31'), '2027-12-31T14:59:59.000Z');
  assert.equal(new Date(kstEndOfDayIso('2027-12-31')!).getTime(), Date.parse('2027-12-31T14:59:59+00:00'));
  assert.equal(kstEndOfDayIso('2027-02-30'), null);
  assert.equal(kstEndOfDayIso('2027-1-5'), null);
  assert.equal(kstEndOfDayIso(''), null);
});

test('pickSerials — 이미 쓴 번호를 빼고, 겹치지 않게, 4자리로 뽑는다', () => {
  const taken = new Set(['0000', '0001', '0003']);
  // 주입한 난수를 쓴다(항상 0 → 남은 것 중 앞에서부터). 기본 난수가 아니라 이 인자를 쓴다는 증거.
  assert.deepEqual(pickSerials(3, taken, () => 0), ['0002', '0004', '0005']);
  const many = pickSerials(500, taken, randomInt);
  assert.equal(new Set(many).size, 500, '중복 없음');
  assert.ok(many.every((s) => /^\d{4}$/.test(s) && !taken.has(s)));
});

test('pickSerials — 남은 번호보다 많이 달라면 거부한다(조용히 덜 뽑지 않는다)', () => {
  const taken = new Set(Array.from({ length: 9_998 }, (_, i) => String(i).padStart(4, '0')));
  assert.deepEqual(pickSerials(2, taken, () => 0).sort(), ['9998', '9999']);
  assert.throws(() => pickSerials(3, taken, () => 0), /남은 번호/);
  assert.throws(() => pickSerials(0, new Set(), () => 0));
});

test('validateTierInput — DB CHECK 와 같은 범위, 상한 없음은 명시 선택만(빈 칸이 상한을 풀면 안 된다)', () => {
  assert.deepEqual(validateTierInput({ tier: '10', percent: '15', maxDiscountWon: '', noCap: 'on' }), {
    ok: true,
    value: { tier: '10', percent: 15, maxDiscountWon: null },
  });
  assert.deepEqual(validateTierInput({ tier: '50', percent: 50, maxDiscountWon: String(COUPON_MIN_CAP_WON) }), {
    ok: true,
    value: { tier: '50', percent: 50, maxDiscountWon: COUPON_MIN_CAP_WON },
  });
  for (const bad of [
    { tier: '15', percent: 10, maxDiscountWon: '5000' },
    { tier: '10', percent: 0, maxDiscountWon: '5000' }, // 0% 는 끄기가 아니다(disabled_at)
    { tier: '10', percent: 51, maxDiscountWon: '5000' },
    { tier: '10', percent: 10.5, maxDiscountWon: '5000' },
    { tier: '10', percent: 10, maxDiscountWon: '' }, // 🔴 빈 칸 = 오류. 소급과 겹치면 전 귀속자의 상한이 풀린다
    { tier: '10', percent: 10, maxDiscountWon: 1 }, // 1원 상한 = 사실상 0원 쿠폰에 계정이 묶인다
    { tier: '10', percent: 10, maxDiscountWon: 'abc' },
  ]) {
    assert.equal(validateTierInput(bad).ok, false, JSON.stringify(bad));
  }
});

// KST 2026-09-13 21:00 (= UTC 12:00). 오늘(KST) 은 09-13.
const NOW = new Date('2026-09-13T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const issue = (over: Record<string, unknown> = {}) => ({
  tier: '10',
  count: '300',
  batch: '2026-09 강남 전단',
  expiresOn: '2027-12-31',
  ...over,
});

test('normalizeBatchName — NFC·공백 정리, 보이지 않는 문자·제어문자·길이 초과는 거부', () => {
  const nfd = '강남 전단'.normalize('NFD');
  assert.equal(normalizeBatchName(`  ${nfd}   2차 `), '강남 전단 2차');
  assert.equal(normalizeBatchName('강남\u200b전단'), null); // zero-width — 눈으로는 같은 이름이 둘 생긴다
  assert.equal(normalizeBatchName('줄\n바꿈'), null);
  assert.equal(normalizeBatchName('x'.repeat(41)), null);
  assert.equal(normalizeBatchName('   '), null);
  assert.equal(normalizeBatchName(123), null);
});

test('validateIssueInput — 운영: 실물 배치만, 만료는 내일~2년, 수량 상한', () => {
  assert.deepEqual(validateIssueInput(issue(), 'production', NOW), {
    ok: true,
    value: { tier: '10', count: 300, batch: '2026-09 강남 전단', expiresAt: '2027-12-31T14:59:59.000Z' },
  });
  // staging-test 는 운영에서 먹히지 않는 코드다 — 인쇄되면 전단이 통째로 무효. 유사명도 거부(착각하기 쉽다).
  for (const batch of ['staging-test', ' Staging-Test ', 'STAGING_TEST', 'staging test']) {
    assert.equal(validateIssueInput(issue({ batch }), 'production', NOW).ok, false, batch);
  }
  const maxDay = new Date(NOW.getTime() + (COUPON_EXPIRY_MAX_DAYS + 1) * 24 * HOUR).toISOString().slice(0, 10);
  for (const bad of [
    { count: '0' },
    { count: String(COUPON_ISSUE_MAX + 1) },
    { count: '1.5' },
    { tier: '60' },
    { batch: '   ' },
    { expiresOn: '2026-09-13' }, // 오늘(KST) — 발급 당일 만료는 오타다
    { expiresOn: '2026-02-30' },
    { expiresOn: maxDay }, // 사실상 무기한 = 50% 쿠폰 1장이 매달 새는 구멍(설계 §11-A D)
    { expiresOn: '' },
  ]) {
    assert.equal(validateIssueInput(issue(bad), 'production', NOW).ok, false, JSON.stringify(bad));
  }
});

test('validateIssueInput — staging·로컬(test)은 staging-test 배치만, preview·모름(null)은 전부 거부', () => {
  const ok = validateIssueInput(issue({ batch: 'staging-test', count: '5' }), 'test', NOW);
  assert.equal(ok.ok && ok.value.batch, STAGING_TEST_BATCH);
  // 같은 DB 라 staging 이 실물 배치를 만들면 프로덕션에서 그대로 먹힌다.
  assert.equal(validateIssueInput(issue(), 'test', NOW).ok, false);
  assert.equal(validateIssueInput(issue({ batch: 'staging-test' }), null, NOW).ok, false);
});

test('adminCouponEnv — 호스트가 운영이어도 운영 배포(VERCEL_ENV)가 아니면 쓰기 불가(로컬 Host 위조)', () => {
  assert.equal(adminCouponEnv('production', 'production'), 'production');
  assert.equal(adminCouponEnv('production', undefined), null);
  assert.equal(adminCouponEnv('production', 'preview'), null);
  assert.equal(adminCouponEnv('test', 'preview'), 'test');
  assert.equal(adminCouponEnv('test', undefined), 'test');
  assert.equal(adminCouponEnv(null, 'production'), null);
});

test('batchAllowedInEnv — 운영은 전부, staging·로컬은 staging-test 만, 모름은 없음', () => {
  assert.equal(batchAllowedInEnv('2026-09 강남', 'production'), true);
  assert.equal(batchAllowedInEnv(STAGING_TEST_BATCH, 'test'), true);
  assert.equal(batchAllowedInEnv('2026-09 강남', 'test'), false);
  assert.equal(batchAllowedInEnv(STAGING_TEST_BATCH, null), false);
});

test('maskCouponCode·scrubCouponCodes — 감사 기록·사유에 코드 평문이 남지 않는다', () => {
  assert.equal(maskCouponCode('ganji100034'), 'ganji-10-**34');
  const scrubbed = scrubCouponCodes('고객이 ganji-10-0034 와 GANJI 50 1234, ganji201111 을 보냄');
  assert.ok(!CODE_RE.test(scrubbed), scrubbed);
  assert.match(scrubbed, /ganji-10-\*\*\*\*/);
});

const TIER = (tier: string, over: Partial<AdminTierRow> = {}): AdminTierRow => ({
  tier,
  percent: Number(tier),
  max_discount_won: null,
  disabled_at: null,
  updated_at: '2026-09-11T00:00:00.123456+00:00',
  updated_by: null,
  ...over,
});
const tierJoin = (t: AdminTierRow) => ({ percent: t.percent, max_discount_won: t.max_discount_won, disabled_at: t.disabled_at });
const COUPON = (code: string, over: Partial<AdminCouponRow> = {}): AdminCouponRow => ({
  code,
  tier: code.slice(5, 7),
  batch: '강남',
  bound_user_id: null,
  bound_at: null,
  bound_percent: null,
  bound_max_discount_won: null,
  expires_at: '2027-12-31T14:59:59+00:00',
  disabled_at: null,
  released_at: null,
  created_at: ago(72 * HOUR),
  coupon_tiers: tierJoin(TIER(code.slice(5, 7))),
  ...over,
});
const ORDER = (code: string, status: string, over: Partial<AdminCouponOrder> = {}): AdminCouponOrder => ({
  id: `o-${code}-${status}`,
  coupon_code: code,
  status,
  amount: 2970,
  discount_won: 330,
  created_at: ago(HOUR),
  metadata: { origin: { env: 'production', host: 'ganjisaju.kr' } },
  ...over,
});

test('couponState — 정본(couponDeadReason)과 같은 판정, 겹치면 released > disabled > expired', () => {
  assert.equal(couponState(COUPON('ganji100001'), NOW), 'unbound');
  assert.equal(couponState(COUPON('ganji100002', { bound_user_id: 'u1', bound_at: ago(HOUR) }), NOW), 'live');
  assert.equal(couponState(COUPON('ganji100003', { released_at: ago(HOUR), disabled_at: ago(HOUR) }), NOW), 'released');
  assert.equal(couponState(COUPON('ganji100004', { disabled_at: ago(HOUR), expires_at: ago(HOUR) }), NOW), 'disabled');
  assert.equal(couponState(COUPON('ganji100005', { expires_at: ago(HOUR) }), NOW), 'expired');
  // 등급을 끄면 그 등급 쿠폰은 전부 죽는다(귀속자 포함).
  const off = { ...tierJoin(TIER('10')), disabled_at: ago(HOUR) };
  assert.equal(couponState(COUPON('ganji100006', { bound_user_id: 'u2', coupon_tiers: off }), NOW), 'disabled');
});

test('couponBatchStats — 태우기 신호: 24h 귀속이 쏟아지는데 결제가 거의 없다(원 숫자도 같이)', () => {
  const coupons: AdminCouponRow[] = [];
  for (let i = 0; i < 30; i += 1) {
    coupons.push(COUPON(`ganji10${String(i).padStart(4, '0')}`, { bound_user_id: `bot${i}`, bound_at: ago(2 * HOUR) }));
  }
  coupons.push(COUPON('ganji200001', { batch: '정상', bound_user_id: 'real', bound_at: ago(2 * HOUR) }));
  coupons.push(COUPON('ganji200002', { batch: STAGING_TEST_BATCH, bound_user_id: 'qa', bound_at: ago(HOUR) }));
  const orders: AdminCouponOrder[] = [
    ORDER('ganji100000', 'fulfilled'), // 봇 배치에서도 결제 1건 — "결제 0" 조건이면 신호가 꺼지는 미탐이었다
    ORDER('ganji200001', 'confirmed'),
    ORDER('ganji200001', 'refunded', { id: 'o-refund' }),
    ORDER('ganji200002', 'fulfilled', { metadata: { origin: { env: 'staging' } } }), // 샌드박스 결제는 매출 아님
    ORDER('ganji200001', 'fulfilled', { id: 'o-unknown', metadata: { origin: { env: 'unknown' } } }), // 낯선 호스트
  ];
  const stats = couponBatchStats(coupons, orders, NOW);
  const bot = stats.find((b) => b.batch === '강남')!;
  assert.equal(bot.issued, 30);
  assert.equal(bot.bound24h, 30);
  assert.equal(bot.paidOrders, 1);
  assert.equal(bot.burnSignal, true);
  const real = stats.find((b) => b.batch === '정상')!;
  assert.equal(real.paidOrders, 1, 'confirmed 도 완료, unknown origin 은 매출 아님');
  assert.equal(real.refundedOrders, 1);
  assert.equal(real.burnSignal, false);
  const qa = stats.find((b) => b.batch === STAGING_TEST_BATCH)!;
  assert.equal(qa.isTest, true);
  assert.equal(qa.paidOrders, 0);
  assert.ok(!CODE_RE.test(JSON.stringify(stats)), '집계에 코드 평문이 없다(화면으로 내려간다)');
});

test('couponBatchStats — 회수 스탬프는 DB 원문 그대로 모은다(µs 스탬프가 ms 로 잘리면 되살리기가 0행)', () => {
  const stamp = '2026-09-13T03:00:00.123456+00:00';
  const stats = couponBatchStats(
    [COUPON('ganji100001', { disabled_at: stamp }), COUPON('ganji100002', { disabled_at: stamp }), COUPON('ganji100003')],
    [],
    NOW
  );
  assert.deepEqual(stats[0].disabledStamps, [stamp]);
  assert.equal(stats[0].disabled, 2);
});

test('couponTierStats — 잔여 번호·추측 성공률·옛 요율로 쓰는 귀속 수(소급 대상), staging-test 분리', () => {
  const tiers = [TIER('10', { percent: 8 })];
  const rows = [
    COUPON('ganji100001', { bound_user_id: 'a', bound_percent: 10 }), // 옛 요율 스냅샷
    COUPON('ganji100002', { bound_user_id: 'b', bound_percent: 8 }),
    COUPON('ganji100003', { bound_user_id: 'c', bound_percent: 10, released_at: ago(HOUR) }), // released 는 소급 대상 아님
    COUPON('ganji100004', { bound_user_id: 'd', bound_percent: 10, batch: STAGING_TEST_BATCH }),
    COUPON('ganji100005'),
  ];
  const [t] = couponTierStats(tiers, rows);
  assert.equal(t.issued, 5);
  assert.equal(t.remaining, 9_995);
  assert.equal(t.boundHeld, 3, '자리를 차지한 귀속(released 제외 — 회수·만료 포함) = 소급 대상');
  assert.equal(t.boundHeldTest, 1);
  assert.equal(t.snapshotStale, 2);
  assert.equal(t.updatedAt, '2026-09-11T00:00:00.123456+00:00', 'CAS 토큰은 원문');
});

test('couponCsv — BOM·인쇄 형식·수식 주입 방지, 파일명엔 배치명의 글자·숫자만', () => {
  const csv = couponCsv([
    { code: 'ganji100034', state: 'unbound', expires_at: '2027-12-31T14:59:59+00:00' },
    { code: 'ganji100035', state: 'live', expires_at: '2027-12-31T14:59:59+00:00' },
  ]);
  assert.ok(csv.startsWith('\ufeff'), 'Excel 한글');
  assert.match(csv, /ganji-10-0034,미사용,2027-12-31/);
  assert.match(csv, /ganji-10-0035,사용 중,2027-12-31/);
  assert.equal(couponCsvFileName('=강남/전단:2차', NOW), 'ganji-coupons-20260913-강남전단2차.csv');
});

// ─────────────────────────────────────────────────────────────
// DB 조작 — 가짜 DB 는 필터를 **실제로 적용**하고 080 부분 유니크·PK 중복(23505)·085 접두=등급(23514)을 흉내 낸다.
// order 없는 페이지 조회(limit)는 throw — 정렬 없는 OFFSET/LIMIT 은 행이 페이지 사이에서 옮겨 CSV 에 코드가 두 번 실린다.
// 오류 message 에 코드 평문을 넣는다(Postgres 가 실제로 그렇게 준다) — 우리 오류로 새지 않는지 본다.
// ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Filter = { op: 'eq' | 'is' | 'gt' | 'notnull'; col: string; val?: unknown };

interface FakeDb {
  client: SupabaseClient;
  t: Record<string, Row[]>;
  /** 다음 insert 를 이 오류로 실패시킨다(동시 발급 경합 흉내). */
  failInsert?: { code: string; message: string };
  queries: { table: string; filters: Filter[]; kind: string }[];
}

function fakeAdminDb(seed: { coupons?: Row[]; tiers?: Row[]; orders?: Row[] } = {}): FakeDb {
  const db: FakeDb = {
    client: null as unknown as SupabaseClient,
    t: {
      discount_coupons: seed.coupons ?? [],
      coupon_tiers:
        seed.tiers ??
        ['10', '20', '30', '40', '50'].map((tier) => ({
          tier,
          percent: Number(tier),
          max_discount_won: null,
          disabled_at: null,
          updated_at: '2026-09-11T00:00:00.123456+00:00',
          updated_by: null,
        })),
      coupon_tier_changes: [],
      payment_orders: seed.orders ?? [],
      admin_access_log: [],
    },
    queries: [],
  };
  const matches = (row: Row, filters: Filter[]) =>
    filters.every(({ op, col, val }) => {
      const v = row[col];
      if (op === 'eq') return v === val;
      if (op === 'is') return v == null && val === null;
      if (op === 'notnull') return v != null;
      return v != null && String(v) > String(val);
    });
  const withTier = (row: Row) => {
    const t = db.t.coupon_tiers.find((x) => x.tier === row.tier);
    return { ...row, coupon_tiers: t ? { percent: t.percent, max_discount_won: t.max_discount_won, disabled_at: t.disabled_at } : null };
  };
  function builder(table: string) {
    const filters: Filter[] = [];
    let patch: Row | null = null;
    let inserts: Row[] | null = null;
    let returning = false;
    let head = false;
    let orderCol: string | null = null;
    let limitN: number | null = null;
    const run = () => {
      const rows = db.t[table];
      db.queries.push({ table, filters: [...filters], kind: inserts ? 'insert' : patch ? 'update' : 'select' });
      if (inserts) {
        if (db.failInsert) {
          const error = db.failInsert;
          db.failInsert = undefined;
          return { data: null, error, count: null };
        }
        for (const row of inserts) {
          if (table === 'discount_coupons') {
            if (rows.some((r) => r.code === row.code) || inserts.filter((r) => r.code === row.code).length > 1) {
              return { data: null, error: { code: '23505', message: `duplicate key (code)=(${row.code})` }, count: null };
            }
            if (String(row.code).slice(5, 7) !== row.tier) {
              return { data: null, error: { code: '23514', message: `check violation ${row.code}` }, count: null };
            }
          }
        }
        rows.push(...inserts.map((r) => ({ released_at: null, disabled_at: null, bound_user_id: null, bound_at: null, bound_percent: null, bound_max_discount_won: null, ...r })));
        return { data: null, error: null, count: inserts.length };
      }
      let hits = rows.filter((row) => matches(row, filters));
      if (patch) {
        if (table === 'discount_coupons') {
          const next = rows.map((r) => (hits.includes(r) ? { ...r, ...patch } : r));
          const live = next.filter((r) => r.bound_user_id && !r.released_at).map((r) => r.bound_user_id);
          if (new Set(live).size !== live.length) return { data: null, error: { code: '23505', message: 'one_live_per_user' }, count: null };
        }
        for (const row of hits) Object.assign(row, patch);
        return { data: returning ? hits.map((r) => ({ ...r })) : null, error: null, count: hits.length };
      }
      if (limitN != null && !orderCol) throw new Error('order 없는 페이지 조회 — 행이 페이지 사이에서 옮겨 중복·누락된다');
      if (orderCol) hits = [...hits].sort((a, b) => (String(a[orderCol!]) < String(b[orderCol!]) ? -1 : 1));
      if (limitN != null) hits = hits.slice(0, limitN);
      if (head) return { data: null, error: null, count: hits.length };
      const data = table === 'discount_coupons' ? hits.map(withTier) : hits.map((r) => ({ ...r }));
      return { data, error: null, count: hits.length };
    };
    const chain: Record<string, unknown> = {
      select: (_cols?: string, opts?: { head?: boolean }) => {
        if (patch || inserts) returning = true;
        head = Boolean(opts?.head);
        return chain;
      },
      insert: (rows: Row | Row[]) => ((inserts = Array.isArray(rows) ? rows : [rows]), chain),
      update: (p: Row) => ((patch = p), chain),
      eq: (col: string, val: unknown) => (filters.push({ op: 'eq', col, val }), chain),
      is: (col: string, val: unknown) => (filters.push({ op: 'is', col, val }), chain),
      gt: (col: string, val: unknown) => (filters.push({ op: 'gt', col, val }), chain),
      not: (col: string, _op: string, _val: unknown) => (filters.push({ op: 'notnull', col }), chain),
      order: (col: string) => ((orderCol = col), chain),
      limit: (n: number) => ((limitN = n), chain),
      maybeSingle: () => {
        const r = run();
        return Promise.resolve({ ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data });
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        try {
          return Promise.resolve(run()).then(resolve, reject);
        } catch (err) {
          return Promise.reject(err).then(resolve, reject);
        }
      },
    };
    return chain;
  }
  db.client = {
    from: builder,
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: [{ id: HOLDER, email: `${HOLDER}@test.kr`, created_at: '2026-01-01T00:00:00Z', identities: [] }] },
          error: null,
        }),
        getUserById: async (id: string) => ({
          data: { user: { id, email: `${id}@test.kr`, created_at: '2026-01-01T00:00:00Z', identities: [{ provider: 'kakao', id: 'k1' }] } },
          error: null,
        }),
      },
    },
  } as unknown as SupabaseClient;
  return db;
}

const CODE_ROW = (code: string, over: Row = {}): Row => ({
  code,
  tier: code.slice(5, 7),
  batch: '강남',
  bound_user_id: null,
  bound_at: null,
  bound_percent: null,
  bound_max_discount_won: null,
  expires_at: '2027-12-31T14:59:59+00:00',
  disabled_at: null,
  released_at: null,
  created_at: ago(72 * HOUR),
  created_by: null,
  ...over,
});
const ACTOR = '11111111-1111-4111-8111-111111111111';
const HOLDER = '22222222-2222-4222-8222-222222222222';
const expectFail = async (p: Promise<unknown>, re: RegExp) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e as Error
  );
  assert.ok(err, '실패해야 한다');
  assert.match(err!.message, re);
  assert.ok(!CODE_RE.test(err!.message), `오류에 코드 평문이 새면 안 된다: ${err!.message}`);
};

test('issueCouponBatch — 접두=등급, 기존 번호 제외(1000행 넘어도), 발급자·만료 기록, 반환값에 코드 없음', async () => {
  const existing = Array.from({ length: 2_500 }, (_, i) => CODE_ROW(`ganji10${String(i).padStart(4, '0')}`, { batch: '옛 배치' }));
  const db = fakeAdminDb({ coupons: existing });
  const out = await issueCouponBatch(
    db.client,
    { tier: '10', count: 50, batch: '새 배치', expiresAt: '2027-12-31T14:59:59.000Z', append: false },
    ACTOR,
    'production',
    { randomInt: () => 0, now: NOW }
  );
  const fresh = db.t.discount_coupons.filter((r) => r.batch === '새 배치');
  assert.equal(fresh.length, 50);
  // randomInt=0 이면 남은 번호 앞에서부터 — 기존 2,500개(0000~2499)를 전부 건너뛰었다는 증거(첫 페이지 1,000행만 봤으면 1000 부터 겹친다).
  assert.equal(fresh[0].code, 'ganji102500');
  assert.ok(fresh.every((r) => String(r.code).slice(5, 7) === r.tier && r.created_by === ACTOR));
  assert.ok(fresh.every((r) => r.expires_at === '2027-12-31T14:59:59.000Z' && r.created_at === NOW.toISOString()));
  assert.ok(!CODE_RE.test(JSON.stringify(out)), '발급 결과에 코드 평문이 없다 — 코드는 CSV 내보내기로만 나간다');
  assert.equal(out.count, 50);
});

test('issueCouponBatch — 배치명 중복은 "기존 배치에 추가"를 켰을 때만, 없는 배치에 추가는 거부, staging-test 는 반복 허용', async () => {
  const db = fakeAdminDb({ coupons: [CODE_ROW('ganji100001', { batch: '강남' }), CODE_ROW('ganji100002', { batch: STAGING_TEST_BATCH })] });
  const base = { tier: '10' as const, count: 1, expiresAt: '2027-12-31T14:59:59.000Z' };
  const opts = { randomInt: () => 0, now: NOW };
  await expectFail(issueCouponBatch(db.client, { ...base, batch: '강남', append: false }, ACTOR, 'production', opts), /이미 있는 배치/);
  await expectFail(issueCouponBatch(db.client, { ...base, batch: '없는 배치', append: true }, ACTOR, 'production', opts), /추가할 배치가 없/);
  await issueCouponBatch(db.client, { ...base, batch: '강남', append: true }, ACTOR, 'production', opts);
  await issueCouponBatch(db.client, { ...base, batch: STAGING_TEST_BATCH, append: false }, ACTOR, 'test', opts);
  assert.equal(db.t.discount_coupons.filter((r) => r.batch === '강남').length, 2);
  assert.equal(db.t.discount_coupons.filter((r) => r.batch === STAGING_TEST_BATCH).length, 2);
});

test('issueCouponBatch — 동시 발급 충돌(23505)·접두 불일치(23514)는 코드 없이 거부, staging 은 실물 배치 발급 불가', async () => {
  const db = fakeAdminDb();
  const input = { tier: '10' as const, count: 3, batch: '강남', expiresAt: '2027-12-31T14:59:59.000Z', append: false };
  const opts = { randomInt: () => 0, now: NOW };
  db.failInsert = { code: '23505', message: 'duplicate key (code)=(ganji100000)' };
  await expectFail(issueCouponBatch(db.client, input, ACTOR, 'production', opts), /다른 발급과 겹/);
  db.failInsert = { code: '23514', message: 'check ganji100000' };
  await expectFail(issueCouponBatch(db.client, input, ACTOR, 'production', opts), /형식 검사/);
  await expectFail(issueCouponBatch(db.client, input, ACTOR, 'test', opts), /staging-test/);
  await expectFail(issueCouponBatch(db.client, input, ACTOR, null, opts), /발급할 수 없/);
  assert.equal(db.t.discount_coupons.length, 0);
});

test('revokeCouponBatch — 그 배치의 살아 있는 행만 이번 스탬프로, 앞선 회수·다른 배치는 그대로, staging 은 실물 배치 불가', async () => {
  const old = '2026-09-01T00:00:00.654321+00:00';
  const db = fakeAdminDb({
    coupons: [CODE_ROW('ganji100001'), CODE_ROW('ganji100002', { disabled_at: old }), CODE_ROW('ganji100003', { batch: '다른' })],
  });
  const out = await revokeCouponBatch(db.client, '강남', 'production', NOW);
  assert.equal(out.count, 1);
  assert.equal(out.stamp, NOW.toISOString());
  const byCode = Object.fromEntries(db.t.discount_coupons.map((r) => [r.code, r.disabled_at]));
  assert.deepEqual(byCode, { ganji100001: NOW.toISOString(), ganji100002: old, ganji100003: null });
  await expectFail(revokeCouponBatch(db.client, '다른', 'test', NOW), /staging-test/);
  assert.equal(db.t.discount_coupons.find((r) => r.code === 'ganji100003')!.disabled_at, null);
});

test('restoreCouponBatch — 그 스탬프 행만 되살리고(µs 원문 일치), released 는 종료 상태로 남는다', async () => {
  const stamp = '2026-09-13T03:00:00.123456+00:00';
  const other = '2026-09-01T00:00:00.000000+00:00';
  const db = fakeAdminDb({
    coupons: [
      CODE_ROW('ganji100001', { disabled_at: stamp }),
      CODE_ROW('ganji100002', { disabled_at: stamp, bound_user_id: HOLDER, bound_at: ago(HOUR), released_at: ago(HOUR) }),
      CODE_ROW('ganji100003', { disabled_at: other }),
    ],
  });
  await expectFail(restoreCouponBatch(db.client, '강남', '2026-09-13T03:00:00.123Z', 'production'), /회수 기록/);
  await expectFail(restoreCouponBatch(db.client, '강남', 'not-a-date', 'production'), /회수 기록/);
  const out = await restoreCouponBatch(db.client, '강남', stamp, 'production');
  assert.equal(out.count, 2);
  const rows = Object.fromEntries(db.t.discount_coupons.map((r) => [r.code, r]));
  assert.equal(rows.ganji100001.disabled_at, null);
  assert.equal(rows.ganji100003.disabled_at, other, '다른 회수는 그대로');
  assert.equal(couponState(rows.ganji100002 as unknown as AdminCouponRow, NOW), 'released', '되살려도 released 는 부활하지 않는다(080)');
  await expectFail(restoreCouponBatch(db.client, '강남', other, 'test'), /staging-test/);
});

test('setCouponBatchExpiry — 배치 전체의 만료를 바꾸고 이전 범위를 돌려준다(감사용), staging 은 실물 배치 불가', async () => {
  const db = fakeAdminDb({
    coupons: [CODE_ROW('ganji100001', { expires_at: '2027-06-30T14:59:59+00:00' }), CODE_ROW('ganji100002'), CODE_ROW('ganji100003', { batch: '다른' })],
  });
  const out = await setCouponBatchExpiry(db.client, '강남', '2028-03-31T14:59:59.000Z', 'production');
  assert.equal(out.count, 2);
  assert.equal(out.oldMin, '2027-06-30T14:59:59+00:00');
  assert.equal(out.oldMax, '2027-12-31T14:59:59+00:00');
  assert.deepEqual(
    db.t.discount_coupons.map((r) => r.expires_at),
    ['2028-03-31T14:59:59.000Z', '2028-03-31T14:59:59.000Z', '2027-12-31T14:59:59+00:00']
  );
  await expectFail(setCouponBatchExpiry(db.client, '다른', '2028-03-31T14:59:59.000Z', 'test'), /staging-test/);
});

test('lookupCouponHolder — 코드·UUID 로 보유자·진행 중 결제를 보여 주되 코드 평문은 없다, staging 에선 실물 행이 "없음"', async () => {
  const boundAt = '2026-09-13T01:02:03.456789+00:00';
  const db = fakeAdminDb({
    coupons: [
      CODE_ROW('ganji100001', { bound_user_id: HOLDER, bound_at: boundAt, bound_percent: 10 }),
      CODE_ROW('ganji100002', { bound_user_id: HOLDER, bound_at: ago(99 * HOUR), released_at: ago(98 * HOUR) }),
    ],
    orders: [{ id: 'o1', coupon_code: 'ganji100001', user_id: HOLDER, status: 'prepared', expires_at: new Date(NOW.getTime() + HOUR).toISOString() }],
  });
  const byCode = await lookupCouponHolder(db.client, 'GANJI-10-0001', 'production', NOW);
  assert.equal(byCode.found && byCode.holder, HOLDER);
  assert.equal(byCode.found && byCode.boundAt, boundAt, 'CAS 토큰은 원문');
  assert.equal(byCode.found && byCode.pendingOrders, 1);
  assert.equal(byCode.found && byCode.holderEmail, `${HOLDER}@test.kr`);
  assert.ok(!CODE_RE.test(JSON.stringify(byCode)), JSON.stringify(byCode));
  const byUser = await lookupCouponHolder(db.client, HOLDER, 'production', NOW);
  assert.equal(byUser.found && byUser.boundAt, boundAt, 'released 행이 아니라 자리를 차지한 쿠폰');
  const byEmail = await lookupCouponHolder(db.client, `  ${HOLDER.toUpperCase()}@TEST.KR `, 'production', NOW);
  assert.equal(byEmail.found && byEmail.boundAt, boundAt, '이메일은 정확히 일치(대소문자 무시)');
  assert.equal((await lookupCouponHolder(db.client, 'nobody@test.kr', 'production', NOW)).found, false);
  assert.equal((await lookupCouponHolder(db.client, 'ganji100001', 'test', NOW)).found, false);
  await expectFail(lookupCouponHolder(db.client, 'ganji-10-00', 'production', NOW), /코드|UUID|이메일/);
});

test('releaseHeldCoupon — (보유자, bound_at) CAS 로 released_at 만 찍는다, bound_user_id 는 그대로, 틀린 토큰은 0행 거부', async () => {
  const boundAt = '2026-09-13T01:02:03.456789+00:00';
  const db = fakeAdminDb({
    coupons: [CODE_ROW('ganji100001', { bound_user_id: HOLDER, bound_at: boundAt, bound_percent: 10 }), CODE_ROW('ganji100002')],
  });
  await expectFail(releaseHeldCoupon(db.client, HOLDER, '2026-09-13T01:02:03.456Z', 'production', NOW), /상태가 바뀌/);
  await expectFail(releaseHeldCoupon(db.client, HOLDER, boundAt, 'test', NOW), /상태가 바뀌/);
  const out = await releaseHeldCoupon(db.client, HOLDER, boundAt, 'production', NOW);
  assert.equal(out.maskedCode, 'ganji-10-**01');
  const row = db.t.discount_coupons[0];
  assert.equal(row.released_at, NOW.toISOString());
  assert.equal(row.bound_user_id, HOLDER, '🔴 080: bound_user_id 를 비우면 이미 쓴 전단이 남에게 재귀속된다');
  // 풀린 계정은 새 코드를 가질 수 있다(부분 유니크가 released 를 세지 않는다).
  const next = await db.client.from('discount_coupons').update({ bound_user_id: HOLDER, bound_at: NOW.toISOString() }).eq('code', 'ganji100002');
  assert.equal((next as { error: unknown }).error, null);
});

test('updateCouponTier — updated_at CAS(원문), 감사 old/new, 소급은 released 제외 전 귀속(회수·만료 포함)만', async () => {
  const db = fakeAdminDb({
    coupons: [
      CODE_ROW('ganji100001', { bound_user_id: 'a', bound_at: ago(HOUR), bound_percent: 10 }),
      CODE_ROW('ganji100002', { bound_user_id: 'b', bound_at: ago(HOUR), bound_percent: 10, disabled_at: ago(HOUR) }),
      CODE_ROW('ganji100003', { bound_user_id: 'c', bound_at: ago(9 * HOUR), bound_percent: 10, released_at: ago(HOUR) }),
      CODE_ROW('ganji200001', { bound_user_id: 'd', bound_at: ago(HOUR), bound_percent: 20 }),
    ],
  });
  const seen = '2026-09-11T00:00:00.123456+00:00';
  await expectFail(
    updateCouponTier(db.client, { tier: '10', percent: 5, maxDiscountWon: 3000, applyToBound: true, seenUpdatedAt: '2026-09-11T00:00:00.123Z' }, ACTOR, NOW),
    /다른 관리자/
  );
  const out = await updateCouponTier(db.client, { tier: '10', percent: 5, maxDiscountWon: 3000, applyToBound: true, seenUpdatedAt: seen }, ACTOR, NOW);
  assert.equal(out.retroCount, 2);
  const tier = db.t.coupon_tiers.find((t) => t.tier === '10')!;
  assert.deepEqual([tier.percent, tier.max_discount_won, tier.updated_by], [5, 3000, ACTOR]);
  const snap = Object.fromEntries(db.t.discount_coupons.map((r) => [r.code, [r.bound_percent, r.bound_max_discount_won]]));
  assert.deepEqual(snap.ganji100001, [5, 3000]);
  assert.deepEqual(snap.ganji100002, [5, 3000], '회수된 귀속도 — 되살리면 옛 조건이 부활하지 않게');
  assert.deepEqual(snap.ganji100003, [10, null], 'released 는 종료 상태');
  assert.deepEqual(snap.ganji200001, [20, null], '다른 등급');
  const [audit] = db.t.coupon_tier_changes;
  assert.deepEqual(
    [audit.tier, audit.old_percent, audit.new_percent, audit.new_max_discount_won, audit.applied_to_bound, audit.changed_by],
    ['10', 10, 5, 3000, true, ACTOR]
  );
});

test('updateCouponTier — 소급을 끄면 기존 귀속 스냅샷은 그대로(설계 §2 약속), setCouponTierDisabled 도 CAS', async () => {
  const db = fakeAdminDb({ coupons: [CODE_ROW('ganji100001', { bound_user_id: 'a', bound_at: ago(HOUR), bound_percent: 10 })] });
  const seen = '2026-09-11T00:00:00.123456+00:00';
  const out = await updateCouponTier(db.client, { tier: '10', percent: 5, maxDiscountWon: null, applyToBound: false, seenUpdatedAt: seen }, ACTOR, NOW);
  assert.equal(out.retroCount, 0);
  assert.equal(db.t.discount_coupons[0].bound_percent, 10);
  assert.equal(db.t.coupon_tier_changes[0].applied_to_bound, false);
  await expectFail(setCouponTierDisabled(db.client, '10', true, seen, ACTOR, NOW), /다른 관리자/);
  await setCouponTierDisabled(db.client, '10', true, NOW.toISOString(), ACTOR, NOW);
  assert.equal(db.t.coupon_tiers.find((t) => t.tier === '10')!.disabled_at, NOW.toISOString());
});

test('exportCouponBatch — 배치 코드를 페이지 사이에서도 중복·누락 없이, staging 은 실물 배치 불가', async () => {
  const rows = Array.from({ length: 2_100 }, (_, i) => CODE_ROW(`ganji20${String(i).padStart(4, '0')}`, { tier: '20' }));
  const db = fakeAdminDb({ coupons: [...rows, CODE_ROW('ganji100001', { batch: '다른' })] });
  const out = await exportCouponBatch(db.client, '강남', 'production', NOW);
  assert.equal(out.rowCount, 2_100);
  assert.equal(out.liveUnbound, 2_100);
  const lines = out.csv.trim().split('\n').slice(1);
  assert.equal(new Set(lines).size, 2_100);
  assert.ok(!out.csv.includes('ganji-10-0001'), '다른 배치 코드가 섞이지 않는다');
  await expectFail(exportCouponBatch(db.client, '다른', 'test', NOW), /staging-test/);
});

test('recordCouponAudit — insert 오류를 삼키지 않는다(다운로드마다 감사 = 실패하면 내보내기 중단)', async () => {
  const db = fakeAdminDb();
  await recordCouponAudit(db.client, { actorId: ACTOR, actorRole: 'super_admin', action: 'coupon_export', meta: { batch: '강남' } });
  assert.equal(db.t.admin_access_log.length, 1);
  db.failInsert = { code: '42501', message: 'permission denied' };
  await expectFail(
    recordCouponAudit(db.client, { actorId: ACTOR, actorRole: 'super_admin', action: 'coupon_export', meta: {} }),
    /감사 기록/
  );
});

test('releaseCouponsOfUser — 탈퇴 전 그 계정이 차지한 쿠폰을 종료(주문 cascade 로 결제 증거가 지워져 24h 회수로 남에게 가지 않게)', async () => {
  const db = fakeAdminDb({
    coupons: [
      CODE_ROW('ganji100001', { bound_user_id: HOLDER, bound_at: ago(HOUR) }),
      CODE_ROW('ganji100002', { bound_user_id: HOLDER, bound_at: ago(99 * HOUR), released_at: ago(98 * HOUR) }),
    ],
  });
  await releaseCouponsOfUser(db.client, HOLDER, NOW);
  assert.equal(db.t.discount_coupons[0].released_at, NOW.toISOString());
  assert.equal(db.t.discount_coupons[1].released_at, ago(98 * HOUR), '이미 종료된 행의 시각은 그대로');
});

// ─────────────────────────────────────────────────────────────
// 소스 가드 — 'use server' 파일의 export 는 전부 공개 POST 엔드포인트다(Next docs data-security).
// 레이아웃·페이지의 super_admin 가드는 액션에 이어지지 않는다(admin/layout 은 admin 도 통과시킨다).
// ─────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ACTIONS = 'src/app/admin/coupons/actions.ts';
const EXPECTED_ACTIONS = [
  'exportBatchAction',
  'issueBatchAction',
  'lookupHolderAction',
  'releaseCouponAction',
  'restoreBatchAction',
  'revokeBatchAction',
  'setBatchExpiryAction',
  'toggleTierAction',
  'updateTierAction',
];

/** 가드가 빠진 export 이름(또는 금지된 export 형태). 첫 문장이 정확히 super_admin 재확인이어야 한다. */
function unguardedActions(source: string): string[] {
  const problems: string[] = [];
  if (/^export\s+(const|let|var|default|\{|\*)/m.test(source)) problems.push('export const/default/{ 금지');
  for (const m of source.matchAll(/^export async function (\w+)\([^)]*\)[^{]*\{\s*\n([^\n]*)/gm)) {
    if (m[2].trim() !== 'const admin = await requireSuperAdmin();') problems.push(m[1]);
  }
  return problems;
}

test('관리자 쿠폰 액션 — 모든 export 가 첫 줄에서 super_admin 을 다시 확인한다', () => {
  const src = read(ACTIONS);
  assert.match(src, /^'use server';/m);
  const names = [...src.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(names, EXPECTED_ACTIONS, '액션 목록이 바뀌면 이 목록과 가드를 같이 본다');
  assert.deepEqual(unguardedActions(src), []);
  // 가드가 빠진 픽스처는 반드시 걸린다(정규식이 조용히 초록이 되지 않게).
  assert.deepEqual(unguardedActions('export async function leak(fd: FormData) {\n  const x = 1;\n}'), ['leak']);
  assert.ok(unguardedActions('export const leak = async () => {};').length > 0);
});

test('관리자 쿠폰 코드 — upsert·삭제·released 되돌리기·귀속 비우기·Math.random·전역 캐시 무효화·세션 클라이언트 직접 조회 금지', () => {
  const files = [ACTIONS, 'src/app/admin/coupons/page.tsx', 'src/app/admin/coupons/coupon-admin-client.tsx', 'src/lib/coupons/coupon-admin.ts'];
  const banned: [RegExp, string][] = [
    [/\.upsert\(/, 'upsert = 귀속된 행 덮어쓰기'],
    [/\.delete\(/, '행 삭제 금지(079)'],
    [/released_at:\s*null/, 'released 는 종료 상태(080)'],
    [/bound_user_id:\s*null/, '귀속 비우기 = 이미 쓴 전단 재귀속(080)'],
    [/Math\.random/, '추측 가능한 일련번호'],
    [/revalidatePath\(\s*'\/'/, '전역 가격 캐시 무효화'],
  ];
  for (const rel of files) {
    const src = read(rel);
    for (const [re, why] of banned) assert.ok(!re.test(src), `${rel}: ${why}`);
  }
  for (const rel of [ACTIONS, 'src/app/admin/coupons/page.tsx']) {
    assert.ok(!/\.from\(/.test(read(rel)), `${rel}: 쿠폰 테이블은 coupon-admin.ts 의 service 함수로만(세션 클라이언트는 오류 없이 0행)`);
  }
});

test('읽기 액션은 화면을 다시 그리지 않고, 내보내기는 감사 기록이 성공한 뒤에만 CSV 를 돌려주며, 발급 응답엔 코드가 없다', () => {
  const src = read(ACTIONS);
  const body = (name: string) => src.slice(src.indexOf(`export async function ${name}`)).split(/\nexport async function /)[0];
  for (const name of ['lookupHolderAction', 'exportBatchAction']) assert.ok(!/refresh\(|revalidate/.test(body(name)), name);
  const exp = body('exportBatchAction');
  assert.ok(exp.includes('recordCouponAudit(') && exp.indexOf('recordCouponAudit(') < exp.indexOf('csv:'), '감사 → 반환 순서');
  assert.ok(!/codes/.test(body('issueBatchAction')), '발급 응답에 코드 없음 — 코드는 내보내기로만');
});

test('src/lib/coupons·admin/coupons 의 소스에 NUL·원시 제어 바이트가 없다(git 이 바이너리로 보면 돈 경로 diff 를 리뷰할 수 없다)', () => {
  for (const dir of ['src/lib/coupons', 'src/app/admin/coupons']) {
    for (const name of fs.readdirSync(path.join(ROOT, dir)).filter((n) => /\.tsx?$/.test(n))) {
      const buf = fs.readFileSync(path.join(ROOT, dir, name));
      assert.ok(!buf.some((b) => b < 9 || (b > 13 && b < 32)), `${dir}/${name}`);
    }
  }
});

// 탈퇴는 payment_orders 를 cascade 로 지운다 → 결제한 쿠폰도 "붙잡는 주문 없음"이 되어 24h 회수로 남에게 넘어간다.
//   계정 삭제 경로가 새로 생겨도 여기서 걸린다.
test('계정을 지우는 모든 경로는 그 전에 쿠폰을 종료한다(releaseCouponsOfUser)', () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name) ? [full] : [];
    });
  const deleters = walk(path.join(ROOT, 'src')).filter((f) => /auth\.admin\.deleteUser\(/.test(fs.readFileSync(f, 'utf8')));
  assert.ok(deleters.length >= 2, '계정 삭제 경로를 못 찾았다 — 스캔이 조용히 0건이면 가드가 무의미하다');
  for (const file of deleters) {
    const text = fs.readFileSync(file, 'utf8');
    const release = text.indexOf('releaseCouponsOfUser(');
    assert.ok(release > -1 && release < text.indexOf('auth.admin.deleteUser('), path.relative(ROOT, file));
  }
});
