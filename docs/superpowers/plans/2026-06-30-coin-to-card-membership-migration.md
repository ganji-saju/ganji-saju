# 코인(선불충전) → 카드 직접결제 + 멤버십 정액이용권 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 나이스페이 "카드결제 전용" 제약에 맞춰 선불충전(stored-value) 코인을 폐지하고, 코인으로 쓰던 기능을 카드 단건결제 + 멤버십 정액이용권으로 옮긴다. 기존 보유 코인은 만료일까지 소진 유예.

**Architecture:** 신규 코인 발행(충전·가입보너스·멤버십지급)을 모두 중단하되, 코인 차감 경로(`deduct_credits`/`unlockCreditsOnce`)는 **기존 잔액 소진용 레거시 게이트로 유지**한다. 각 유료기능 접근 판정에 (1)기존 엔타이틀먼트 → (2)멤버십 쿼터 → (3)레거시 코인 → (4)카드 단건결제 페이월 순서를 확립한다. 멤버십 가치는 "코인 90개 지급"에서 "정액 이용권(프리미엄=상세풀이·달력 무제한+대화 일5턴+궁합 월3회 / 플러스=소량 쿼터)"으로 재표현한다. 멤버십·단건상품 결제는 이미 카드 1회결제라 그대로 둔다.

**Tech Stack:** Next.js 16(App Router) · TypeScript · Supabase(Postgres RPC, migrations) · Vitest(`npm run test:spec`) + node test(`npm test`) · Playwright(`npm run e2e`).

## Global Constraints

- **신규 코인 발행 0**: 충전 판매·가입보너스·멤버십 코인지급·관리자 일반지급 전부 중단. `add_credits(type='purchase'|'subscription')` 신규 호출 금지(레거시 잔액 차감 `deduct_credits`만 유지).
- **기존 잔액 비파괴**: 이미 적립된 `credit_lots`(1년 만료)·`subscription_balance`는 환불·소거하지 않는다. 만료일까지 차감 가능 유지. — 사용자 결정(2026-06-30).
- **결제수단 카드 전용**: 계좌이체·가상계좌·휴대폰결제 비노출 유지(`methods.ts`/picker). PG=나이스페이(`PAYMENT_PROVIDER`).
- **대화상담 단건 턴팩 없음**: 무료 3턴 소진 후 비회원은 멤버십으로 유도(단건 결제 안 만듦). — 사용자 결정.
- **단건상품 가격은 카탈로그 코드가 단일 출처**: 임의 변경 금지(현행 taste_* 9,900 / bundle 19,800 / lifetime 49,000). 변경 필요 시 별도 합의.
- **단정 금지 항목(코드 외)**: 법무/PG 확인 전 코인 "완전 삭제(테이블 drop)"·정기결제·휴대폰결제는 이 플랜 범위 밖(`docs/payments-card-only-restructure.md` §5~6).
- 커밋 메시지 한국어 `feat()/fix()/chore()` 컨벤션, 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Supabase 마이그레이션은 번호 연속·`supabase` CLI 수동 적용(자동배포 아님). 직전 마이그레이션 번호 확인 후 +1.
- **테스트 위치**: vitest `include: ['src/**/*.spec.ts']` — 신규 `*.spec.ts` 는 반드시 `src/` 하위 co-located 로 둔다(`tests/` 디렉토리는 vitest 미수집). 본 문서의 `tests/...` 경로 표기는 모두 해당 모듈 옆 `src/.../*.spec.ts` 로 읽을 것. 실행: `npm run test:spec`.

---

## 확정 멤버십 쿼터 (2026-06-30 사용자 승인 — Task 8 `MEMBER_QUOTAS` 에 반영)

| 혜택 | premium (49,000/월) | plus (4,900/월) | 비회원 |
|---|---|---|---|
| 상세풀이(detail_report) | 무제한 | 월 3회 | 카드 단건 9,900 |
| 운세달력(calendar) | 무제한 | 월 1회 | 카드 단건 9,900 |
| 대화상담(dialogue) | 일 5턴(현행) | 일 2턴 | 무료 3턴(평생) 후 멤버십 |
| 궁합(compat) | 월 3회(현행) | 월 1회 | 카드 단건 9,900 |
| 가족사주 | 5명(현행) | — | — |
| yearly 해석 | 포함 | 포함(현행) | 단건 |

> "무제한"은 `isPremiumMember` 게이트만으로 처리(소비 추적 불필요). 월 N회는 기존 `consumeMemberBenefit(benefit, monthlyPeriodKey, N)` 엔진을 그대로 사용.

---

## File Structure

**신규**
- `src/lib/payments/coin-sunset.ts` — 코인 발행 중단 플래그·헬퍼(단일 출처). `COIN_TOPUP_ENABLED=false`, `isCreditPackage(pkg)`, `userHasLegacyCoins(userId)`.
- `supabase/migrations/0NN_stop_coin_issuance.sql` — `handle_new_user` 가입보너스 코인 0으로 변경(레거시 함수 교체).
- `tests/payments/coin-sunset.spec.ts`, `tests/credits/member-feature-access.spec.ts`, `tests/payments/membership-no-coin-grant.spec.ts` — 단위 테스트.

**수정**
- `src/lib/payments/catalog.ts` — 코인팩 `purchasable:false` 플래그(또는 노출목록 분리).
- `src/app/api/payments/prepare/route.ts` — 코인팩 packageId 결제요청 거부.
- `src/lib/payments/fulfillment.ts:177-186` — `pkg.credits>0 && pkg.kind==='subscription'|'credits'` 코인지급 분기 제거(멤버십은 쿼터로 대체).
- `src/lib/credits/member-benefits.ts:5-10` — `MEMBER_BENEFITS` 에 detail/calendar 항목 추가 + plus 한도.
- `src/lib/credits/detail-report-access.ts:287-324` — 멤버십 게이트 삽입(코인 게이트 위).
- `src/lib/credits/calendar-access.ts:92-131` — 동일.
- `src/app/api/ai/route.ts` (대화 페이월 카피·CTA) + `src/components/.../dialogue-chat-panel.tsx`(#529 CTA) — 코인충전 CTA → 멤버십.
- `src/app/credits/page.tsx` — 충전 UI 제거 → 잔액조회/소진안내(잔액>0 인 사용자만).
- `src/app/api/admin/credits/grant/route.ts` — 일반 코인지급 차단(또는 super_admin 보상용으로 명시 격리).
- 페이월 UI(상세풀이/달력/궁합 lock 컴포넌트) — 비회원에 카드 단건 + 멤버십 노출, 코인 옵션은 레거시 잔액 보유자에게만.

---

# Phase 1 — 신규 코인 발행 중단 + 카드전용 확정

> 목표: 신규 사용자에게 코인이 1개도 생기지 않게 한다(충전·가입보너스·멤버십지급·관리자). 기존 잔액은 그대로 사용. 이 Phase만으로도 "선불수단 신규 발행 0" 달성 = PG/법적 노출 차단.

### Task 1: 코인 발행 중단 플래그 + 코인팩 식별 헬퍼

**Files:**
- Create: `src/lib/payments/coin-sunset.ts`
- Test: `tests/payments/coin-sunset.spec.ts`
- Reference: `src/lib/payments/catalog.ts` (PAYMENT_PACKAGES, PaymentPackage 타입, kind 필드)

**Interfaces:**
- Produces: `COIN_TOPUP_ENABLED: boolean`(=false), `isCreditPackage(pkg: PaymentPackage): boolean`(kind==='credits'), `assertCoinTopupAllowed(pkg): void`(코인팩이면 throw).

- [ ] **Step 1: 실패 테스트 작성** `tests/payments/coin-sunset.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { isCreditPackage, COIN_TOPUP_ENABLED, assertCoinTopupAllowed } from '@/lib/payments/coin-sunset';
import { getPackage } from '@/lib/payments/catalog';

describe('coin sunset', () => {
  it('코인 충전은 비활성', () => {
    expect(COIN_TOPUP_ENABLED).toBe(false);
  });
  it('credit_15 는 코인팩으로 식별', () => {
    expect(isCreditPackage(getPackage('credit_15')!)).toBe(true);
  });
  it('멤버십/단건상품은 코인팩 아님', () => {
    expect(isCreditPackage(getPackage('membership_premium')!)).toBe(false);
    expect(isCreditPackage(getPackage('taste_today_detail')!)).toBe(false);
  });
  it('코인팩 결제요청은 거부(throw)', () => {
    expect(() => assertCoinTopupAllowed(getPackage('credit_15')!)).toThrow();
    expect(() => assertCoinTopupAllowed(getPackage('membership_premium')!)).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:spec -- coin-sunset` → FAIL(모듈 없음)

- [ ] **Step 3: 구현** `src/lib/payments/coin-sunset.ts`

```typescript
// 2026-06-30 — 나이스페이 카드전용 제약: 선불충전(코인) 신규 발행 전면 중단.
//   기존 보유 잔액 차감(deduct_credits)은 레거시로 유지(만료일까지 소진).
import type { PaymentPackage } from '@/lib/payments/catalog';

/** 코인 신규 발행(충전 판매) 허용 여부. 카드전용 전환으로 영구 false. */
export const COIN_TOPUP_ENABLED = false;

export function isCreditPackage(pkg: PaymentPackage): boolean {
  return pkg.kind === 'credits';
}

export function assertCoinTopupAllowed(pkg: PaymentPackage): void {
  if (!COIN_TOPUP_ENABLED && isCreditPackage(pkg)) {
    throw new Error('코인 충전은 현재 제공하지 않습니다.');
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm run test:spec -- coin-sunset` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(payments): 코인 발행 중단 플래그·헬퍼 추가"`

### Task 2: prepare API 가 코인팩 결제요청 거부

**Files:**
- Modify: `src/app/api/payments/prepare/route.ts` (getPackage 검증 직후, PaymentOrder 생성 전)
- Test: `tests/payments/coin-sunset.spec.ts` (확장)

**Interfaces:** Consumes `assertCoinTopupAllowed`(Task 1).

- [ ] **Step 1: 변경** — `getPackage(packageId)` 로 `pkg` 확보한 직후 가드 추가. 코드:

```typescript
import { assertCoinTopupAllowed } from '@/lib/payments/coin-sunset';
// ...pkg 검증 직후:
if (pkg.kind === 'credits') {
  return NextResponse.json({ ok: false, error: '코인 충전은 현재 제공하지 않습니다.' }, { status: 410 });
}
```
(라우트가 NextResponse 가 아니라 헬퍼 반환 형태면 동일 의미의 거부 응답으로.)

- [ ] **Step 2: 회귀 확인** — Run: `npm run typecheck` → no error. `npm run build` → EXIT 0.
- [ ] **Step 3: 커밋** — `git commit -m "fix(payments): prepare 에서 코인팩 결제요청 차단(410)"`

### Task 3: 멤버십 결제 시 코인 지급 중단

**Files:**
- Modify: `src/lib/payments/fulfillment.ts:177-186` (pkg.credits>0 → addCredits 분기)
- Test: `tests/payments/membership-no-coin-grant.spec.ts`

**Interfaces:** Consumes 기존 `activateMembershipSubscription`(유지). Produces: 멤버십 fulfill 시 `addCredits` 미호출.

- [ ] **Step 1: 실패 테스트** — `fulfillPaymentOrder` 가 멤버십 패키지에서 `addCredits` 를 호출하지 않음을 검증(addCredits 모킹/스파이). 핵심 단언:

```typescript
// premium 멤버십 fulfill 시 addCredits 호출 0회, activateMembershipSubscription 1회
expect(addCreditsSpy).not.toHaveBeenCalled();
expect(activateSpy).toHaveBeenCalledWith(userId, expect.objectContaining({ plan: 'premium_monthly' }));
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:spec -- membership-no-coin-grant` → FAIL
- [ ] **Step 3: 구현** — fulfillment.ts 의 코인지급 분기를 "멤버십(kind==='subscription')은 코인 미지급, credits 팩은 애초에 prepare 에서 차단되어 도달 불가"로 변경. 즉 `if (pkg.credits > 0)` 블록을 제거하거나 `if (pkg.credits > 0 && pkg.kind !== 'subscription' && pkg.kind !== 'credits')` 로 좁혀 사실상 비활성화. 멤버십은 기존 `activateMembershipSubscription` 호출만 유지.
- [ ] **Step 4: 통과 확인** — `npm run test:spec -- membership-no-coin-grant` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(payments): 멤버십 결제 시 코인 지급 중단(정액 이용권으로 대체)"`

### Task 4: 가입보너스 코인 0 (마이그레이션)

**Files:**
- Create: `supabase/migrations/0NN_stop_coin_issuance.sql` (번호=직전+1)
- Reference: `supabase/migrations/040_credit_lots_expiry.sql:432-463` (handle_new_user)

- [ ] **Step 1: 마이그레이션 작성** — `handle_new_user` 를 재정의(CREATE OR REPLACE FUNCTION)하여 신규 가입 시 3코인 lot INSERT 부분 제거(나머지 프로필 생성 로직은 040 원문 그대로 보존). 무료 체험은 대화 무료 3턴(코드 상수, 코인 불필요)으로 대체되므로 가입보너스 코인 불필요.
- [ ] **Step 2: 로컬/스테이징 적용·검증** — `supabase db ... ` 로 적용 후, 신규 유저 생성 시 `credit_lots` 0건 확인(SQL). (프로덕션 적용은 배포 체크리스트에서 수동.)
- [ ] **Step 3: 커밋** — `git commit -m "feat(db): 가입보너스 코인 지급 중단(handle_new_user)"`

### Task 5: 관리자 일반 코인지급 차단

**Files:** Modify: `src/app/api/admin/credits/grant/route.ts`

- [ ] **Step 1: 변경** — 일반 코인지급을 비활성(`COIN_TOPUP_ENABLED` 가드로 403/410 반환). CS 보상이 필요하면 "무료 언락권 지급"으로 대체(Phase 2 엔타이틀먼트 지급 라우트 재사용) — 단, 이번 Task 는 "코인 신규지급 차단"까지만.
- [ ] **Step 2: 회귀** — `npm run typecheck` → OK
- [ ] **Step 3: 커밋** — `git commit -m "fix(admin): 일반 코인 수동지급 차단(코인 sunset)"`

### Task 6: /credits 페이지를 "충전" → "잔액/소진 안내"로 전환

**Files:** Modify: `src/app/credits/page.tsx` (충전 패키지 목록·결제 CTA 제거)

- [ ] **Step 1: 변경** — 코인팩 선택·결제 CTA·결제수단/동의 블록 제거. 대신: (a) 잔액>0 인 사용자에게는 "보유 코인 N개 · YYYY-MM-DD까지 사용 가능(추가 충전은 종료됨)" 안내 + 코인 쓰는 기능 링크. (b) 잔액=0 이면 멤버십/단건상품 안내로 리다이렉트 또는 안내 카드. StickyBottomBar 결제 CTA 제거(충전 없음).
- [ ] **Step 2: 렌더 검증(Playwright)** — `/credits` 가 충전 UI 없이 잔액/안내만 렌더. (잔액>0/=0 두 상태 스냅샷.)
- [ ] **Step 3: 커밋** — `git commit -m "feat(credits): 충전 페이지를 잔액·소진안내로 전환(코인 sunset)"`

### Task 7: 코인충전 유도 CTA 제거·교체

**Files:** Modify: `src/components/.../dialogue-chat-panel.tsx`(#529 "코인 충전 바로가기"), 기타 `/credits` 링크 진입점(grep `'/credits'`).

- [ ] **Step 1: grep** — `grep -rn "/credits" src/` 로 코인충전 유도 진입점 전수 확인.
- [ ] **Step 2: 변경** — 충전 유도 CTA를 "멤버십 보기"(`/membership`) 또는 해당 단건상품 카드결제 진입으로 교체. 단, `/credits`(잔액조회)로의 정당한 링크는 잔액 보유자 한정으로 유지 가능.
- [ ] **Step 3: 커밋** — `git commit -m "fix(ui): 코인충전 유도 CTA를 멤버십/단건결제로 교체"`

> **Phase 1 종료 게이트:** 신규 가입자에게 코인 0, 코인 충전 불가(410), 멤버십 결제 시 코인 미지급, 기존 잔액은 여전히 차감 가능. `npm run test:spec` + `npm run build` 그린. (이 시점에 "한꺼번에" 배포해도 기존 사용자 기능 손실 없음.)

---

# Phase 2 — 멤버십 정액이용권화 (코인 가치 대체)

### Task 8: 멤버 등급별 확정 쿼터(MEMBER_QUOTAS) 정의

**Files:**
- Modify: `src/lib/credits/member-benefits.ts` (기존 MEMBER_BENEFITS 옆에 추가; benefit-key 는 period 버킷용)
- Test: `tests/credits/member-benefits.spec.ts`

**Interfaces:** Produces: `MEMBER_QUOTAS[tier]`(tier='premium'|'plus'), 각 값=정수 한도 또는 `null`(무제한). `MEMBER_BENEFIT_KEYS`(benefit 문자열+period) — `consumeMemberBenefit` 버킷용. 게이트(T10/11/12/15)는 모두 `MEMBER_QUOTAS[tier].X` 를 한도로 사용.

- [ ] **Step 1: 실패 테스트** — 확정 쿼터(2026-06-30 승인) 검증:

```typescript
import { MEMBER_QUOTAS } from '@/lib/credits/member-benefits';
it('확정 멤버 쿼터', () => {
  expect(MEMBER_QUOTAS.premium).toMatchObject({ detailMonthly: null, calendarMonthly: null, dialogueDaily: 5, compatMonthly: 3 });
  expect(MEMBER_QUOTAS.plus).toMatchObject({ detailMonthly: 3, calendarMonthly: 1, dialogueDaily: 2, compatMonthly: 1 });
});
```

- [ ] **Step 2: 실패 확인** — `npm run test:spec -- member-benefits` → FAIL
- [ ] **Step 3: 구현** — member-benefits.ts 에 추가:

```typescript
/** benefit period 버킷 키(consumeMemberBenefit 용). 한도는 등급별 MEMBER_QUOTAS 참조. */
export const MEMBER_BENEFIT_KEYS = {
  detailMonthly:   { benefit: 'detail_monthly',   period: 'month' },
  calendarMonthly: { benefit: 'calendar_monthly', period: 'month' },
  dialogueDaily:   { benefit: 'dialogue_daily',   period: 'day' },
  compatMonthly:   { benefit: 'compat_monthly',   period: 'month' },
} as const;

/** 2026-06-30 사용자 승인 확정 쿼터. null = 무제한(소비추적 없이 게이트 통과). */
export const MEMBER_QUOTAS = {
  premium: { detailMonthly: null, calendarMonthly: null, dialogueDaily: 5, compatMonthly: 3 },
  plus:    { detailMonthly: 3,    calendarMonthly: 1,    dialogueDaily: 2, compatMonthly: 1 },
} as const;
```
(기존 `MEMBER_BENEFITS.dialogueDaily`(5)·`compatMonthly`(3) 은 호환 위해 유지하되, 신규 게이트는 등급별 `MEMBER_QUOTAS` 사용.)

- [ ] **Step 4: 통과 확인** → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(credits): 멤버 등급별 확정 쿼터(MEMBER_QUOTAS) 정의"`

### Task 9: 플러스/프리미엄 등급 판별 헬퍼

**Files:** Modify: `src/lib/subscription.ts` (isPremiumMember 옆에 isPlusMember/getMemberTier 추가)
**Test:** `tests/subscription.spec.ts`

**Interfaces:** Produces: `isPlusMember(userId): Promise<boolean>`(plan==='plus_monthly' && active), `getMemberTier(userId): Promise<'premium'|'plus'|null>`.

- [ ] **Step 1: 실패 테스트** — readSubscription 모킹으로 plan별 tier 반환 검증.
- [ ] **Step 2~4: 구현/통과** — 기존 `isPremiumMember` 패턴 복제:

```typescript
export async function isPlusMember(userId: string): Promise<boolean> {
  if (!userId) return false;
  const sub = await getManagedSubscription(userId);
  return sub?.status === 'active' && sub.plan === 'plus_monthly';
}
export async function getMemberTier(userId: string): Promise<'premium' | 'plus' | null> {
  if (!userId) return null;
  const sub = await getManagedSubscription(userId);
  if (sub?.status !== 'active') return null;
  if (sub.plan === 'premium_monthly') return 'premium';
  if (sub.plan === 'plus_monthly') return 'plus';
  return null;
}
```

- [ ] **Step 5: 커밋** — `git commit -m "feat(subscription): isPlusMember/getMemberTier 추가"`

### Task 10: 멤버십 게이트를 상세풀이 접근에 삽입

**Files:**
- Modify: `src/lib/credits/detail-report-access.ts:287-324` (`unlockDetailReport`)
- Test: `tests/credits/member-feature-access.spec.ts`

**Interfaces:** Consumes `getMemberTier`(T9), `consumeMemberBenefit`/`MEMBER_BENEFITS`(T8), 기존 `recordDetailReportAccess`. Produces: 멤버 접근 시 코인 미차감, 접근결과 `{success:true, viaMembership:true}`.

게이트 순서(신규): **(1)기존 access → (2)멤버십(premium 무제한 / plus 월쿼터 consume) → (3)레거시 코인(unlockCreditsOnce→deductCredits) → (4)실패=페이월**.

- [ ] **Step 1: 실패 테스트** — premium 은 코인 0이어도 success & deductCredits 미호출; plus 는 월 3회까지 success 후 4회째 코인/페이월; 비회원+코인0 은 실패(페이월).
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — gate 1(`hasDetailReportAccess`) 직후, 코인 게이트(line 299 `unlockCreditsOnce`) **앞에** 삽입:

```typescript
const tier = await getMemberTier(userId); // 'premium' | 'plus' | null
if (tier) {
  const limit = MEMBER_QUOTAS[tier].detailMonthly; // null = 무제한
  const granted =
    limit === null
      ? true
      : await consumeMemberBenefit(userId, MEMBER_BENEFIT_KEYS.detailMonthly.benefit, monthlyPeriodKey(), limit);
  if (granted) {
    await recordDetailReportAccess(userId, readingKey);
    return { success: true, remaining: await getRemainingCredits(userId), reused: false, viaMembership: true };
  }
  // 한도 초과 → 아래 레거시 코인/페이월로 폴스루
}
// (기존 line 299~ 코인 게이트 그대로: 레거시 잔액 보유자 소진용)
```
`DetailReportUnlockResult` 타입에 `viaMembership?: boolean` 추가.

- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `git commit -m "feat(credits): 상세풀이 접근에 멤버십 게이트 삽입(코인 앞)"`

### Task 11: 멤버십 게이트를 달력 접근에 삽입

**Files:** Modify `src/lib/credits/calendar-access.ts:92-131` (`unlockFortuneCalendarMonth`). Test 확장.

- [ ] **Step 1~4:** Task 10 과 동일 패턴 — `MEMBER_QUOTAS[tier].calendarMonthly`(premium null=무제한 / plus 1) 로 게이트, `MEMBER_BENEFIT_KEYS.calendarMonthly.benefit` consume, 코인 게이트(line 106~)는 레거시 유지. `FortuneCalendarUnlockResult` 에 `viaMembership?` 추가.
- [ ] **Step 5: 커밋** — `git commit -m "feat(credits): 운세달력 접근에 멤버십 게이트 삽입"`

### Task 12: 궁합 plus 멤버 월쿼터

**Files:** Modify `src/lib/payments/compatibility-access.ts` (기존 premium 월3회 compat 게이트). Test.

- [ ] **Step 1~4:** `MEMBER_QUOTAS[tier].compatMonthly`(premium 3 / plus 1) 로 게이트(`MEMBER_BENEFIT_KEYS.compatMonthly.benefit` consume). 비회원은 카드 단건(compat-reading/love-question) 그대로.
- [ ] **Step 5: 커밋** — `git commit -m "feat(compat): plus 멤버 궁합 월쿼터 추가"`

### Task 13: 멤버십 체크아웃·소개 카피 재표현

**Files:** Modify `src/lib/payments/catalog.ts`(멤버십 benefits 문구), `/membership` 소개·체크아웃 주문요약.

- [ ] **Step 1: 변경** — "매월 90코인 지급" → "상세풀이·달력 무제한 · 대화 매일 5건 · 궁합 월 3회 · 가족 5명"(premium), plus 도 쿼터 문구로. **금지문구 가드**(준비중/출시예정) 통과 확인.
- [ ] **Step 2: 렌더 검증** — `/membership`·체크아웃에서 코인 문구 0건(grep + Playwright 텍스트).
- [ ] **Step 3: 커밋** — `git commit -m "feat(membership): 혜택 카피를 정액 이용권으로 재표현"`

> **Phase 2 종료 게이트:** 프리미엄 회원이 코인 0으로 상세풀이·달력·대화·궁합 정상 이용. 플러스 회원 월쿼터 동작. `npm run test:spec` 그린.

---

# Phase 3 — 비회원 페이월을 카드/멤버십으로

### Task 14: 상세풀이/달력 페이월 UI 재구성

**Files:** Modify 상세풀이·달력 lock/페이월 컴포넌트(grep `detail_report`·`calendar` lock UI, `score-lock-gate.tsx` 등 패턴 참고).

- [ ] **Step 1: 변경** — 비회원·미언락 시 옵션: ①카드 단건 9,900(기존 taste 상품 결제 진입) ②멤버십 가입(무제한/쿼터). **코인 사용 옵션은 잔액>0 인 사용자에게만** 표시(`userHasLegacyCoins`). 잔액 0이면 코인 옵션 숨김.
- [ ] **Step 2: 렌더 검증(Playwright)** — 비회원(코인0)=카드+멤버십만, 레거시(코인>0)=코인 옵션 추가 노출.
- [ ] **Step 3: 커밋** — `git commit -m "feat(paywall): 상세풀이·달력 페이월을 카드+멤버십 중심으로"`

### Task 15: 대화상담 페이월을 멤버십으로

**Files:** Modify `src/app/api/ai/route.ts`(멤버 일일혜택 한도 tier화 + insufficient_credits 응답 카피/billing), `dialogue-chat-panel.tsx`(소진 후 안내).

- [ ] **Step 1a: 멤버 일일 대화 한도 tier화** — 현재 route 는 `isPremiumMember` + `MEMBER_BENEFITS.dialogueDaily.limit`(5)만 사용(plus 미반영). `getMemberTier(user.id)` 로 바꾸고 한도를 `MEMBER_QUOTAS[tier].dialogueDaily`(premium 5 / plus 2)로, `consumeMemberBenefit(user.id, MEMBER_BENEFIT_KEYS.dialogueDaily.benefit, dailyKey, limit)` 호출. (게이트 위치는 기존 "member daily benefit → free → coin" 순서 그대로.)
- [ ] **Step 1b: 페이월 카피** — 비회원이 무료 3턴 소진 시: 응답을 "코인 부족"이 아니라 "멤버십 가입 시 매일 대화" 안내 + `/membership` CTA. 코인 번들 차감 경로(line 929~)는 **레거시 잔액 보유자에게만** 도달(잔액>0)하도록 유지하되, 잔액 0 비회원은 멤버십 페이월 응답으로.
- [ ] **Step 2: 검증** — 비회원 4번째 턴 응답이 멤버십 CTA. 프리미엄은 일5턴 정상.
- [ ] **Step 3: 커밋** — `git commit -m "fix(ai): 대화 페이월을 코인충전 대신 멤버십으로"`

> **Phase 3 종료 게이트:** 신규 비회원은 코인 없이도 카드 단건/멤버십으로 모든 유료기능 도달, 코인충전 유도 0건. 레거시 코인 보유자는 잔액으로 계속 사용.

---

# Phase 4 — 정리·검증·감사

### Task 16: 카피/정합성 정리

- [ ] `credits/page.tsx:369` 등 "N코인" 마케팅 카피 잔재 제거(grep `코인`), love-question "10코인" 불일치(실제 카드결제) 정리.
- [ ] 결제수단 카드전용 최종 확인(picker 계좌이체/가상계좌/휴대폰 비노출). 커밋.

### Task 17: E2E·감사

- [ ] **신규 비회원 플로우 E2E**: 가입→코인 0 확인→상세풀이 카드결제 or 멤버십→대화 무료3턴 후 멤버십 CTA.
- [ ] **프리미엄 플로우 E2E**: 코인 0으로 상세풀이·달력·대화·궁합 정상.
- [ ] **레거시 코인 보유자**: 잔액으로 상세풀이 차감 정상(소진 유예 동작).
- [ ] `npm test` + `npm run test:spec` + `npm run e2e` + `npm run build` 그린.
- [ ] 커밋 + PR(ganji-saju 계정) + 머지.

---

## 배포 체크리스트(한꺼번에 적용 — 사용자 결정)
1. Supabase 마이그레이션(Task 4) 수동 적용(번호 확인).
2. main 머지 → Vercel 자동 배포.
3. 배포 후 프로덕션 확인: 코인 충전 불가(410)·신규 가입 코인0·멤버십 코인 미지급·프리미엄 무코인 이용·레거시 잔액 사용 가능.
4. (배포 후) `docs/payments-card-only-restructure.md` §6 법무/PG 확인 항목 별도 진행.

## Rollback
- 코드: 각 Task 커밋 단위 revert. `COIN_TOPUP_ENABLED=true` 한 줄로 충전 재개(긴급 복구) — 단 PG/법적 사유로 권장 안 함.
- DB: `handle_new_user` 는 040 원문으로 되돌리는 역마이그레이션 준비(가입보너스 코인 복구 시).
- 기존 잔액은 비파괴라 롤백 리스크 낮음.

## Self-Review (작성자 점검 완료)
- **Spec coverage:** 코인폐지(T1-7)·멤버십이용권화(T8-13)·비회원페이월(T14-15)·정리(T16-17) — `docs/payments-card-only-restructure.md` §1-5 항목 매핑됨. 기존잔액 소진유예(글로벌제약+T6/T14/T15 레거시 게이트). 대화 단건턴팩 없음(제약 준수, T15).
- **Placeholder scan:** 신규 코드 블록은 실제 코드 포함. 기존파일 수정은 정확한 file:line + 삽입 코드 명시. UI Task 는 "변경 내용+검증 방법" 구체화(코드 본문은 컴포넌트 구조 확인 후 실행 단계에서).
- **Type consistency:** `getMemberTier`(T9)→T10/T11/T12 사용, `viaMembership?` 결과타입 확장, `MEMBER_BENEFITS.detailMonthly/calendarMonthly`(T8)→T10/T11 consume — 명칭 일치.
- **알려진 보완점(실행 시 확인):** 페이월/lock 컴포넌트의 정확한 경로·props 는 Task 14/15 실행 시 grep 으로 확정(현재 패턴: score-lock-gate.tsx). plus 한도 수치는 위 "제안 쿼터" 표 확정 후 T8 상수 반영.
