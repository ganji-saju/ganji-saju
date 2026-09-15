// 2026-09-14 — 오늘 자세히(당일권)를 같은 사주로 **다음 날 다시 사면** 결제는 되는데 안 열리던 버그.
//   UNIQUE(user, product, scope_key) 라 새 행을 못 넣고 grant 가 어제 행을 그대로 돌려줬다 → 판정(created_at=오늘)이 false.
//   가짜 DB(유니크 제약 포함)로 grant → 판정까지 실제 함수를 태운다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const db: { rows: Row[] } = { rows: [] };

vi.mock('@/lib/supabase/server', () => {
  function from() {
    const filters: Array<(r: Row) => boolean> = [];
    let insertRow: Row | null = null;
    let patch: Row | null = null;
    const chain: Record<string, unknown> = {
      select: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => chain,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), chain),
      in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), chain),
      gte: (k: string, v: string) => (filters.push((r) => Date.parse(String(r[k])) >= Date.parse(v)), chain),
      lt: (k: string, v: string) => (filters.push((r) => Date.parse(String(r[k])) < Date.parse(v)), chain),
      insert: (row: Row) => ((insertRow = row), chain),
      update: (p: Row) => ((patch = p), chain),
      then: (resolve: (v: unknown) => void) => {
        if (insertRow) {
          const row = insertRow;
          const dup = db.rows.some(
            (r) => r.user_id === row.user_id && r.product_id === row.product_id && r.scope_key === row.scope_key
          );
          if (dup) return resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
          const saved = { id: `e${db.rows.length + 1}`, created_at: new Date().toISOString(), ...row };
          db.rows.push(saved);
          return resolve({ data: saved, error: null });
        }
        const hits = db.rows.filter((r) => filters.every((f) => f(r)));
        if (patch) {
          for (const r of hits) Object.assign(r, patch);
          return resolve({ data: hits[0] ?? null, error: null });
        }
        return resolve({ data: hits, error: null });
      },
    };
    return chain;
  }
  return {
    hasSupabaseServiceEnv: true,
    hasSupabaseServerEnv: true,
    createServiceClient: async () => ({ from }),
    createClient: async () => ({ from }),
  };
});

import { grantProductEntitlement, hasTodayDetailEntitlementForSaju } from './product-entitlements';

const RK = '1975-6-11-14-male-locbusan-solarlongitude-keybbbb2';
const FAMILY = '1990-5-3-14-female-locbusan-solarlongitude-keydddd4';
const at = (iso: string) => vi.setSystemTime(new Date(iso));

describe('오늘 자세히 재구매 — 같은 사주를 다음 날 다시 사면 그날 열린다', () => {
  beforeEach(() => {
    db.rows = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('어제 행을 이 결제로 갱신한다(새 행 없음·결제키 교체) → 오늘 열림', async () => {
    at('2026-09-13T03:00:00.000Z'); // KST 09-13 12:00
    await grantProductEntitlement('u1', 'today-detail', { scopeKey: `today:${RK}`, orderId: 'o1', paymentKey: 'pk1' });
    at('2026-09-14T03:00:00.000Z'); // KST 09-14 12:00
    const granted = await grantProductEntitlement('u1', 'today-detail', {
      scopeKey: `today:${RK}`,
      orderId: 'o2',
      paymentKey: 'pk2',
      amount: 3300,
    });

    expect(granted.orderId).toBe('o2');
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ payment_key: 'pk2', order_id: 'o2', amount: 3300 });
    expect(await hasTodayDetailEntitlementForSaju('u1', '2026-09-14', { readingKey: RK })).toBe(true);
    // 사주 단위는 그대로 — 가족은 닫힘
    expect(await hasTodayDetailEntitlementForSaju('u1', '2026-09-14', { readingKey: FAMILY })).toBe(false);
  });

  it('같은 날 재지급은 기존 행을 그대로(멱등 — 번들·단품 중복, 지급 재시도)', async () => {
    at('2026-09-14T01:00:00.000Z');
    await grantProductEntitlement('u1', 'today-detail', { scopeKey: `today:${RK}`, orderId: 'o1', paymentKey: 'pk1' });
    at('2026-09-14T14:59:00.000Z'); // KST 23:59 — 같은 날
    const again = await grantProductEntitlement('u1', 'today-detail', { scopeKey: `today:${RK}`, orderId: 'o2', paymentKey: 'pk2' });
    expect(again.orderId).toBe('o1');
    expect(db.rows[0]).toMatchObject({ payment_key: 'pk1' });
  });

  it("옛 'global' 행은 건드리지 않고 이 사주 행을 새로 만든다(global 을 오늘로 갱신하면 그날 모든 사주가 열린다)", async () => {
    db.rows.push({ id: 'g1', user_id: 'u1', product_id: 'today-detail', scope_key: 'global', created_at: '2026-06-01T03:00:00.000Z' });
    at('2026-09-14T03:00:00.000Z');
    await grantProductEntitlement('u1', 'today-detail', { scopeKey: `today:${RK}`, orderId: 'o2', paymentKey: 'pk2' });
    expect(db.rows.find((r) => r.id === 'g1')?.created_at).toBe('2026-06-01T03:00:00.000Z');
    expect(await hasTodayDetailEntitlementForSaju('u1', '2026-09-14', { readingKey: RK })).toBe(true);
    expect(await hasTodayDetailEntitlementForSaju('u1', '2026-09-14', { readingKey: FAMILY })).toBe(false);
  });

  it('당일권이 아닌 상품은 지난 행을 그대로 돌려준다(기존 동작)', async () => {
    at('2026-09-01T03:00:00.000Z');
    await grantProductEntitlement('u1', 'money-pattern', { orderId: 'o1', paymentKey: 'pk1' });
    at('2026-09-14T03:00:00.000Z');
    const again = await grantProductEntitlement('u1', 'money-pattern', { orderId: 'o2', paymentKey: 'pk2' });
    expect(again.orderId).toBe('o1');
    expect(db.rows).toHaveLength(1);
  });
});
