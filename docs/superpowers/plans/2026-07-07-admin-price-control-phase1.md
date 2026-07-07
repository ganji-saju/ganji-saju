# 관리자 전상품 가격 제어 — Phase 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** super_admin이 `/admin/pricing`에서 전 상품 가격(현재/과거/변경)을 편집하면, 확인창 후 DB에 저장되고 **신규 결제 청구액**이 즉시 그 값을 쓰도록 하는 런타임 가격 인프라를 구축한다.

**Architecture:** 카탈로그(`PAYMENT_PACKAGES`)를 기본값으로 두고 `product_prices` DB 오버라이드를 얹는 서버 리졸버를 만든다. 결제 주문 생성(prepare) 시 리졸버 값을 `order.amount`로 **스냅샷**하고, confirm/return은 그 스냅샷(order.amount)을 authoritative하게 검증한다(카탈로그 상수 비교는 제거 — 가격 변경 시 정상 주문을 거부하던 중복 가드). admin API/UI는 super_admin 게이트 + 확인창 + append-only 감사.

**Tech Stack:** Next.js 16.2.6 App Router · React 19 · TypeScript · Supabase(service client, RLS deny-all) · 커스텀 유닛러너(`node:assert/strict`) + vitest(`.spec.ts`).

## Global Constraints

- **마이그레이션 수동 적용**: 새 마이그레이션은 사용자가 `supabase db push`로 직접 적용한다. 절대 자동 적용 금지. 리졸버는 테이블 부재/누락 시 카탈로그 기본값으로 graceful fallback(적용 전에도 앱 정상).
- **리졸버는 신규 청구에만**: 환불(`credit-refunds.ts`)·이력(`payment-history.ts`)·이행(`fulfillment.ts`)은 `metadata.amount`/카탈로그 기본값 유지. 리졸버로 바꾸지 말 것(과거 충실도).
- **authoritative 금액 검증 = `order.amount`**: confirm(`confirm/route.ts:66`)·nicepay return(`nicepay/return:208`)의 `order.amount === amount`가 실제 위변조 가드. 카탈로그 상수(`pkg.price`) 비교는 제거한다.
- **과거 주문 불변**: 과거 `payment_orders.amount`·`metadata.amount`는 절대 소급 변경 없음.
- **super_admin 전용**: `/admin/pricing` 페이지·API는 `getCurrentAdminRole` role === 'super_admin'만.
- **금액**: ₩ 정수, > 0.
- **계정/PR**: 커밋은 이 브랜치(`feat/admin-price-control`)에. PR/머지는 `./scripts/gh-ganji`. main 직접 커밋 금지.
- **가격 상수 진실**: 시드/폴백 기본값은 `src/lib/payments/catalog.ts`의 `PAYMENT_PACKAGES[].price` 단일 소스. 마이그레이션에 가격을 하드코딩하지 않는다(리졸버 폴백으로 커버).

---

### Task 1: 마이그레이션 067 — product_prices + product_price_changes

**Files:**
- Create: `supabase/migrations/067_product_prices.sql`

**Interfaces:**
- Produces: 테이블 `public.product_prices(package_id text pk, price int>0, previous_price int null, updated_at timestamptz, updated_by text)` · `public.product_price_changes(id uuid pk, package_id text, old_price int, new_price int, previous_price int, changed_by text, changed_at timestamptz)`. 둘 다 RLS deny-all(service 전용). **시드 없음**(리졸버가 카탈로그 폴백).

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 067_product_prices.sql
-- 날짜: 2026-07-07
-- 목적: 관리자 전상품 가격 제어(Phase 1). 카탈로그(PAYMENT_PACKAGES) 기본가를
--   런타임에 오버라이드 — price-resolver 가 이 테이블 우선, 없으면 카탈로그 폴백.
--   설계: docs/superpowers/specs/2026-07-07-admin-price-control-design.md
-- ⚠️ 프로덕션 적용: 062~066 과 동일하게 수동(supabase db push). 시드 없음 —
--    편집 전 상품은 리졸버가 catalog.ts 기본가로 폴백(단일 진실 = 카탈로그).

-- 1) 런타임 가격 오버라이드. KRW. RLS deny-all(service 전용).
create table if not exists public.product_prices (
  package_id      text primary key,
  price           integer not null check (price > 0),
  previous_price  integer check (previous_price is null or previous_price > 0),
  updated_at      timestamptz not null default now(),
  updated_by      text
);

comment on table public.product_prices is
  '상품 런타임 가격 오버라이드(카탈로그 PAYMENT_PACKAGES 기본가 위). price-resolver 조회 — /admin/pricing 편집.';

alter table public.product_prices enable row level security;
-- 정책 없음(deny-all) — 읽기/쓰기 모두 service role 경유.

-- 2) append-only 가격 변경 감사 이력.
create table if not exists public.product_price_changes (
  id              uuid primary key default gen_random_uuid(),
  package_id      text not null,
  old_price       integer,
  new_price       integer not null,
  previous_price  integer,
  changed_by      text,
  changed_at      timestamptz not null default now()
);

comment on table public.product_price_changes is
  '가격 변경 append-only 감사 이력(누가·언제·old→new). /admin/pricing POST 가 매 변경 기록.';

create index if not exists idx_product_price_changes_pkg_time
  on public.product_price_changes (package_id, changed_at desc);

alter table public.product_price_changes enable row level security;
-- 정책 없음(deny-all).
```

- [ ] **Step 2: SQL 문법 검증(psql dry 없이 육안 + audit 스크립트)**

Run: `npm run audit:migration-numbers`
Expected: 067 이 순번 규칙 통과(중복/역순 없음). 통과 출력.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/067_product_prices.sql
git commit -m "feat(migration): 067 product_prices + product_price_changes(가격 제어)"
```

---

### Task 2: price-resolver — 카탈로그 폴백 + DB 오버라이드

**Files:**
- Create: `src/lib/payments/price-resolver.ts`
- Test: `src/lib/payments/price-resolver.test.ts`

**Interfaces:**
- Consumes: `PAYMENT_PACKAGES`, `getPackage`, `type PackageId` (`@/lib/payments/catalog`); `createServiceClient` (`@/lib/supabase/server`).
- Produces:
  - `interface ResolvedPrice { price: number; previousPrice: number | null }`
  - `mergePricesWithDefaults(rows: DbPriceRow[] | null): Map<PackageId, ResolvedPrice>` (순수)
  - `loadResolvedPrices(service: SupabaseClient): Promise<Map<PackageId, ResolvedPrice>>`
  - `getResolvedPrices(): Promise<Map<PackageId, ResolvedPrice>>` (React `cache`, env 없으면 카탈로그 폴백)
  - `resolvePackagePrice(id: PackageId): Promise<number>`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/payments/price-resolver.test.ts`:

```ts
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mergePricesWithDefaults, loadResolvedPrices } from './price-resolver';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function fakeService(rows: unknown[] | null, error: unknown = null): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => Promise.resolve({ data: rows, error });
  return { from: () => chain } as unknown as SupabaseClient;
}

test('mergePricesWithDefaults: 오버라이드 없으면 전 상품 카탈로그 기본가', () => {
  const merged = mergePricesWithDefaults(null);
  const today = getPackage('taste_today_detail');
  assert.equal(merged.get('taste_today_detail')?.price, today?.price);
  assert.equal(merged.get('taste_today_detail')?.previousPrice, null);
  // 카탈로그 전 상품이 포함된다.
  assert.equal(merged.has('membership_premium'), true);
});

test('mergePricesWithDefaults: DB 행이 카탈로그 기본가를 오버라이드', () => {
  const merged = mergePricesWithDefaults([
    { package_id: 'taste_today_detail', price: 12000, previous_price: 9900 },
  ]);
  assert.equal(merged.get('taste_today_detail')?.price, 12000);
  assert.equal(merged.get('taste_today_detail')?.previousPrice, 9900);
  // 오버라이드 안 된 상품은 여전히 카탈로그 기본가.
  assert.equal(merged.get('membership_premium')?.price, getPackage('membership_premium')?.price);
});

test('mergePricesWithDefaults: 카탈로그에 없는 package_id 는 무시', () => {
  const merged = mergePricesWithDefaults([
    { package_id: 'ghost_pack', price: 100, previous_price: null },
  ]);
  assert.equal(merged.has('ghost_pack' as never), false);
});

test('loadResolvedPrices: DB 오류면 카탈로그 폴백', async () => {
  const merged = await loadResolvedPrices(fakeService(null, { message: 'boom' }));
  assert.equal(merged.get('taste_today_detail')?.price, getPackage('taste_today_detail')?.price);
});

test('loadResolvedPrices: DB 행 반영', async () => {
  const merged = await loadResolvedPrices(
    fakeService([{ package_id: 'credit_15', price: 8000, previous_price: null }])
  );
  assert.equal(merged.get('credit_15')?.price, 8000);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test 2>&1 | grep -iE "price-resolver|FAIL|Error" | head`
Expected: FAIL — `Cannot find module './price-resolver'` 류.

- [ ] **Step 3: 리졸버 구현**

`src/lib/payments/price-resolver.ts`:

```ts
// 2026-07-07 — 런타임 가격 리졸버. 카탈로그(PAYMENT_PACKAGES) 기본가 위에
//   product_prices DB 오버라이드를 얹는다. 결제 주문 생성 시점 스냅샷에만 사용
//   (환불/이력/이행은 실결제액 유지 — 설계문서 참조).
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAYMENT_PACKAGES, getPackage, type PackageId } from './catalog';
import { createServiceClient } from '@/lib/supabase/server';

export interface ResolvedPrice {
  price: number;
  previousPrice: number | null;
}

export interface DbPriceRow {
  package_id: string;
  price: number;
  previous_price: number | null;
}

const VALID_IDS = new Set<string>(PAYMENT_PACKAGES.map((pkg) => pkg.id));

function catalogDefaults(): Map<PackageId, ResolvedPrice> {
  const map = new Map<PackageId, ResolvedPrice>();
  for (const pkg of PAYMENT_PACKAGES) {
    map.set(pkg.id, { price: pkg.price, previousPrice: null });
  }
  return map;
}

/** DB 행을 카탈로그 기본가 위에 병합. 카탈로그에 없는 id·비정수 price 는 무시. */
export function mergePricesWithDefaults(rows: DbPriceRow[] | null): Map<PackageId, ResolvedPrice> {
  const merged = catalogDefaults();
  for (const row of rows ?? []) {
    if (!VALID_IDS.has(row.package_id)) continue;
    if (!Number.isInteger(row.price) || row.price <= 0) continue;
    merged.set(row.package_id as PackageId, {
      price: row.price,
      previousPrice: row.previous_price ?? null,
    });
  }
  return merged;
}

export async function loadResolvedPrices(
  service: SupabaseClient
): Promise<Map<PackageId, ResolvedPrice>> {
  const { data, error } = await service
    .from('product_prices')
    .select('package_id, price, previous_price');
  if (error || !data) return catalogDefaults();
  return mergePricesWithDefaults(data as DbPriceRow[]);
}

function hasSupabaseServiceEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** per-request 캐시. env 없으면(CI/preview) 카탈로그 폴백. */
export const getResolvedPrices = cache(async (): Promise<Map<PackageId, ResolvedPrice>> => {
  if (!hasSupabaseServiceEnv()) return catalogDefaults();
  try {
    const service = await createServiceClient();
    return await loadResolvedPrices(service);
  } catch {
    return catalogDefaults();
  }
});

/** 단일 상품의 현재 가격(폴백 포함). */
export async function resolvePackagePrice(id: PackageId): Promise<number> {
  const prices = await getResolvedPrices();
  const resolved = prices.get(id);
  if (resolved) return resolved.price;
  return getPackage(id)?.price ?? 0;
}
```

- [ ] **Step 4: 테스트 통과 확인 + typecheck**

Run: `npm test 2>&1 | grep -iE "price-resolver" ; npx tsc --noEmit`
Expected: price-resolver 5개 통과, tsc 무출력(0 오류).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/payments/price-resolver.ts src/lib/payments/price-resolver.test.ts
git commit -m "feat(payments): price-resolver(카탈로그 폴백+DB 오버라이드)"
```

---

### Task 3: 머니패스 스냅샷 전환 (order.amount authoritative)

**Files:**
- Modify: `src/lib/payments/order-ledger.ts:166-201` (createPaymentOrder — `amount` 파라미터 추가)
- Modify: `src/app/api/payments/prepare/route.ts:278` (resolve 후 amount 전달)
- Modify: `src/lib/payments/confirmation.ts:55-58` (카탈로그 상수 비교 제거)
- Modify: `src/app/api/payments/nicepay/return/route.ts:208` (카탈로그 상수 절 제거)
- Modify(test): `src/lib/payments/confirmation.test.ts:32-44`
- Modify(test): `src/lib/payments/payment-duplicate-audit.spec.ts:80-92`

**Interfaces:**
- Consumes: `resolvePackagePrice(id)` (Task 2).
- Produces: `createPaymentOrder` 입력에 `amount: number` 필수 필드 추가(주문 스냅샷 금액).

**배경:** `confirm/route.ts:66`이 이미 `order.amount !== parsedAmount → 거부`한다. `nicepay/return:208`도 `order.amount !== amount`. 따라서 `confirmation.ts`·`nicepay/return`의 `pkg.price !== amount`(카탈로그 상수)는 **중복 가드**이며, 가격 변경 시 (order.amount=신가 vs 상수=구가)로 **정상 주문을 거부**한다. 스냅샷을 order.amount에 넣고 상수 비교를 없앤다.

- [ ] **Step 1: order-ledger 실패 테스트 작성**

`src/lib/payments/order-ledger.snapshot.test.ts` (신규):

```ts
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPaymentOrder } from './order-ledger';
import { getPackage } from './catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

// insert(payload).select().single() 체인을 캡처하는 fake.
function fakeService(capture: { payload?: Record<string, unknown> }): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.insert = (payload: Record<string, unknown>) => {
    capture.payload = payload;
    return chain;
  };
  chain.select = () => chain;
  chain.single = () =>
    Promise.resolve({ data: { order_id: 'o1', ...capture.payload }, error: null });
  return { from: () => chain } as unknown as SupabaseClient;
}

test('createPaymentOrder: order.amount = 전달된 스냅샷 amount(카탈로그 price 아님)', async () => {
  const capture: { payload?: Record<string, unknown> } = {};
  const service = fakeService(capture);
  const pkg = getPackage('taste_today_detail')!;
  await createPaymentOrder(
    {
      userId: 'u1',
      pkg,
      amount: 12345, // 카탈로그 9900 과 다른 스냅샷.
      acceptedKinds: [],
      recordedPolicyVersionIds: [],
    },
    service
  );
  assert.equal(capture.payload?.amount, 12345);
  assert.equal(capture.payload?.package_id, 'taste_today_detail');
});
```

> 참고: `createPaymentOrder`는 현재 내부에서 `createServiceClient()`를 부른다. 테스트 주입을 위해 **선택적 2번째 인자 `service?: SupabaseClient`** 를 추가한다(미전달 시 기존대로 생성).

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test 2>&1 | grep -iE "order-ledger.snapshot|amount|FAIL" | head`
Expected: FAIL — `amount` 파라미터 미존재로 타입/런타임 불일치(payload.amount === 9900).

- [ ] **Step 3: order-ledger 수정**

`src/lib/payments/order-ledger.ts` — `createPaymentOrder` 시그니처에 `amount` + 선택 `service` 인자 추가, insert의 `amount` 를 `input.amount` 로:

```ts
export async function createPaymentOrder(
  input: {
    userId: string;
    pkg: PaymentPackage;
    amount: number; // 2026-07-07 — 리졸버 스냅샷가(카탈로그 price 아님). prepare 가 전달.
    slug?: string | null;
    scope?: string | null;
    product?: string | null;
    plan?: string | null;
    entrySource?: string | null;
    paymentMethodCode?: string | null;
    acceptedKinds: PolicyKind[];
    recordedPolicyVersionIds: string[];
    metadata?: Record<string, unknown>;
  },
  service?: SupabaseClient
) {
  const client = service ?? (await createServiceClient());
  const orderId = generatePaymentOrderId();
  const { data, error } = await client
    .from('payment_orders')
    .insert({
      order_id: orderId,
      user_id: input.userId,
      package_id: input.pkg.id,
      amount: input.amount,
      currency: 'KRW',
      status: 'prepared',
      slug: input.slug ?? null,
      scope: input.scope ?? null,
      product: input.product ?? null,
      plan: input.plan ?? null,
      entry_source: input.entrySource ?? null,
      payment_method_code: input.paymentMethodCode ?? null,
      accepted_policy_kinds: input.acceptedKinds,
      recorded_policy_version_ids: input.recordedPolicyVersionIds,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single();
```

> `SupabaseClient` 타입 import 가 없으면 파일 상단에 `import type { SupabaseClient } from '@supabase/supabase-js';` 추가. 나머지 함수 본문(error 처리·return)은 그대로.

- [ ] **Step 4: prepare 에서 리졸버 스냅샷 전달**

`src/app/api/payments/prepare/route.ts` — 상단 import 에 `import { resolvePackagePrice } from '@/lib/payments/price-resolver';` 추가. `createPaymentOrder({ ... })` 호출(278행) 직전에 resolve 하고 `amount` 전달:

```ts
  const resolvedAmount = await resolvePackagePrice(pkg.id);
  const order = await createPaymentOrder({
    userId: user.id,
    pkg,
    amount: resolvedAmount,
    slug,
    scope,
    product,
    plan,
    entrySource: from,
    paymentMethodCode,
    acceptedKinds,
    recordedPolicyVersionIds: [],
    metadata: { checkoutPath, provider: getPaymentProvider() },
  });
```

- [ ] **Step 5: confirmation.ts 상수 비교 제거**

`src/lib/payments/confirmation.ts:55-58` 를:

```ts
  const pkg = getPackage(packageId);
  if (!pkg || !(amount > 0)) {
    return { ok: false, error: '잘못된 결제 정보입니다.' };
  }
```

로 교체(카탈로그 `pkg.price !== amount` 삭제 — 정확한 금액 정합은 confirm/route 의 order.amount 비교가 담당). 상단에 근거 주석 1줄 추가:

```ts
  // 2026-07-07 — 금액 정합은 confirm/route 의 order.amount(prepare 스냅샷) 비교가
  //   authoritative. 여기 카탈로그 상수 비교는 가격 변경 시 정상 주문을 거부해 제거.
```

- [ ] **Step 6: nicepay/return 상수 절 제거**

`src/app/api/payments/nicepay/return/route.ts:208` 의
`if (order.amount !== amount || pkg.price !== amount) {` 를
`if (order.amount !== amount) {` 로 교체.

- [ ] **Step 7: 기존 테스트 2건을 새 불변식으로 갱신**

`src/lib/payments/confirmation.test.ts:32-44` 를 교체:

```ts
test('payment confirmation accepts a known package regardless of quoted amount (route enforces order.amount)', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 100, // 카탈로그가와 달라도 payload 검증은 통과 — 정확 매칭은 confirm/route 의 order.amount 담당.
    packageId: 'membership_premium',
  });
  assert.equal(result.ok, true);
});

test('payment confirmation rejects non-positive amount', () => {
  const result = validatePaymentConfirmationPayload({
    paymentKey: 'pay_123',
    orderId: 'order_123',
    amount: 0,
    packageId: 'membership_premium',
  });
  assert.equal(result.ok, false);
});
```

`src/lib/payments/payment-duplicate-audit.spec.ts:80-92` 의 `카탈로그 가격과 다른 amount 가 들어오면 거부한다` it 블록을 교체:

```ts
  it('알 수 없는 패키지 또는 비정상 금액이면 거부한다(정확 금액은 order.amount 가 검증)', () => {
    // 2026-07-07 — 정확 금액 정합은 confirm/route 의 order.amount(prepare 스냅샷) 비교로 이동.
    //   payload 검증은 known package + 양수 amount 만 강제.
    const unknownPkg = validatePaymentConfirmationPayload({
      paymentKey: 'test_pk_dummy',
      orderId: 'test_order_x',
      amount: 9900,
      packageId: 'nonexistent_package',
      slug: null,
    });
    expect(unknownPkg.ok).toBe(false);

    const nonPositive = validatePaymentConfirmationPayload({
      paymentKey: 'test_pk_dummy',
      orderId: 'test_order_y',
      amount: 0,
      packageId: 'taste_today_detail',
      slug: 'test-slug',
    });
    expect(nonPositive.ok).toBe(false);
  });
```

- [ ] **Step 8: 전 테스트 + typecheck**

Run: `npm test 2>&1 | tail -5 ; npx vitest run src/lib/payments/payment-duplicate-audit.spec.ts 2>&1 | tail -8 ; npx tsc --noEmit`
Expected: 커스텀러너 전건 통과(신규 order-ledger.snapshot 1 + 갱신 confirmation 2 포함) · vitest spec 통과 · tsc 0 오류.

- [ ] **Step 9: 커밋**

```bash
git add src/lib/payments/order-ledger.ts src/app/api/payments/prepare/route.ts src/lib/payments/confirmation.ts src/app/api/payments/nicepay/return/route.ts src/lib/payments/order-ledger.snapshot.test.ts src/lib/payments/confirmation.test.ts src/lib/payments/payment-duplicate-audit.spec.ts
git commit -m "feat(payments): 주문 금액을 리졸버 스냅샷으로(confirm=order.amount authoritative)"
```

---

### Task 4: product-pricing 라이브러리(목록·변경적용·검증)

**Files:**
- Create: `src/lib/admin/product-pricing.ts`
- Test: `src/lib/admin/product-pricing.test.ts`

**Interfaces:**
- Consumes: `PAYMENT_PACKAGES`, `type PackageId` (`@/lib/payments/catalog`).
- Produces:
  - `interface ProductPriceRow { packageId: PackageId; name: string; price: number; previousPrice: number | null; isOverridden: boolean; updatedAt: string | null }`
  - `listProductPrices(service): Promise<ProductPriceRow[]>`
  - `applyPriceChange(service, input: { packageId: PackageId; price: number; previousPrice: number | null; changedBy: string | null }): Promise<void>`
  - `validatePriceInput(raw): { ok: true; value: {...} } | { ok: false; error: string }`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/admin/product-pricing.test.ts`:

```ts
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listProductPrices, validatePriceInput } from './product-pricing';
import { getPackage } from '@/lib/payments/catalog';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

function fakeList(rows: unknown[]): SupabaseClient {
  const chain: Record<string, unknown> = {};
  chain.select = () => Promise.resolve({ data: rows, error: null });
  return { from: () => chain } as unknown as SupabaseClient;
}

test('listProductPrices: 오버라이드 없으면 카탈로그 기본가 + isOverridden=false', async () => {
  const rows = await listProductPrices(fakeList([]));
  const today = rows.find((r) => r.packageId === 'taste_today_detail');
  assert.equal(today?.price, getPackage('taste_today_detail')?.price);
  assert.equal(today?.isOverridden, false);
  assert.equal(rows.length >= 16, true); // 전 카탈로그 상품.
});

test('listProductPrices: DB 오버라이드 반영 + isOverridden=true', async () => {
  const rows = await listProductPrices(
    fakeList([
      { package_id: 'taste_today_detail', price: 12000, previous_price: 9900, updated_at: '2026-07-07T00:00:00Z' },
    ])
  );
  const today = rows.find((r) => r.packageId === 'taste_today_detail');
  assert.equal(today?.price, 12000);
  assert.equal(today?.previousPrice, 9900);
  assert.equal(today?.isOverridden, true);
});

test('validatePriceInput: 정상', () => {
  const r = validatePriceInput({ packageId: 'credit_15', price: 8000, previousPrice: 9900 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.price, 8000);
});

test('validatePriceInput: 미존재 packageId 거부', () => {
  assert.equal(validatePriceInput({ packageId: 'ghost', price: 100 }).ok, false);
});

test('validatePriceInput: 0/음수/소수 price 거부', () => {
  assert.equal(validatePriceInput({ packageId: 'credit_15', price: 0 }).ok, false);
  assert.equal(validatePriceInput({ packageId: 'credit_15', price: -1 }).ok, false);
  assert.equal(validatePriceInput({ packageId: 'credit_15', price: 9.9 }).ok, false);
});

test('validatePriceInput: previousPrice 빈값이면 null 허용', () => {
  const r = validatePriceInput({ packageId: 'credit_15', price: 8000, previousPrice: '' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.previousPrice, null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -iE "product-pricing|FAIL" | head`
Expected: FAIL — 모듈 미존재.

- [ ] **Step 3: 구현**

`src/lib/admin/product-pricing.ts`:

```ts
// 2026-07-07 — /admin/pricing 백엔드 로직. 전 상품 가격 목록 + 변경 적용(upsert + 감사).
import type { SupabaseClient } from '@supabase/supabase-js';
import { PAYMENT_PACKAGES, type PackageId } from '@/lib/payments/catalog';

export interface ProductPriceRow {
  packageId: PackageId;
  name: string;
  price: number;
  previousPrice: number | null;
  isOverridden: boolean;
  updatedAt: string | null;
}

interface DbRow {
  package_id: string;
  price: number;
  previous_price: number | null;
  updated_at: string;
}

const VALID_IDS = new Set<string>(PAYMENT_PACKAGES.map((p) => p.id));

export async function listProductPrices(service: SupabaseClient): Promise<ProductPriceRow[]> {
  const { data } = await service
    .from('product_prices')
    .select('package_id, price, previous_price, updated_at');
  const overrides = new Map<string, DbRow>();
  for (const row of (data as DbRow[] | null) ?? []) {
    if (VALID_IDS.has(row.package_id)) overrides.set(row.package_id, row);
  }
  return PAYMENT_PACKAGES.map((pkg) => {
    const o = overrides.get(pkg.id);
    return {
      packageId: pkg.id,
      name: pkg.name,
      price: o ? o.price : pkg.price,
      previousPrice: o ? o.previous_price : null,
      isOverridden: Boolean(o),
      updatedAt: o ? o.updated_at : null,
    };
  });
}

export interface ApplyPriceChangeInput {
  packageId: PackageId;
  price: number;
  previousPrice: number | null;
  changedBy: string | null;
}

export async function applyPriceChange(
  service: SupabaseClient,
  input: ApplyPriceChangeInput
): Promise<void> {
  // 감사 old_price = 현재 오버라이드가(없으면 카탈로그 기본가).
  const { data: current } = await service
    .from('product_prices')
    .select('price')
    .eq('package_id', input.packageId)
    .maybeSingle();
  const catalogDefault = PAYMENT_PACKAGES.find((p) => p.id === input.packageId)?.price ?? null;
  const oldPrice = (current as { price?: number } | null)?.price ?? catalogDefault;

  const { error: upsertError } = await service.from('product_prices').upsert(
    {
      package_id: input.packageId,
      price: input.price,
      previous_price: input.previousPrice,
      updated_at: new Date().toISOString(),
      updated_by: input.changedBy,
    },
    { onConflict: 'package_id' }
  );
  if (upsertError) throw new Error(`product_prices upsert 실패: ${upsertError.message}`);

  const { error: auditError } = await service.from('product_price_changes').insert({
    package_id: input.packageId,
    old_price: oldPrice,
    new_price: input.price,
    previous_price: input.previousPrice,
    changed_by: input.changedBy,
  });
  if (auditError) throw new Error(`product_price_changes insert 실패: ${auditError.message}`);
}

export type ValidatedPriceInput = {
  packageId: PackageId;
  price: number;
  previousPrice: number | null;
};

export function validatePriceInput(
  raw: { packageId?: unknown; price?: unknown; previousPrice?: unknown } | null
):
  | { ok: true; value: ValidatedPriceInput }
  | { ok: false; error: string } {
  const packageId = raw?.packageId;
  const price = raw?.price;
  const previousPrice = raw?.previousPrice;

  if (typeof packageId !== 'string' || !VALID_IDS.has(packageId)) {
    return { ok: false, error: `알 수 없는 상품: ${String(packageId)}` };
  }
  if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0) {
    return { ok: false, error: '변경가격은 1 이상의 정수여야 합니다.' };
  }
  let prev: number | null = null;
  if (previousPrice !== null && previousPrice !== undefined && previousPrice !== '') {
    if (typeof previousPrice !== 'number' || !Number.isInteger(previousPrice) || previousPrice <= 0) {
      return { ok: false, error: '과거가격은 비우거나 1 이상의 정수여야 합니다.' };
    }
    prev = previousPrice;
  }
  return { ok: true, value: { packageId: packageId as PackageId, price, previousPrice: prev } };
}
```

- [ ] **Step 4: 통과 + typecheck**

Run: `npm test 2>&1 | grep -iE "product-pricing" ; npx tsc --noEmit`
Expected: product-pricing 6개 통과, tsc 0 오류.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/admin/product-pricing.ts src/lib/admin/product-pricing.test.ts
git commit -m "feat(admin): product-pricing 라이브러리(목록·변경적용·검증)"
```

---

### Task 5: admin API `/api/admin/pricing` (super_admin GET/POST)

**Files:**
- Create: `src/app/api/admin/pricing/route.ts`

**Interfaces:**
- Consumes: `getCurrentAdminRole` (`@/lib/admin-auth`); `createClient`, `createServiceClient` (`@/lib/supabase/server`); `listProductPrices`, `applyPriceChange`, `validatePriceInput` (Task 4).
- Produces: `GET → { ok, items: ProductPriceRow[] }` · `POST(body {packageId,price,previousPrice}) → { ok, items } | { ok:false, error }`. super_admin 아니면 401/403.

- [ ] **Step 1: 라우트 구현**

`src/app/api/admin/pricing/route.ts`:

```ts
// 2026-07-07 — 전상품 가격 편집 API. super_admin 전용.
//   GET  /api/admin/pricing        — 전 상품 현재/과거가
//   POST /api/admin/pricing        — { packageId, price, previousPrice } 변경(즉시 반영 + 감사)
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import {
  applyPriceChange,
  listProductPrices,
  validatePriceInput,
} from '@/lib/admin/product-pricing';

export const runtime = 'nodejs';

async function guardSuperAdmin(): Promise<
  { ok: true; userId: string | null } | { ok: false; res: NextResponse }
> {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok) {
    return {
      ok: false,
      res: NextResponse.json(
        { ok: false, error: guard.reason },
        { status: guard.reason === 'unauthenticated' ? 401 : 403 }
      ),
    };
  }
  if (guard.role !== 'super_admin') {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: 'super_admin 권한이 필요합니다.' }, { status: 403 }),
    };
  }
  return { ok: true, userId: guard.userId };
}

export async function GET() {
  const g = await guardSuperAdmin();
  if (!g.ok) return g.res;
  const service = await createServiceClient();
  const items = await listProductPrices(service);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const g = await guardSuperAdmin();
  if (!g.ok) return g.res;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = validatePriceInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const service = await createServiceClient();
  try {
    await applyPriceChange(service, { ...parsed.value, changedBy: g.userId ?? null });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
  const items = await listProductPrices(service);
  return NextResponse.json({ ok: true, items });
}
```

- [ ] **Step 2: typecheck + 정적 검증**

Run: `npx tsc --noEmit`
Expected: 0 오류. (권한/검증 로직은 Task 4 테스트가 커버 — 라우트는 얇은 glue.)

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/admin/pricing/route.ts
git commit -m "feat(admin): /api/admin/pricing(super_admin 전상품 가격 GET/POST)"
```

---

### Task 6: admin 페이지 + 편집 UI + nav + 안내 배너

**Files:**
- Create: `src/app/admin/pricing/page.tsx`
- Create: `src/app/admin/pricing/pricing-admin-client.tsx`
- Modify: `src/lib/admin/nav.ts` (운영 도구 그룹에 super_admin 항목)

**Interfaces:**
- Consumes: `getCurrentAdminRole`, `createClient`, `createServiceClient`, `listProductPrices`, `AdminPage`.
- Produces: `/admin/pricing` 화면(super_admin 전용, 확인창 + POST).

- [ ] **Step 1: 서버 페이지**

`src/app/admin/pricing/page.tsx`:

```tsx
// 2026-07-07 — 전상품 가격 관리(super_admin). 현재/과거/변경가 입력 + 확인창.
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminPage } from '@/components/admin/admin-page';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { listProductPrices } from '@/lib/admin/product-pricing';
import { PricingAdminClient } from './pricing-admin-client';

export const metadata: Metadata = {
  title: '가격 관리 (admin)',
  description: '전 상품 가격 변경(즉시 청구 반영).',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PricingAdminPage() {
  const supabase = await createClient();
  const guard = await getCurrentAdminRole(supabase);
  if (!guard.ok || guard.role !== 'super_admin') redirect('/admin');

  const service = await createServiceClient();
  const items = await listProductPrices(service);

  return (
    <AdminPage
      title="가격 관리"
      description="전 상품 가격을 변경합니다. 저장 즉시 신규 결제 청구액에 반영됩니다."
    >
      <PricingAdminClient initialItems={JSON.parse(JSON.stringify(items))} />
    </AdminPage>
  );
}
```

- [ ] **Step 2: 클라이언트 편집 UI**

`src/app/admin/pricing/pricing-admin-client.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface Item {
  packageId: string;
  name: string;
  price: number;
  previousPrice: number | null;
  isOverridden: boolean;
  updatedAt: string | null;
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function PricingAdminClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [drafts, setDrafts] = useState<Record<string, { previous: string; next: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftFor = (id: string) => drafts[id] ?? { previous: '', next: '' };
  const setDraft = (id: string, patch: Partial<{ previous: string; next: string }>) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(id), ...patch } }));

  async function submit(item: Item) {
    setError(null);
    const draft = draftFor(item.packageId);
    const next = Number(draft.next);
    if (!Number.isInteger(next) || next <= 0) {
      setError(`${item.name}: 변경가격은 1 이상의 정수여야 합니다.`);
      return;
    }
    const previous = draft.previous.trim() === '' ? null : Number(draft.previous);
    if (previous !== null && (!Number.isInteger(previous) || previous <= 0)) {
      setError(`${item.name}: 과거가격은 비우거나 1 이상의 정수여야 합니다.`);
      return;
    }
    const ok = window.confirm(
      `${item.name}\n현재 ${won(item.price)} → 변경 ${won(next)}\n\n한 번 변경하면 되돌릴 수 없습니다. 실서비스 청구액에 즉시 반영됩니다. 계속할까요?`
    );
    if (!ok) return;

    setBusy(item.packageId);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageId: item.packageId, price: next, previousPrice: previous }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? '저장 실패');
        return;
      }
      setItems(json.items as Item[]);
      setDraft(item.packageId, { previous: '', next: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '네트워크 오류');
    } finally {
      setBusy(null);
    }
  }

  const th = 'px-3 py-2 text-left text-[12px] font-bold text-[var(--app-copy-soft)]';
  const td = 'px-3 py-2 text-[13px]';
  const input =
    'w-24 rounded-[8px] border border-[var(--app-line)] px-2 py-1 text-right text-[13px] tabular-nums';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[12px] border border-[var(--app-gold,#D59B2E)] bg-[var(--app-gold,#D59B2E)]/10 p-3 text-[12.5px] leading-relaxed text-[var(--app-ink)]">
        ⚠️ 표시 단일화(Phase 2) 적용 전에는 가격 변경 시 <b>화면 표시가</b>가 실제 청구액과 다를 수
        있습니다(페이월 카드·마케팅 문구는 추후 자동 반영). 실제 운영 가격 변경은 Phase 2 완료 후 권장합니다.
      </div>

      {error && (
        <div className="rounded-[10px] border border-[var(--app-coral)] bg-[var(--app-coral)]/5 p-3 text-[13px] text-[var(--app-ink)]">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-[12px] border border-[var(--app-line)] bg-white">
        <table className="w-full border-collapse">
          <thead className="border-b border-[var(--app-line)] bg-[var(--app-pink-soft)]">
            <tr>
              <th className={th}>상품</th>
              <th className={`${th} text-right`}>현재가격</th>
              <th className={`${th} text-right`}>과거가격(취소선용)</th>
              <th className={`${th} text-right`}>변경가격</th>
              <th className={`${th} text-right`}>적용</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const draft = draftFor(item.packageId);
              return (
                <tr key={item.packageId} className="border-t border-[var(--app-line)]">
                  <td className={`${td} font-semibold text-[var(--app-ink)]`}>
                    {item.name}
                    <span className="ml-1 text-[11px] text-[var(--app-copy-soft)]">
                      {item.packageId}
                      {item.isOverridden ? ' · 편집됨' : ''}
                    </span>
                  </td>
                  <td className={`${td} text-right tabular-nums font-bold`}>{won(item.price)}</td>
                  <td className={`${td} text-right`}>
                    <input
                      className={input}
                      inputMode="numeric"
                      placeholder={item.previousPrice != null ? String(item.previousPrice) : '없음'}
                      value={draft.previous}
                      onChange={(e) => setDraft(item.packageId, { previous: e.target.value })}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <input
                      className={input}
                      inputMode="numeric"
                      placeholder="원 단위"
                      value={draft.next}
                      onChange={(e) => setDraft(item.packageId, { next: e.target.value })}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <button
                      type="button"
                      disabled={busy === item.packageId || draft.next.trim() === ''}
                      onClick={() => submit(item)}
                      className="rounded-[8px] bg-[var(--app-ink)] px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40"
                    >
                      {busy === item.packageId ? '저장 중…' : '수정'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: nav 항목 추가**

`src/lib/admin/nav.ts` — 운영 도구 그룹(`정책·약관` 옆)에 추가:

```ts
      {
        href: '/admin/pricing',
        label: '가격 관리',
        description: '전 상품 가격 변경(즉시 반영)',
        minRole: 'super_admin',
      },
```

- [ ] **Step 4: typecheck + build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`
Expected: tsc 0 오류. build 성공(`/admin/pricing` 라우트 포함).

- [ ] **Step 5: 커밋**

```bash
git add src/app/admin/pricing/page.tsx src/app/admin/pricing/pricing-admin-client.tsx src/lib/admin/nav.ts
git commit -m "feat(admin): /admin/pricing 편집 UI(현재/과거/변경가·확인창·안내배너)+nav"
```

---

## 실행 후 사용자 작업(배포 시)

- `supabase db push` — 마이그레이션 067 수동 적용. (미적용 시 리졸버가 카탈로그 폴백 → 앱 정상, 단 admin POST 는 테이블 부재로 실패하므로 적용 후 사용.)
- 적용 후 super_admin 으로 `/admin/pricing` 진입해 편집.
- **주의**: 실제 가격 변경은 Phase 2(표시 단일화) 완료 후 권장(그 전엔 표시가≠청구액 가능 — 안내 배너 노출).

## Self-Review 체크

- **Spec 커버리지:** 리졸버(공통기반)·머니패스 스냅샷(Phase1 핵심)·admin 메뉴(현재/과거/변경가+확인창+감사)·super_admin 게이트·nav·안내배너 모두 태스크 존재. ✅
- **타입 일관성:** `ProductPriceRow`·`ResolvedPrice`·`ValidatedPriceInput`·`createPaymentOrder(input{amount}, service?)`·`resolvePackagePrice(id)` 태스크 간 시그니처 일치. ✅
- **플레이스홀더:** 없음(전 코드 명시). ✅
- **범위:** Phase 1 단일 PR 로 독립 배포 가능(리졸버 폴백으로 마이그 전에도 안전). Phase 2/3 는 별도 spec+plan. ✅
