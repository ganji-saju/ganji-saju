# 인플루언서 전용 신년운세 랜딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인플루언서 코드가 붙은 별도 도메인 랜딩에서 온 손님이 2027 신년운세(파트너판)를 32,000원 → 19,200원에 사고, 관리자가 인플루언서별 방문·판매·환불·수수료(30%)를 보게 한다.

**Architecture:** 같은 Next.js 앱이 새 도메인 호스트를 `/partner-landing/[code]` 로 내부 전환한다. 구매 버튼은 `ganjisaju.kr/partner/go?code=…` 로 가서 파트너 쿠키(7일, path `/`)를 심고 기존 체크아웃으로 보낸다. 체크아웃·prepare 는 기존 공용 코드와 같은 자리(`resolveChargeForUser` → `createPaymentOrder`)에서 파트너 할인을 계산해 화면 금액 = 주문 금액을 지킨다. 주문엔 `metadata.partnerCode`·`partnerCommissionPercent` 를 스냅샷한다.

**Tech Stack:** Next.js(이 저장소 버전 — `node_modules/next/dist/docs/` 확인), Supabase(Postgres·RLS), node:test(`npm test`), vitest(`npm run test:spec`), `./scripts/with-node22.sh`.

**Spec:** `docs/superpowers/specs/2026-10-04-influencer-landing-design.md`

## Global Constraints

- 파트너판 정가 32,000원 · 기본 할인 40% → 19,200원 · 기본 수수료 30% (사용자 결정 2026-10-04; ⚠️ 표시광고법 위험 고지 완료).
- 파트너판은 기존 신년운세와 **같은 이용권**(`tasteProductId: 'new-year'`) — 화면·PDF·재열람 동일.
- 간지사주 메뉴·가격표·검색·사이트맵에 파트너판 노출 금지. 멤버십 할인·쿠폰·공용 코드와 겹치지 않음.
- 화면 금액 = prepare 금액 = `payment_orders.amount`. 주문의 `coupon_code` 는 비운다(승인 직전 쿠폰 검사 회피).
- 랜딩 하단: 사업자 정보 + "결제·풀이 제공: 간지사주(푸꼬컴퍼니)". 한자 금지(로딩 화면만 예외).
- 새 테이블은 RLS 활성·정책 없음(service 전용). 새 SECURITY DEFINER 함수는 같은 마이그레이션에서 `revoke execute … from anon, authenticated`.
- 마이그레이션은 Supabase 수동 적용(배포와 별개) — 적용 전에는 기능이 꺼진 것처럼 안전하게 동작해야 한다.
- 실행·검증: `./scripts/with-node22.sh npm test`, `npm run test:spec`, `npx tsc --noEmit -p .`. gh 는 `./scripts/gh-ganji`.

## Review Focus

1. **파트너 쿠키 없이 파트너판 체크아웃에 들어온 손님** — 32,000원이 청구되면 안 된다: 체크아웃은 파트너판이 아닌 일반 신년운세(19,900)로 보여야 한다. → Task 4 테스트 `checkout package: 쿠키 없으면 일반 신년운세`.
2. **비활성화된 코드의 쿠키가 남은 손님** — 할인 없이 32,000원이 되면 안 된다: 일반 신년운세로 돌아간다. → Task 4 같은 테스트의 비활성 사례.
3. **마이그레이션 미적용 상태로 배포** — `partners` 조회 실패 시 체크아웃이 깨지면 안 된다: 파트너 없음으로 처리. → Task 2 `getActivePartner: 조회 오류면 null`.
4. **이미 같은 사주로 신년운세를 산 손님** — 파트너판으로 다시 결제되면 안 된다: 기존 재결제 차단이 파트너판에도 걸린다. → Task 3 테스트 `파트너판도 tasteProductId new-year`.
5. **부분 환불된 파트너 주문** — 수수료가 결제 전액 기준이면 과지급: 남은 금액 × 수수료율. → Task 6 `computePartnerStats` 부분 환불 사례.

---

### Task 1: 마이그레이션 090 — partners · partner_visits

**Files:**
- Create: `supabase/migrations/090_partners.sql`

**Interfaces:**
- Produces: 테이블 `partners(code text pk, name text, discount_percent int, commission_percent int, active bool, created_at)`, `partner_visits(partner_code text, visited_on date, count int, pk(partner_code, visited_on))`, 함수 `increment_partner_visit(p_code text, p_day date)`.

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 2026-10-04 인플루언서 전용 신년운세 랜딩(설계: docs/superpowers/specs/2026-10-04-influencer-landing-design.md)
create table if not exists public.partners (
  code text primary key check (code ~ '^[a-z0-9]{3,20}$'),
  name text not null,
  discount_percent int not null default 40 check (discount_percent between 1 and 90),
  commission_percent int not null default 30 check (commission_percent between 0 and 90),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;

create table if not exists public.partner_visits (
  partner_code text not null references public.partners(code) on delete cascade,
  visited_on date not null,
  count int not null default 0,
  primary key (partner_code, visited_on)
);
alter table public.partner_visits enable row level security;

create or replace function public.increment_partner_visit(p_code text, p_day date)
returns void language sql security definer set search_path = public as $$
  insert into public.partner_visits (partner_code, visited_on, count)
  select p_code, p_day, 1 where exists (select 1 from public.partners where code = p_code and active)
  on conflict (partner_code, visited_on) do update set count = public.partner_visits.count + 1;
$$;
revoke execute on function public.increment_partner_visit(text, date) from public, anon, authenticated;
```

- [ ] **Step 2: 로컬 문법 확인** — Run: `grep -c "enable row level security" supabase/migrations/090_partners.sql` Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/090_partners.sql
git commit -m "feat(db): 090 partners·partner_visits(인플루언서 랜딩)"
```

> 적용은 머지 후 `supabase-ganji` MCP 로 수동(사용자 확인 뒤). 적용 후 `get_advisors` 로 새 경고 없음 확인.

---

### Task 2: 파트너 도메인 모듈

**Files:**
- Create: `src/lib/partners/partner.ts`
- Test: `src/lib/partners/partner.test.ts`

**Interfaces:**
- Produces:
  - `PARTNER_PACKAGE_ID = 'taste_new_year_2027_partner'`
  - `PARTNER_COOKIE = 'ganji_partner'`, `PARTNER_COOKIE_MAX_AGE = 7 * 24 * 60 * 60`
  - `type PartnerTerms = { code: string; name: string; discountPercent: number; commissionPercent: number }`
  - `normalizePartnerCode(raw: unknown): string | null`
  - `applyPartnerPrice(listAmount: number, terms: PartnerTerms): { chargeAmount: number; discountWon: number; percent: number }`
  - `getActivePartner(service: SupabaseClient, code: string | null | undefined): Promise<PartnerTerms | null>`

- [ ] **Step 1: 실패하는 테스트**

```ts
import assert from 'node:assert/strict';
import { applyPartnerPrice, getActivePartner, normalizePartnerCode } from './partner';

declare const test: (name: string, fn: () => void | Promise<void>) => void;
const terms = { code: 'mina', name: '미나', discountPercent: 40, commissionPercent: 30 };

test('applyPartnerPrice: 32,000 × 40% → 19,200', () => {
  assert.deepEqual(applyPartnerPrice(32000, terms), { chargeAmount: 19200, discountWon: 12800, percent: 40 });
});

test('normalizePartnerCode: 소문자·영숫자 3~20자만', () => {
  assert.equal(normalizePartnerCode(' MiNa01 '), 'mina01');
  assert.equal(normalizePartnerCode('a'), null);
  assert.equal(normalizePartnerCode('mi-na'), null);
  assert.equal(normalizePartnerCode(undefined), null);
});

function fakeService(result: { data: unknown; error: unknown }) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => result };
  return { from: () => q } as never;
}

test('getActivePartner: 활성 파트너면 조건 반환, 비활성·없음·조회 오류면 null', async () => {
  const row = { code: 'mina', name: '미나', discount_percent: 40, commission_percent: 30, active: true };
  assert.deepEqual(await getActivePartner(fakeService({ data: row, error: null }), 'mina'), terms);
  assert.equal(await getActivePartner(fakeService({ data: { ...row, active: false }, error: null }), 'mina'), null);
  assert.equal(await getActivePartner(fakeService({ data: null, error: null }), 'mina'), null);
  assert.equal(await getActivePartner(fakeService({ data: null, error: { message: 'relation does not exist' } }), 'mina'), null);
  assert.equal(await getActivePartner(fakeService({ data: row, error: null }), 'x'), null);
});
```

- [ ] **Step 2: 실패 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "partner|^# fail"` Expected: 모듈 없음으로 FAIL

- [ ] **Step 3: 구현**

```ts
// 2026-10-04 인플루언서(파트너) 전용 신년운세 — 설계: docs/superpowers/specs/2026-10-04-influencer-landing-design.md
import type { SupabaseClient } from '@supabase/supabase-js';

export const PARTNER_PACKAGE_ID = 'taste_new_year_2027_partner';
export const PARTNER_COOKIE = 'ganji_partner';
export const PARTNER_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export interface PartnerTerms {
  code: string;
  name: string;
  discountPercent: number;
  commissionPercent: number;
}

export function normalizePartnerCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  return /^[a-z0-9]{3,20}$/.test(code) ? code : null;
}

/** 표시(resolveChargeForUser)와 주문(createPaymentOrder)이 같은 함수를 쓴다 — 화면 금액 = order.amount. */
export function applyPartnerPrice(listAmount: number, terms: PartnerTerms) {
  const discountWon = Math.floor((listAmount * terms.discountPercent) / 100);
  return { chargeAmount: listAmount - discountWon, discountWon, percent: terms.discountPercent };
}

/** 조회 실패(마이그레이션 미적용 포함)는 '파트너 없음' — 체크아웃을 깨지 않는다. */
export async function getActivePartner(service: SupabaseClient, raw: string | null | undefined): Promise<PartnerTerms | null> {
  const code = normalizePartnerCode(raw);
  if (!code) return null;
  const { data, error } = await service
    .from('partners')
    .select('code, name, discount_percent, commission_percent, active')
    .eq('code', code)
    .maybeSingle();
  if (error || !data || !data.active) return null;
  return { code: data.code, name: data.name, discountPercent: data.discount_percent, commissionPercent: data.commission_percent };
}
```

- [ ] **Step 4: 통과 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "^not ok|^# fail"` Expected: `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add src/lib/partners
git commit -m "feat(partners): 파트너 조건·가격 계산 모듈"
```

---

### Task 3: 파트너판 상품(숨김)

**Files:**
- Modify: `src/lib/payments/catalog.ts` (PAYMENT_PACKAGES 의 `taste_new_year_2027` 바로 뒤)
- Modify: 가격표·사이트맵·메뉴에서 PAYMENT_PACKAGES 를 순회하는 곳이 있으면 파트너판 제외 — `grep -rn "PAYMENT_PACKAGES" src --include=*.ts*` 로 확인한 소비처만
- Test: `src/lib/partners/partner-package.test.ts`

**Interfaces:**
- Consumes: `PARTNER_PACKAGE_ID` (Task 2)
- Produces: `getPackage('taste_new_year_2027_partner')` = `{ price: 32000, kind: 'taste_product', tasteProductId: 'new-year', requiresSlug: true }`

- [ ] **Step 1: 실패하는 테스트**

```ts
import assert from 'node:assert/strict';
import { getPackage, getTasteProductPackage } from '@/lib/payments/catalog';
import { MEMBER_DISCOUNT_PERCENT_BY_PACKAGE } from '@/lib/payments/member-discount';
import { PARTNER_PACKAGE_ID } from './partner';

declare const test: (name: string, fn: () => void) => void;

test('파트너판: 32,000원 · 신년운세와 같은 이용권 · 멤버십 할인 없음', () => {
  const pkg = getPackage(PARTNER_PACKAGE_ID)!;
  assert.equal(pkg.price, 32000);
  assert.equal(pkg.tasteProductId, 'new-year');
  assert.equal(pkg.requiresSlug, true);
  assert.equal(MEMBER_DISCOUNT_PERCENT_BY_PACKAGE[PARTNER_PACKAGE_ID], undefined);
});

test('파트너판도 tasteProductId new-year — 일반 체크아웃의 new-year 는 여전히 19,900 상품', () => {
  assert.equal(getTasteProductPackage('new-year').id, 'taste_new_year_2027');
});
```

- [ ] **Step 2: 실패 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "파트너판|^# fail"` Expected: FAIL

- [ ] **Step 3: 카탈로그에 추가**

```ts
  {
    // 2026-10-04 — 인플루언서 랜딩 전용(숨김). 정가 32,000 · 파트너 할인으로만 판다. 이용권은 일반 신년운세와 같다.
    //   ⚠️ 정가 표시는 사용자 결정(표시광고법 위험 고지 완료). 메뉴·가격표·사이트맵에 넣지 않는다.
    id: 'taste_new_year_2027_partner',
    name: '2027 신년운세',
    credits: 0,
    price: 32000,
    kind: 'taste_product',
    tasteProductId: 'new-year',
    requiresSlug: true,
  },
```

`TASTE_PACKAGE_BY_PRODUCT` 는 바꾸지 않는다(`new-year` → 일반 상품 유지).

- [ ] **Step 4: 노출 확인** — Run: `grep -rn "PAYMENT_PACKAGES" src --include=*.ts --include=*.tsx | grep -v test` 결과의 각 소비처(가격표·관리자 가격 편집·사이트맵)를 열어, 사용자에게 상품 목록을 보여 주는 곳이면 `pkg.id !== PARTNER_PACKAGE_ID` 필터를 추가한다. 관리자 가격 편집(`/admin/pricing`)은 노출 유지(가격 조정 가능해야 함).

- [ ] **Step 5: 전체 테스트** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "^not ok|^# fail"; ./scripts/with-node22.sh npx tsc --noEmit -p .` Expected: `# fail 0`, tsc 출력 없음. 가격 서열 가드(`pricing-hierarchy.test.ts`)가 실패하면 그 테스트의 대상 목록에서 파트너판을 제외하는 이유 주석과 함께 갱신.

- [ ] **Step 6: Commit**

```bash
git add src/lib/payments/catalog.ts src/lib/partners/partner-package.test.ts
git commit -m "feat(partners): 신년운세 파트너판 상품(숨김, 32,000원)"
```

---

### Task 4: 파트너 진입 링크 · 체크아웃 · prepare · 주문 기록

**Files:**
- Create: `src/app/partner/go/route.ts` (쿠키 심고 체크아웃으로)
- Create: `src/lib/partners/checkout-package.ts` + test `checkout-package.test.ts`
- Modify: `src/lib/coupons/coupon-charge.ts` (`resolveChargeForUser` opts 에 `partner`)
- Modify: `src/lib/payments/order-ledger.ts` (`createPaymentOrder` input `partner`)
- Modify: `src/app/membership/checkout/page.tsx` (패키지 선택·할인 행 문구)
- Modify: `src/app/api/payments/prepare/route.ts` (파트너 조회·전달)
- Modify: `src/lib/payments/coupon-chokepoint.test.ts` (정가 필드 파일 목록에 `src/lib/partners/partner.ts` 추가)
- Test: `src/lib/coupons/coupon-charge.test.ts` (파트너 사례 추가)

**Interfaces:**
- Consumes: Task 2 전부, Task 3 패키지
- Produces:
  - `resolveCheckoutPackage(base: PaymentPackage, partner: PartnerTerms | null): PaymentPackage` — base 가 `taste_new_year_2027` 이고 partner 가 있으면 파트너판, 아니면 base.
  - `ChargeQuote.partner?: PartnerTerms | null`
  - `createPaymentOrder` input `partner?: PartnerTerms | null` → `metadata.partnerCode`, `metadata.partnerCommissionPercent`

- [ ] **Step 1: 실패하는 테스트 — 패키지 선택**

```ts
import assert from 'node:assert/strict';
import { getPackage } from '@/lib/payments/catalog';
import { resolveCheckoutPackage } from './checkout-package';

declare const test: (name: string, fn: () => void) => void;
const terms = { code: 'mina', name: '미나', discountPercent: 40, commissionPercent: 30 };
const NEW_YEAR = getPackage('taste_new_year_2027')!;

test('checkout package: 활성 파트너면 파트너판, 쿠키 없음·비활성(null)이면 일반 신년운세', () => {
  assert.equal(resolveCheckoutPackage(NEW_YEAR, terms).id, 'taste_new_year_2027_partner');
  assert.equal(resolveCheckoutPackage(NEW_YEAR, null).id, 'taste_new_year_2027');
  const other = getPackage('taste_today_detail')!;
  assert.equal(resolveCheckoutPackage(other, terms).id, 'taste_today_detail', '다른 상품엔 파트너판 없음');
});
```

- [ ] **Step 2: 실패하는 테스트 — 금액·주문 (coupon-charge.test.ts 끝에 추가)**

```ts
test('coupon-charge — 파트너판: 32,000 → 19,200, 화면 = 주문, coupon_code 비움, 수수료율 스냅샷', async () => {
  const pkg = getPackage('taste_new_year_2027_partner')!;
  const partner = { code: 'mina', name: '미나', discountPercent: 40, commissionPercent: 30 };
  for (const viewer of [null, { id: 'u1' }]) {
    const db = fakeDb();
    const quote = await resolveChargeForUser(pkg, viewer, '간지사주50', { ...opts(db), partner, isPremiumMember: async () => true });
    assert.equal(quote.chargeAmount, 19200, '쿠폰·공용 코드·멤버십은 파트너판에 안 붙는다');
    assert.equal(quote.partner?.code, 'mina');
    if (!viewer) continue;
    await createPaymentOrder(
      { userId: 'u1', pkg, listAmount: quote.listAmount, partner: quote.partner, acceptedKinds: [], recordedPolicyVersionIds: [] },
      db.client
    );
    const inserted = db.inserted.at(-1)!;
    assert.equal(inserted.amount, 19200);
    assert.equal(inserted.coupon_code, null);
    assert.equal((inserted.metadata as Record<string, unknown>).partnerCode, 'mina');
    assert.equal((inserted.metadata as Record<string, unknown>).partnerCommissionPercent, 30);
  }
});

test('coupon-charge — 파트너 없이 파트너판이면 정가(prepare 의 표시 금액 대조가 막는다)', async () => {
  const db = fakeDb();
  const quote = await resolveChargeForUser(getPackage('taste_new_year_2027_partner')!, { id: 'u1' }, null, { ...opts(db), partner: null });
  assert.equal(quote.chargeAmount, 32000);
  assert.equal(quote.partner ?? null, null);
});
```

- [ ] **Step 3: 실패 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "파트너|checkout package|^# fail"` Expected: FAIL

- [ ] **Step 4: 구현 — checkout-package.ts**

```ts
import { getPackage, type PaymentPackage } from '@/lib/payments/catalog';
import { PARTNER_PACKAGE_ID, type PartnerTerms } from './partner';

/** 파트너 쿠키가 살아 있을 때만 신년운세를 파트너판으로 바꾼다. 없거나 비활성이면 일반 상품(32,000원 청구 방지). */
export function resolveCheckoutPackage(base: PaymentPackage, partner: PartnerTerms | null): PaymentPackage {
  if (!partner || base.id !== 'taste_new_year_2027') return base;
  return getPackage(PARTNER_PACKAGE_ID) ?? base;
}
```

- [ ] **Step 5: 구현 — resolveChargeForUser** (`src/lib/coupons/coupon-charge.ts`)

`opts` 타입에 `partner?: PartnerTerms | null` 추가, `ChargeQuote` 에 `partner?: PartnerTerms | null` 추가. 함수 첫머리 `const listAmount = …` 바로 다음에:

```ts
  // 2026-10-04 — 파트너판은 파트너 할인만 붙는다(쿠폰·공용 코드·멤버십 없음). 로그인 전에도 같은 금액(추측 위험 없음).
  if (pkg.id === PARTNER_PACKAGE_ID) {
    if (!opts.partner) return { listAmount, discountWon: 0, chargeAmount: listAmount, percent: 0, couponCode: null, reason: null, claim: null, memberPercent: 0 };
    const p = applyPartnerPrice(listAmount, opts.partner);
    return { listAmount, discountWon: p.discountWon, chargeAmount: p.chargeAmount, percent: p.percent, couponCode: null, reason: null, claim: null, memberPercent: 0, partner: opts.partner };
  }
```

import: `import { PARTNER_PACKAGE_ID, applyPartnerPrice, type PartnerTerms } from '@/lib/partners/partner';`

- [ ] **Step 6: 구현 — createPaymentOrder** (`src/lib/payments/order-ledger.ts`)

input 에 `partner?: PartnerTerms | null;` 추가. `const pricing = input.promo ? …` 맨 앞에 `input.partner ? applyPartnerPrice(input.listAmount, input.partner) :` 를 붙이고, metadata 를:

```ts
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.promo ? { promoCode: input.promo.code } : {}),
        ...(input.partner ? { partnerCode: input.partner.code, partnerCommissionPercent: input.partner.commissionPercent } : {}),
      },
```

- [ ] **Step 7: 구현 — 진입 링크** `src/app/partner/go/route.ts`

```ts
// 랜딩(별도 도메인)의 구매 버튼이 오는 곳. 파트너 쿠키를 심고 신년운세 체크아웃으로 보낸다.
//   교차 사이트 진입이라 체크아웃의 ?coupon= 가드에 걸리지 않게 쿠키는 여기(우리 도메인)서 심는다.
import { NextRequest, NextResponse } from 'next/server';
import { PARTNER_COOKIE, PARTNER_COOKIE_MAX_AGE, normalizePartnerCode } from '@/lib/partners/partner';

export function GET(req: NextRequest) {
  const code = normalizePartnerCode(req.nextUrl.searchParams.get('code'));
  const res = NextResponse.redirect(new URL('/membership/checkout?product=new-year', req.nextUrl.origin), 303);
  if (code) {
    res.cookies.set(PARTNER_COOKIE, code, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: PARTNER_COOKIE_MAX_AGE,
    });
  }
  return res;
}
```

(활성 여부는 여기서 판정하지 않는다 — 체크아웃·prepare 가 매번 `getActivePartner` 로 다시 본다.)

- [ ] **Step 8: 구현 — 체크아웃** (`src/app/membership/checkout/page.tsx`)

`const paymentPackage = …` 계산 뒤(사용 전)에:

```ts
  // 2026-10-04 — 인플루언서 랜딩에서 온 손님(파트너 쿠키)은 신년운세를 파트너판으로. 쿠키가 없거나 비활성이면 일반 상품.
  const partner = await getActivePartner(await createServiceClient(), (await cookies()).get(PARTNER_COOKIE)?.value);
  const checkoutPackage = paymentPackage ? resolveCheckoutPackage(paymentPackage, partner) : null;
```

이후 `paymentPackage` 를 쓰던 금액·버튼·prepare 로 보내는 `packageId` 를 `checkoutPackage` 로 바꾼다(가이드 문구·헤더 그림은 그대로). `resolveChargeForUser(checkoutPackage, viewer, couponInput, { env, partner })`. 할인 행 문구: `quote.partner ? '파트너 특가' : …` 를 기존 삼항 맨 앞에 추가. 이미 import 된 `cookies` 재사용, `createServiceClient` 는 `@/lib/supabase/server`.

- [ ] **Step 9: 구현 — prepare** (`src/app/api/payments/prepare/route.ts`)

`resolveChargeForUser(pkg, user, couponInput, { env… })` 호출 직전에:

```ts
  const partner = pkg.id === PARTNER_PACKAGE_ID
    ? await getActivePartner(await createServiceClient(), req.cookies.get(PARTNER_COOKIE)?.value)
    : null;
```

opts 에 `partner` 추가, `createPaymentOrder` 에 `partner: quote.partner ?? null` 추가. (쿠키가 사라졌으면 quote 가 32,000원이 되어 기존 `expectedAmount` 대조가 'amount_changed' 로 멈춘다 — 32,000원 청구 없음.)

- [ ] **Step 10: 초크포인트 목록 갱신** — `coupon-chokepoint.test.ts` 정가 필드 파일 목록에 `'src/lib/partners/partner.ts', // 2026-10-04 파트너 할인 계산` 를 알파벳 순서 자리에 추가.

- [ ] **Step 11: 통과 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "^not ok|^# fail"; ./scripts/with-node22.sh npm run test:spec 2>&1 | grep -E "Tests |FAIL"; ./scripts/with-node22.sh npx tsc --noEmit -p .` Expected: fail 0, spec 전부 통과, tsc 출력 없음

- [ ] **Step 12: Commit**

```bash
git add src/app/partner src/lib/partners src/lib/coupons/coupon-charge.ts src/lib/coupons/coupon-charge.test.ts src/lib/payments/order-ledger.ts src/lib/payments/coupon-chokepoint.test.ts src/app/membership/checkout/page.tsx src/app/api/payments/prepare/route.ts
git commit -m "feat(partners): 파트너 진입 링크·체크아웃·prepare·주문 기록(32,000→19,200)"
```

---

### Task 5: 랜딩 페이지 · 새 도메인 라우팅 · 방문 집계

**Files:**
- Create: `src/app/partner-landing/[code]/page.tsx`
- Create: `src/lib/partners/partner-host.ts` + test `partner-host.test.ts`
- Modify: `src/proxy.ts` (canonical 리다이렉트 **앞**에서 파트너 호스트 전환)
- Modify: `src/lib/site.ts` 를 쓰는 canonical 판정이 새 도메인을 튕기지 않는지 확인(필요 시 `shouldRedirectHost` 에서 파트너 호스트 제외)

**Interfaces:**
- Consumes: `getActivePartner`, `applyPartnerPrice`, `PARTNER_PACKAGE_ID`
- Produces:
  - `isPartnerHost(hostname: string): boolean` — env `PARTNER_SITE_HOSTS`(쉼표 구분)에 있으면 true
  - `partnerLandingRewritePath(pathname: string): string | null` — `/코드` → `/partner-landing/코드`, `/` → `/partner-landing/_` , 정책 경로(`/terms`, `/privacy`)·`/_next/*` 는 null(그대로), 그 외는 `/partner-landing/_`

- [ ] **Step 1: 실패하는 테스트**

```ts
import assert from 'node:assert/strict';
import { isPartnerHost, partnerLandingRewritePath } from './partner-host';

declare const test: (name: string, fn: () => void) => void;

test('isPartnerHost: env 목록의 호스트만', () => {
  process.env.PARTNER_SITE_HOSTS = 'newyear.example, www.newyear.example';
  assert.equal(isPartnerHost('newyear.example'), true);
  assert.equal(isPartnerHost('www.newyear.example'), true);
  assert.equal(isPartnerHost('ganjisaju.kr'), false);
  delete process.env.PARTNER_SITE_HOSTS;
  assert.equal(isPartnerHost('newyear.example'), false);
});

test('partnerLandingRewritePath: 코드 경로만 랜딩, 간지사주 다른 화면은 열지 않음', () => {
  assert.equal(partnerLandingRewritePath('/mina'), '/partner-landing/mina');
  assert.equal(partnerLandingRewritePath('/'), '/partner-landing/_');
  assert.equal(partnerLandingRewritePath('/saju/new'), '/partner-landing/_');
  assert.equal(partnerLandingRewritePath('/terms'), null);
  assert.equal(partnerLandingRewritePath('/privacy'), null);
  assert.equal(partnerLandingRewritePath('/_next/static/x.js'), null);
});
```

- [ ] **Step 2: 실패 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "partnerLanding|isPartnerHost|^# fail"` Expected: FAIL

- [ ] **Step 3: 구현 — partner-host.ts**

```ts
// 새 도메인(인플루언서 랜딩) 호스트 판정·경로 전환. 도메인은 env 로 — 코드 수정 없이 붙이고 뗄 수 있게.
import { normalizePartnerCode } from './partner';

export function isPartnerHost(hostname: string): boolean {
  const hosts = (process.env.PARTNER_SITE_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return hosts.includes(hostname.toLowerCase());
}

const PASS_THROUGH = ['/terms', '/privacy', '/_next/', '/images/', '/favicon'];

export function partnerLandingRewritePath(pathname: string): string | null {
  if (PASS_THROUGH.some((p) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`) || pathname.startsWith(p))) return null;
  const code = normalizePartnerCode(pathname.replace(/^\//, ''));
  return `/partner-landing/${code ?? '_'}`;
}
```

- [ ] **Step 4: proxy 연결** — `proxy()` 에서 staging 게이트 바로 다음, canonical 판정 **앞**에:

```ts
  // 2026-10-04 인플루언서 랜딩 도메인 — 랜딩 한 장만 보여 주고 간지사주의 다른 화면은 열지 않는다.
  if (isPartnerHost(req.nextUrl.hostname)) {
    const rewrite = partnerLandingRewritePath(req.nextUrl.pathname);
    return rewrite ? NextResponse.rewrite(new URL(rewrite, req.url)) : NextResponse.next({ request: req });
  }
```

- [ ] **Step 5: 랜딩 페이지** `src/app/partner-landing/[code]/page.tsx`

```tsx
// 2026-10-04 인플루언서 전용 신년운세 랜딩(설계 §3-3). 간지사주 셸(헤더·메뉴) 없이 한 장.
import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { getPackage, formatWon } from '@/lib/payments/catalog';
import { resolvePackagePrice } from '@/lib/payments/price-resolver';
import { applyPartnerPrice, getActivePartner, PARTNER_PACKAGE_ID } from '@/lib/partners/partner';
import { kstDateKey } from '@/lib/admin/analytics-rollup';
import { CANONICAL_SITE_URL } from '@/lib/site';

export const metadata: Metadata = { title: '2027 신년운세', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const service = await createServiceClient();
  const partner = await getActivePartner(service, code);
  if (!partner) {
    return <main className="mx-auto max-w-[480px] px-4 py-16 text-center">지금은 이용할 수 없는 링크입니다.</main>;
  }
  await service.rpc('increment_partner_visit', { p_code: partner.code, p_day: kstDateKey(new Date().toISOString()) }).then(() => undefined, () => undefined);
  const list = await resolvePackagePrice(getPackage(PARTNER_PACKAGE_ID)!.id);
  const price = applyPartnerPrice(list, partner);
  const buyHref = `${CANONICAL_SITE_URL}/partner/go?code=${encodeURIComponent(partner.code)}`;
  return (
    <main className="mx-auto max-w-[480px] px-4 pb-16 pt-10">
      {/* 브랜드 이름·로고·문구는 사용자 확정본으로 교체(설계 §7). 아래는 구조. */}
      <h1 className="text-[28px] font-extrabold">2027 신년운세</h1>
      <p className="mt-3 text-[16px] leading-[1.7]">재물·가족·일 — 새해 한 해의 흐름을 월별로 미리 봅니다. PDF로 저장해 다시 볼 수 있어요.</p>
      <div className="mt-6 rounded-[14px] border p-5">
        <p className="text-[15px] text-[var(--app-copy-muted)] line-through">{formatWon(list)}</p>
        <p className="text-[26px] font-extrabold">{formatWon(price.chargeAmount)} <span className="text-[16px]">({price.percent}% 할인)</span></p>
        <a href={buyHref} className="mt-4 block rounded-[12px] bg-[var(--app-pink)] py-3 text-center font-extrabold text-white">지금 보기</a>
        <p className="mt-3 text-[13px] text-[var(--app-copy-muted)]">결제·풀이 제공: 간지사주(푸꼬컴퍼니) — 결제 화면에 이 이름이 표시됩니다.</p>
      </div>
      <footer className="mt-10 text-[12px] leading-[1.6] text-[var(--app-copy-muted)]">
        {/* 사업자 정보: 간지사주 사이트 하단 정보 컴포넌트를 그대로 쓴다 — grep "사업자 정보" src/components 로 찾아 import */}
      </footer>
    </main>
  );
}
```

`resolvePackagePrice` 의 실제 경로는 `grep -rn "export async function resolvePackagePrice" src` 로 확인해 import 를 맞춘다. 사업자 정보 컴포넌트도 같은 방식으로 찾아 footer 에 넣는다(주석을 남기지 말고 실제 컴포넌트를 넣을 것).

- [ ] **Step 6: 통과 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "^not ok|^# fail"; ./scripts/with-node22.sh npx tsc --noEmit -p .` Expected: fail 0, tsc 출력 없음

- [ ] **Step 7: Commit**

```bash
git add src/lib/partners/partner-host.ts src/lib/partners/partner-host.test.ts src/app/partner-landing src/proxy.ts
git commit -m "feat(partners): 새 도메인 랜딩 한 장·호스트 전환·방문 집계"
```

---

### Task 6: 관리자 — 파트너 등록·실적·수수료

**Files:**
- Create: `src/lib/partners/partner-stats.ts` + test `partner-stats.test.ts`
- Create: `src/app/api/admin/partners/route.ts` (GET 목록+실적, POST 등록/수정 — super_admin)
- Create: `src/app/admin/partners/page.tsx`, `src/app/admin/partners/partners-admin-client.tsx`
- Modify: 관리자 사이드 메뉴 목록(`grep -rn "/admin/coupons" src/components src/app/admin/layout.tsx`)에 '인플루언서' 추가

**Interfaces:**
- Consumes: `payment_orders`(`amount`, `status`, `metadata.partnerCode`, `metadata.partnerCommissionPercent`, `metadata.partialRefunds`, `confirmed_at`), `partner_visits`, 기간은 `src/lib/admin/metric-periods.ts`
- Produces: `computePartnerStats(orders: PartnerOrderRow[]): Record<string, { paidCount: number; paidWon: number; refundedCount: number; refundedWon: number; commissionWon: number }>`

- [ ] **Step 1: 실패하는 테스트**

```ts
import assert from 'node:assert/strict';
import { computePartnerStats } from './partner-stats';

declare const test: (name: string, fn: () => void) => void;

test('computePartnerStats: 수수료 = 남은 결제액 × 스냅샷 수수료율, 전액 환불은 0', () => {
  const stats = computePartnerStats([
    { amount: 19200, status: 'fulfilled', metadata: { partnerCode: 'mina', partnerCommissionPercent: 30 } },
    { amount: 19200, status: 'refunded', metadata: { partnerCode: 'mina', partnerCommissionPercent: 30 } },
    { amount: 19200, status: 'fulfilled', metadata: { partnerCode: 'mina', partnerCommissionPercent: 30, partialRefunds: [{ amount: 9200 }] } },
    { amount: 9900, status: 'fulfilled', metadata: {} },
  ]);
  assert.deepEqual(stats.mina, {
    paidCount: 3,
    paidWon: 57600,
    refundedCount: 2,
    refundedWon: 19200 + 9200,
    commissionWon: Math.floor(19200 * 0.3) + Math.floor(10000 * 0.3),
  });
  assert.equal(Object.keys(stats).length, 1, '파트너 없는 주문은 제외');
});
```

- [ ] **Step 2: 실패 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "computePartnerStats|^# fail"` Expected: FAIL

- [ ] **Step 3: 구현 — partner-stats.ts**

```ts
// 인플루언서별 판매·환불·수수료(설계 §3-5). 수수료는 주문 시점 스냅샷율 × (결제액 − 환불액). 정산은 수동.
export interface PartnerOrderRow {
  amount: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

const PAID = new Set(['confirmed', 'fulfilling', 'fulfilled', 'fulfillment_failed', 'refunded']);

export function computePartnerStats(orders: readonly PartnerOrderRow[]) {
  const out: Record<string, { paidCount: number; paidWon: number; refundedCount: number; refundedWon: number; commissionWon: number }> = {};
  for (const o of orders) {
    const code = typeof o.metadata?.partnerCode === 'string' ? o.metadata.partnerCode : null;
    if (!code || !PAID.has(o.status)) continue;
    const amount = Math.max(0, Number(o.amount) || 0);
    const rate = Number(o.metadata?.partnerCommissionPercent) || 0;
    const partial = Array.isArray(o.metadata?.partialRefunds)
      ? (o.metadata!.partialRefunds as { amount?: number }[]).reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : 0;
    const refunded = o.status === 'refunded' ? amount : Math.min(amount, partial);
    const s = (out[code] ??= { paidCount: 0, paidWon: 0, refundedCount: 0, refundedWon: 0, commissionWon: 0 });
    s.paidCount += 1;
    s.paidWon += amount;
    if (refunded > 0) { s.refundedCount += 1; s.refundedWon += refunded; }
    s.commissionWon += Math.floor(((amount - refunded) * rate) / 100);
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "^not ok|^# fail"` Expected: `# fail 0`

- [ ] **Step 5: API** `src/app/api/admin/partners/route.ts` — 패턴은 `src/app/api/admin/payments/refund-note/route.ts`(역할 확인) + `src/app/api/admin/analytics/route.ts`(기간). super_admin 만.
  - GET `?period=&key=`: `partners` 전체 + `partner_visits` 기간 합 + `payment_orders` 에서 `metadata->>partnerCode is not null` 이고 `confirmed_at` 이 기간 안인 행(`amount,status,metadata`, 상한 2000) → `computePartnerStats`. 응답 `{ ok, partners: [{ code, name, discountPercent, commissionPercent, active, url, visits, ...stats }] }`. `url` = `https://${PARTNER_SITE_HOSTS 첫 호스트}/${code}`.
  - POST `{ code, name, discountPercent, commissionPercent, active }`: `normalizePartnerCode` 통과·이름 1~40자·할인 1~90·수수료 0~90 검증 후 upsert. 실패 400.

- [ ] **Step 6: 화면** `src/app/admin/partners/page.tsx`(`AdminPage` 사용, 다른 관리자 페이지와 같은 틀) + 클라이언트 컴포넌트: 기간 선택(기존 달력 컴포넌트 재사용 — `/admin/analytics` 가 쓰는 것) · 표(이름·코드·주소 복사 버튼·방문·결제 건수/금액·환불·수수료·활성 토글) · 등록 폼. 글자 크기는 관리자 타입 램프(11, 11.5, 13, 14, 16, 20, 22, 28)만 — `admin-type-ramp.test.ts` 가 막는다. 구매자 개인정보 표시 없음.

- [ ] **Step 7: 메뉴** — 관리자 메뉴에 '인플루언서' → `/admin/partners` 추가.

- [ ] **Step 8: 전체 확인** — Run: `./scripts/with-node22.sh npm test 2>&1 | grep -E "^not ok|^# fail"; ./scripts/with-node22.sh npm run test:spec 2>&1 | grep -E "Tests |FAIL"; ./scripts/with-node22.sh npx tsc --noEmit -p .` Expected: 전부 통과

- [ ] **Step 9: Commit**

```bash
git add src/lib/partners/partner-stats.ts src/lib/partners/partner-stats.test.ts src/app/api/admin/partners src/app/admin/partners
git commit -m "feat(admin): 인플루언서 등록·실적·수수료 화면"
```

---

### Task 7: 기록 · PR · 배포 · 실화면 확인

- [ ] **Step 1:** `PROGRESS.md` 맨 위에 새 섹션(수행 내용·검증 결과·⚠️ 마이그레이션 090 수동 적용·도메인 연결 대기)을 쓰고 커밋.
- [ ] **Step 2:** PR 생성(`./scripts/gh-ganji pr create`) → 체크(CodeQL 요약 포함) 통과 확인. 머지는 사용자 요청 시 AGENTS.md "머지·배포 완료 범위" 절차대로.
- [ ] **Step 3:** 마이그레이션 090 적용은 사용자 확인 뒤 `supabase-ganji` MCP 로 → `get_advisors` 새 경고 없음 확인.
- [ ] **Step 4:** 도메인 연결(사용자가 도메인 구매 후): Vercel 프로젝트에 도메인 추가 → env `PARTNER_SITE_HOSTS` 설정 → 재배포. 그 전엔 staging 에서 임시 서브도메인으로 확인.
- [ ] **Step 5:** 실화면(staging): 관리자에서 테스트 파트너 등록 → 랜딩 32,000→19,200 → 구매 버튼 → 체크아웃 19,200 → 결제창 19,200(사용자 확인) → 관리자 실적에 방문 1·결제 반영 확인.
