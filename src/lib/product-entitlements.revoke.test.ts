import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveEntitlementRevokeQuery, revokeEntitlementsOfPayment } from './product-entitlements';
import { buildLifetimeReportScopeKey, buildTodayDetailScopeKey } from './payments/product-scope';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// ─────────────────────────────────────────────────────────────
// 2026-09-13 — 환불·PG 취소 회수는 **그 결제가 만든 권한만** 지운다(결제키 기준).
//   (user, product, scope) 로 지우면 유니크 행을 먼저 산 주문이 차지하고 있어 따로 산 같은 이용권·무료 지급까지 지워졌고,
//   주문 단위 환불은 패키지 id 로 찾아 아무것도 못 지웠고, 전역 상품은 레거시 scopeKey(null) ≠ 회수 필터('global')라
//   환불 뒤에도 열람이 되살아났다(프로덕션 실측: 환불·취소 주문의 레거시 행 10개 생존).
// ─────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;

/** delete().eq().in().contains().select() · insert() 만 흉내 — SQL 처럼 `NULL = x` 는 참이 아니다. */
function fakeService(tables: Record<string, Row[]>) {
  const inserted: Row[] = [];
  const client = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let deleting = false;
      const chain = {
        delete: () => ((deleting = true), chain),
        eq: (col: string, val: unknown) => (filters.push((r) => r[col] != null && r[col] === val), chain),
        in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), chain),
        contains: (col: string, obj: Row) =>
          (filters.push((r) => Object.entries(obj).every(([k, v]) => (r[col] as Row | null)?.[k] === v)), chain),
        select: () => {
          const hits = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
          if (deleting) tables[table] = (tables[table] ?? []).filter((r) => !hits.includes(r));
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
  return { client: client as unknown as SupabaseClient, tables, inserted };
}

const legacy = (userId: string, meta: Row) => ({
  user_id: userId,
  type: 'purchase',
  feature: 'taste_product',
  metadata: { kind: 'taste_product', ...meta },
});

test('결제키 회수 — 그 결제가 만든 이용권·레거시 행만 지우고, 따로 산 것·무료 지급·다른 원장은 남긴다', async () => {
  const db = fakeService({
    product_entitlements: [
      // 단품을 먼저 샀다 → (user, product, scope) 유니크 행을 이 주문이 차지. 번들은 이 구성품에 자기 행이 없다.
      { user_id: 'u1', product_id: 'score-total', scope_key: 'reading:rk', order_id: 'ord_a', payment_key: 'pk_a', amount: 3300 },
      { user_id: 'u1', product_id: 'today-detail', scope_key: 'today:rk', order_id: 'ord_b', payment_key: 'pk_b', amount: null },
      { user_id: 'u1', product_id: 'money-pattern', scope_key: 'global', order_id: 'ord_b', payment_key: 'pk_b', amount: null },
      { user_id: 'u1', product_id: 'work-flow', scope_key: 'global', order_id: null, payment_key: null, amount: 0 }, // 무료 지급
      { user_id: 'u2', product_id: 'today-detail', scope_key: 'today:rk2', order_id: 'ord_c', payment_key: 'pk_b', amount: 3300 },
    ],
    credit_transactions: [
      legacy('u1', { productId: 'score-total', scopeKey: 'reading:rk', orderId: 'ord_a', paymentKey: 'pk_a' }),
      legacy('u1', { productId: 'score-total', scopeKey: 'reading:rk', orderId: 'ord_b', paymentKey: 'pk_b' }), // 번들 몫(흡수)
      legacy('u1', { productId: 'money-pattern', scopeKey: null, orderId: 'ord_b', paymentKey: 'pk_b' }), // 전역 — 되살아남의 원천
      legacy('u1', { productId: 'work-flow', scopeKey: null, orderId: null, paymentKey: null }), // 무료 지급
      { user_id: 'u1', type: 'purchase', feature: 'credit_purchase', metadata: { paymentKey: 'pk_b', amount: 9900 } }, // 같은 결제키의 원장
      { user_id: 'u1', type: 'purchase', feature: 'entitlement_revoke', metadata: { kind: 'entitlement_revoked', paymentKey: 'pk_b' } },
      legacy('u2', { productId: 'today-detail', scopeKey: 'today:rk2', orderId: 'ord_c', paymentKey: 'pk_b' }), // 다른 사용자
    ],
  });

  const result = await revokeEntitlementsOfPayment('u1', 'pk_b', { reason: 'admin_refund', actor: 'admin' }, db.client);

  assert.deepEqual(result, { revoked: true, productTableDeleted: 2, legacyDeleted: 2 });
  assert.deepEqual(
    db.tables.product_entitlements.map((r) => `${r.user_id}:${r.product_id}`),
    ['u1:score-total', 'u1:work-flow', 'u2:today-detail'],
    '따로 산 score-total · 무료 work-flow · 다른 사용자 행은 남는다'
  );
  const legacyLeft = db.tables.credit_transactions.map((r) => `${r.user_id}:${r.feature}:${(r.metadata as Row).productId ?? (r.metadata as Row).kind}`);
  assert.deepEqual(legacyLeft, [
    'u1:taste_product:score-total', // ord_a 몫 — 번들 환불이 단품 몫을 지우면 안 된다
    'u1:taste_product:work-flow',
    'u1:credit_purchase:undefined',
    'u1:entitlement_revoke:entitlement_revoked',
    'u2:taste_product:today-detail',
  ]);
  assert.deepEqual(
    db.inserted.map((r) => [r.feature, (r.metadata as Row).productId, (r.metadata as Row).paymentKey]),
    [
      ['entitlement_revoke', 'today-detail', 'pk_b'],
      ['entitlement_revoke', 'money-pattern', 'pk_b'],
    ],
    '지운 이용권마다 감사 행'
  );
});

test('결제키 회수 — 이용권 행 없이 레거시에만 남은 권한도 회수하고, 아무것도 없으면 revoked=false(고아 주문)', async () => {
  const legacyOnly = fakeService({
    product_entitlements: [],
    credit_transactions: [legacy('u1', { productId: 'compat-reading', scopeKey: 'compat:x', orderId: 'ord_l', paymentKey: 'pk_l' })],
  });
  assert.deepEqual(await revokeEntitlementsOfPayment('u1', 'pk_l', { reason: 'r' }, legacyOnly.client), {
    revoked: true,
    productTableDeleted: 0,
    legacyDeleted: 1,
  });
  assert.equal((legacyOnly.inserted[0].metadata as Row).productId, 'compat-reading');

  const orphan = fakeService({ product_entitlements: [], credit_transactions: [] });
  assert.deepEqual(await revokeEntitlementsOfPayment('u1', 'pk_o', { reason: 'r' }, orphan.client), {
    revoked: false,
    productTableDeleted: 0,
    legacyDeleted: 0,
  });
  assert.equal(orphan.inserted.length, 0);
});

test('결제키 회수 — 결제키·사용자가 비면 던진다(넓게 지우는 경로를 만들지 않는다)', async () => {
  const db = fakeService({
    product_entitlements: [{ user_id: 'u1', product_id: 'work-flow', scope_key: 'global', order_id: null, payment_key: null }],
    credit_transactions: [legacy('u1', { productId: 'work-flow', scopeKey: null, orderId: null, paymentKey: null })],
  });
  for (const [userId, paymentKey] of [['u1', null], ['u1', ''], ['', 'pk_a']] as const) {
    await assert.rejects(revokeEntitlementsOfPayment(userId, paymentKey, { reason: 'r' }, db.client));
  }
  assert.equal(db.tables.product_entitlements.length, 1);
  assert.equal(db.tables.credit_transactions.length, 1);
});

// 라우트·웹훅은 DB·PG 를 직접 불러 행동 테스트가 안 된다 — 호출 경로를 소스로 고정한다.
test('환불·PG 취소 회수 경로는 전부 결제키 회수를 쓰고, (상품, 범위) 회수는 관리자 수동 회수에만 남는다', () => {
  const src = path.resolve(__dirname, '..');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? walk(full) : /\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name) ? [full] : [];
    });
  const files = walk(src).map((f) => ({ rel: path.relative(src, f), text: fs.readFileSync(f, 'utf8') }));
  const callers = (re: RegExp) => files.filter((f) => re.test(f.text) && f.rel !== 'lib/product-entitlements.ts').map((f) => f.rel).sort();
  assert.deepEqual(callers(/\brevokeEntitlementsOfPayment\(/), ['app/api/admin/refund/route.ts', 'app/api/payments/webhook/nicepay/route.ts']);
  assert.deepEqual(callers(/\brevokeProductEntitlement\(/), ['app/api/admin/product-entitlement/revoke/route.ts']);
  const route = files.find((f) => f.rel === 'app/api/admin/refund/route.ts')!.text;
  assert.ok(/revokeEntitlementsOfPayment\(args\.userId, args\.paymentKey,/.test(route));
  const webhook = files.find((f) => f.rel === 'app/api/payments/webhook/nicepay/route.ts')!.text;
  assert.ok(/revokeEntitlementsOfPayment\(order\.userId, order\.paymentKey,/.test(webhook));
});

// 환불 회수가 legacy credit_transactions grant 행을 정확히 겨냥하는지 검증한다.
// 회수가 grant 와 어긋나면 product_entitlements 만 지워지고 legacy 행이 남아
// 조회 2순위(getLifetimeReportEntitlement / getLegacyTasteProductEntitlement)에서
// 권한이 되살아나 "환불 후에도 열람 가능" 회귀가 난다. 아래 기대값은 grant 경로
// (recordLegacyLifetimeReportTransaction / recordLegacyTasteProductTransaction)가
// 저장하는 (feature, metadata.kind, 식별자)와 대칭이어야 한다.

test('revoke query targets lifetime grant by feature + kind + readingKey', () => {
  const query = resolveEntitlementRevokeQuery(
    'lifetime-report',
    buildLifetimeReportScopeKey('reading-abc')
  );
  assert.equal(query.legacyFeature, 'lifetime_report');
  assert.deepEqual(query.legacyMatch, { kind: 'lifetime_report', readingKey: 'reading-abc' });
});

test('revoke query falls back to kind-only when lifetime scope key is malformed', () => {
  const query = resolveEntitlementRevokeQuery('lifetime-report', 'global');
  assert.equal(query.legacyFeature, 'lifetime_report');
  assert.deepEqual(query.legacyMatch, { kind: 'lifetime_report' });
});

test('revoke query targets taste grant by feature + kind + productId + scopeKey', () => {
  const query = resolveEntitlementRevokeQuery('today-detail', buildTodayDetailScopeKey('reading-abc'));
  assert.equal(query.legacyFeature, 'taste_product');
  assert.deepEqual(query.legacyMatch, {
    kind: 'taste_product',
    productId: 'today-detail',
    scopeKey: 'today:reading-abc',
  });
});
