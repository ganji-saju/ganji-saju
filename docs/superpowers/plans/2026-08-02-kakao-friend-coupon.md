# 카카오 친구추가 → 오늘 자세히보기 무료 쿠폰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (또는 executing-plans). 스텝은 `- [ ]` 체크박스.

**Goal:** 카카오 채널 친구추가(검증형)를 확인해 오늘 자세히보기(3,300원) 무료 쿠폰을 계정당 1회 발급하고, 결제창에서 0원 직접 지급으로 사용. 전 기능을 `KAKAO_FRIEND_COUPON_ENABLED` 로 **휴면 배포**.

**Architecture:** 신규 `user_coupons` 테이블 + 순수 쿠폰 스토어 lib(발급가능/만료 판정은 순수함수로 분리해 유닛테스트) + redeem API(PG·결제원장·전차감 미경유, 멤버십 무료 언락 프리미티브 `recordTodayFortunePremiumAccess`[amount:0]로 접근 기록 + redeemed 원자 마킹) + 카카오 `plus_friends` 채널 친구여부 검증(별도 OAuth, 메인 로그인 스코프 불변) + 상태기반 공용 CTA 4곳. 모두 env 게이트.

**Tech Stack:** Next.js(비표준 — `node_modules/next/dist/docs/` 참조), Supabase(service client), 커스텀 카카오 OAuth, 유닛러너 `node scripts/run-unit-tests.mjs`(vitest 아님).

## Global Constraints

- **설계 근거(SSOT): `docs/superpowers/specs/2026-08-02-kakao-friend-coupon-recovered-design.md`** (복구된 확정 설계).
- **돈/이용권 안전(최우선):** 0원 지급은 **PG·`payment_orders` 미경유**(045 `amount>0` CHECK 회피). 쿠폰 사용은 **원자적**(redeemed 마킹 0행이면 중단=중복사용 차단). 이용권은 결제 단건과 동일 스코프로만 지급.
- **계정당 1회:** `UNIQUE(user_id, type)` DB 강제(앱 로직만 믿지 말 것).
- **전 기능 휴면:** 발급/사용/CTA/상태 API 모두 `process.env.KAKAO_FRIEND_COUPON_ENABLED === '1'` 아니면 비활성(발급·redeem은 403/404, CTA·배너 미렌더). 기존 env-gated 패턴(`isTodayFortuneLlmEnabled` 류) 준수.
- **메인 로그인 스코프 불변:** 카카오 로그인 콜백(`/api/auth/kakao/callback`, 현재 scope=openid)은 건드리지 않는다. 검증은 별도 OAuth(`/api/auth/kakao/coupon-verify`).
- **채널 일치:** 친구여부를 검증하는 채널 = `addKakaoChannel()` 이 추가하는 채널(`kakaoChannelId`, `src/lib/kakao/channel.ts`). `_QVQxbX`(문의 URL)와 혼동 금지 — 실제 friend-talk 채널 ID로 검증.
- **마이그레이션 수동적용:** 072 는 supabase CLI 수동 적용(프로젝트 관례). 플랜은 파일만 생성.
- **작업 브랜치**(main 직접 금지). PR/머지 `./scripts/gh-ganji`. 커밋 끝줄 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- 테스트: `npm test`(전량), 포커스 `npm test 2>&1 | grep -iE "coupon|쿠폰"`. 타입체크 `npm run typecheck`.

---

## Setup

- [ ] `git checkout -b feat/kakao-friend-coupon`

---

## Phase 1 — 코어 (카카오 독립 · 유닛테스트 가능 · 휴면 머지 가능)

### Task 1: migration 072 + env 플래그 + 쿠폰 상수/타입

**Files:**
- Create: `supabase/migrations/072_user_coupons.sql`
- Create: `src/lib/coupons/kakao-friend-coupon.ts` (상수/타입/플래그만; 로직은 Task 2)
- Test: `src/lib/coupons/kakao-friend-coupon.flag.test.ts`

**Interfaces produced:** `KAKAO_FRIEND_COUPON_TYPE = 'kakao_friend_today_detail'`, `COUPON_EXPIRY_DAYS = 7`, `isKakaoFriendCouponEnabled(env?): boolean`, `type CouponStatus = 'issued' | 'redeemed'`, `interface UserCouponRow`.

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- 072_user_coupons.sql — 카카오 친구추가 무료쿠폰(오늘 자세히보기 1회). 계정당 1회.
create table if not exists public.user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  status text not null default 'issued' check (status in ('issued','redeemed')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redemption_reading_key text,
  entitlement_id uuid,
  verified_kakao_uid text,
  constraint user_coupons_unique_per_type unique (user_id, type)
);
create index if not exists user_coupons_user_idx on public.user_coupons(user_id);
alter table public.user_coupons enable row level security;
-- 본인 조회만. 발급/사용은 service role(RLS 우회)로만.
drop policy if exists user_coupons_select_own on public.user_coupons;
create policy user_coupons_select_own on public.user_coupons
  for select using (auth.uid() = user_id);
```

- [ ] **Step 2: 플래그 테스트(실패 확인)**

```ts
// kakao-friend-coupon.flag.test.ts
import assert from 'node:assert/strict';
import { isKakaoFriendCouponEnabled, KAKAO_FRIEND_COUPON_TYPE, COUPON_EXPIRY_DAYS } from '@/lib/coupons/kakao-friend-coupon';
declare const test: (name: string, fn: () => void) => void;
test('kakao coupon: env 게이트 기본 OFF, "1" 에서만 ON', () => {
  assert.equal(isKakaoFriendCouponEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(isKakaoFriendCouponEnabled({ KAKAO_FRIEND_COUPON_ENABLED: '0' } as never), false);
  assert.equal(isKakaoFriendCouponEnabled({ KAKAO_FRIEND_COUPON_ENABLED: '1' } as never), true);
});
test('kakao coupon: 상수', () => {
  assert.equal(KAKAO_FRIEND_COUPON_TYPE, 'kakao_friend_today_detail');
  assert.equal(COUPON_EXPIRY_DAYS, 7);
});
```
Run: `npm test 2>&1 | grep -iE "kakao coupon"` → FAIL(모듈 없음).

- [ ] **Step 3: 구현**

```ts
// src/lib/coupons/kakao-friend-coupon.ts
export const KAKAO_FRIEND_COUPON_TYPE = 'kakao_friend_today_detail';
export const COUPON_EXPIRY_DAYS = 7;

export type CouponStatus = 'issued' | 'redeemed';

export interface UserCouponRow {
  id: string;
  user_id: string;
  type: string;
  status: CouponStatus;
  issued_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redemption_reading_key: string | null;
  entitlement_id: string | null;
  verified_kakao_uid: string | null;
}

// 휴면 게이트. 미설정/'0' → OFF. '1' → ON. (isTodayFortuneLlmEnabled 컨벤션)
export function isKakaoFriendCouponEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.KAKAO_FRIEND_COUPON_ENABLED?.trim() === '1';
}
```
Run: `npm test 2>&1 | grep -iE "kakao coupon"` → PASS. `npm run typecheck` → 0.

- [ ] **Step 4: Commit** `feat(coupon): user_coupons migration + env 게이트·상수(휴면)`

---

### Task 2: 쿠폰 스토어 — 순수 판정 + DB CRUD

**Files:**
- Modify: `src/lib/coupons/kakao-friend-coupon.ts` (판정 순수함수 + store 함수)
- Test: `src/lib/coupons/kakao-friend-coupon.test.ts`

**Interfaces produced:**
- 순수: `couponAvailability(row: UserCouponRow | null, now: Date): 'issuable' | 'redeemable' | 'redeemed' | 'expired'`
- DB: `getUserCoupon(userId): Promise<UserCouponRow | null>`, `issueKakaoFriendCoupon(userId, verifiedKakaoUid): Promise<{ ok: true; row } | { ok: false; reason }>`(멱등: UNIQUE 위반 시 기존행 반환), `markCouponRedeemed(userId, { readingKey, entitlementId }): Promise<boolean>`(0행=false=중복).

- [ ] **Step 1: 순수 판정 테스트(실패)**

```ts
import assert from 'node:assert/strict';
import { couponAvailability } from '@/lib/coupons/kakao-friend-coupon';
import type { UserCouponRow } from '@/lib/coupons/kakao-friend-coupon';
declare const test: (name: string, fn: () => void) => void;
const NOW = new Date('2026-08-10T00:00:00Z');
const base: UserCouponRow = { id:'c', user_id:'u', type:'kakao_friend_today_detail', status:'issued',
  issued_at:'2026-08-05T00:00:00Z', expires_at:'2026-08-12T00:00:00Z', redeemed_at:null,
  redemption_reading_key:null, entitlement_id:null, verified_kakao_uid:'k' };
test('coupon: 판정 — 없음=issuable / 유효=redeemable / 만료 / 사용됨', () => {
  assert.equal(couponAvailability(null, NOW), 'issuable');
  assert.equal(couponAvailability(base, NOW), 'redeemable');
  assert.equal(couponAvailability({ ...base, expires_at:'2026-08-09T00:00:00Z' }, NOW), 'expired');
  assert.equal(couponAvailability({ ...base, status:'redeemed' }, NOW), 'redeemed');
});
```
Run → FAIL.

- [ ] **Step 2: 순수 판정 구현**

```ts
export function couponAvailability(
  row: UserCouponRow | null,
  now: Date = new Date()
): 'issuable' | 'redeemable' | 'redeemed' | 'expired' {
  if (!row) return 'issuable';
  if (row.status === 'redeemed') return 'redeemed';
  if (now.getTime() >= new Date(row.expires_at).getTime()) return 'expired';
  return 'redeemable';
}
```
Run → PASS.

- [ ] **Step 3: DB 함수 추가** (createServiceClient 사용; 기존 lib 패턴 참조 — 예: `src/lib/product-entitlements.ts` 의 `createServiceClient` import 및 사용)

```ts
import { createServiceClient } from '@/lib/supabase/service'; // 실제 경로는 product-entitlements.ts 의 import 를 그대로 따를 것
import { COUPON_EXPIRY_DAYS, KAKAO_FRIEND_COUPON_TYPE } from './kakao-friend-coupon';

export async function getUserCoupon(userId: string): Promise<UserCouponRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc.from('user_coupons').select('*')
    .eq('user_id', userId).eq('type', KAKAO_FRIEND_COUPON_TYPE).maybeSingle();
  return (data as UserCouponRow) ?? null;
}

export async function issueKakaoFriendCoupon(userId: string, verifiedKakaoUid: string) {
  const svc = await createServiceClient();
  const expiresAt = new Date(Date.now() + COUPON_EXPIRY_DAYS * 864e5).toISOString();
  const { data, error } = await svc.from('user_coupons')
    .insert({ user_id: userId, type: KAKAO_FRIEND_COUPON_TYPE, status: 'issued',
      expires_at: expiresAt, verified_kakao_uid: verifiedKakaoUid })
    .select('*').single();
  if (error) {
    // UNIQUE 위반(23505) = 이미 발급 → 멱등하게 기존행 반환
    const existing = await getUserCoupon(userId);
    if (existing) return { ok: true as const, row: existing };
    return { ok: false as const, reason: 'insert_failed' };
  }
  return { ok: true as const, row: data as UserCouponRow };
}

// 원자적 사용 마킹: issued 인 행만 redeemed 로. 0행 update = 이미 사용/만료 = 중복 → false.
export async function markCouponRedeemed(
  userId: string, meta: { readingKey: string; entitlementId: string | null }
): Promise<boolean> {
  const svc = await createServiceClient();
  const { data } = await svc.from('user_coupons')
    .update({ status: 'redeemed', redeemed_at: new Date().toISOString(),
      redemption_reading_key: meta.readingKey, entitlement_id: meta.entitlementId })
    .eq('user_id', userId).eq('type', KAKAO_FRIEND_COUPON_TYPE).eq('status', 'issued')
    .select('id');
  return Array.isArray(data) && data.length > 0;
}
```
> 만료도 사용 차단: redeem API(Task 3)가 `couponAvailability`로 먼저 막고, `markCouponRedeemed`는 `status='issued'` 조건으로 동시성 방어. 만료행이 issued로 남아 있어도 API 게이트가 차단.

- [ ] **Step 4:** `npm run typecheck` 0 (DB 함수는 유닛테스트 대신 Task 3/리뷰로 커버; 순수 판정만 유닛). Commit `feat(coupon): 쿠폰 스토어(순수 판정 + issue/redeem-mark)`

---

### Task 3: redeem API — 0원 직접 지급(원자적)

**Files:**
- Create: `src/app/api/coupons/kakao-friend/redeem/route.ts`
- Test: `src/lib/coupons/redeem-guard.test.ts` (순수 가드 로직 분리 테스트)

**Interfaces:** `POST { slug, scope }` → 200 `{ ok, redirect }` | 4xx. 순수 헬퍼 `redeemPreconditions(enabled, authed, availability): { ok } | { ok:false; status; error }`.

- [ ] **Step 1: 순수 가드 테스트(실패)** — env OFF→404, 미인증→401, availability≠redeemable→409.

```ts
import assert from 'node:assert/strict';
import { redeemPreconditions } from '@/lib/coupons/kakao-friend-coupon';
declare const test: (name: string, fn: () => void) => void;
test('coupon redeem 가드', () => {
  assert.deepEqual(redeemPreconditions(false, true, 'redeemable'), { ok: false, status: 404, error: 'disabled' });
  assert.deepEqual(redeemPreconditions(true, false, 'redeemable'), { ok: false, status: 401, error: 'unauthorized' });
  assert.deepEqual(redeemPreconditions(true, true, 'expired'), { ok: false, status: 409, error: 'not_redeemable' });
  assert.deepEqual(redeemPreconditions(true, true, 'redeemable'), { ok: true });
});
```

- [ ] **Step 2: 가드 구현** (`kakao-friend-coupon.ts`)

```ts
export function redeemPreconditions(
  enabled: boolean, authed: boolean,
  availability: 'issuable' | 'redeemable' | 'redeemed' | 'expired'
): { ok: true } | { ok: false; status: number; error: string } {
  if (!enabled) return { ok: false, status: 404, error: 'disabled' };
  if (!authed) return { ok: false, status: 401, error: 'unauthorized' };
  if (availability !== 'redeemable') return { ok: false, status: 409, error: 'not_redeemable' };
  return { ok: true };
}
```
Run → PASS.

- [ ] **Step 3: route 구현** — 기존 today-detail unlock route(`src/app/api/today-fortune/unlock/route.ts`)의 인증·slug·scope 해석 패턴을 그대로 따를 것. 흐름:
  1. `isKakaoFriendCouponEnabled()` 아니면 404.
  2. 인증 유저 확인(미인증 401).
  3. body `{ slug, scope }` → unlock route(`src/app/api/today-fortune/unlock/route.ts`)와 **동일하게** reading 을 로드/소유검증하고 `readingKey`(`toSlug(reading.input)`)·`sourceSessionId`·`todayKey`(KST 일자)를 도출.
  4. `getUserCoupon(userId)` → `couponAvailability(row, now)` → `redeemPreconditions(enabled, authed, availability)`. **반드시 마킹 전에** 이 게이트를 통과해야 함(만료 차단은 여기 책임 — Task 2 리뷰 지적).
  5. **🔴 마킹 먼저(claim), 성공 시에만 지급(fulfill)** — grant-before-mark 면 동시요청 시 쿠폰 1개로 여러 reading 무료지급(TOCTOU). 반드시 이 순서:
     - `const marked = await markCouponRedeemed(userId, { readingKey, entitlementId: null })` (원자적 claim: status='issued'→'redeemed', 0행이면 false).
     - `if (!marked)`: 이미 소비됨. **같은 slug 동시요청의 승자가 이 reading 을 이미 지급**했을 수 있으니 `hasTodayFortunePremiumAccess(userId, sourceSessionId, todayKey)` 확인 → 있으면 200(멱등), 없으면 409 `not_redeemable`(다른 reading 에 쓰였음, 이 reading 은 무료 안 됨).
     - `if (marked)`: **지급 = `recordTodayFortunePremiumAccess(userId, readingKey, sourceSessionId, todayKey)`** (⚠️`unlockTodayFortunePremium`=전 차감 금지·`grantTasteProductEntitlement` 금지. `credit_transactions` amount:0 type:use feature:detail_report → 차감·원장·매출 0, `hasTodayFortunePremiumAccess`/`checkTodayDetailAccess` 인식 검증됨). **try/catch**: 지급이 throw 하면 쿠폰이 소비된 채 접근 미지급(lost coupon) → `rollbackCouponRedeemed(userId)`(status redeemed→issued)로 되돌리고 500. 성공이면 200.
  6. 200 `{ ok: true, redirect: <오늘자세히 결과 경로> }`.
> ⚠️ 구현자: **`payment_orders` 도 `grantTasteProductEntitlement` 도 `unlockTodayFortunePremium` 도 쓰지 말 것.** 오직 `recordTodayFortunePremiumAccess`(amount:0). PG·prepare/confirm·전 차감 전부 미경유.

- [ ] **Step 4:** `npm test`(가드 PASS·전량 0 not ok), `npm run typecheck` 0. Commit `feat(coupon): redeem API 0원 직접지급(원자적·PG 미경유·휴면)`

---

### Task 4: status API

**Files:** Create `src/app/api/coupons/kakao-friend/status/route.ts`

- [ ] `GET` → env OFF면 `{ enabled: false }`. ON+인증이면 `getUserCoupon`+`couponAvailability` → `{ enabled: true, state: 'issuable'|'redeemable'|'redeemed'|'expired', expiresAt }`. 미인증이면 `{ enabled: true, state: 'issuable' }`(발급 유도). today-detail unlock route 의 auth 패턴 참조. Commit `feat(coupon): status API(휴면)`.

---

## Phase 2 — 카카오 발급 검증 + UI

### Task 5: 카카오 채널 친구여부 검증 (순수 파싱 + coupon-verify OAuth)

**Files:**
- Create: `src/lib/kakao/channel-friendship.ts` (순수 파싱)
- Create: `src/app/api/auth/kakao/coupon-verify/route.ts` (별도 OAuth, plus_friends)
- Test: `src/lib/kakao/channel-friendship.test.ts`

**Interfaces:** 순수 `isChannelFriend(channelsApiJson, targetChannelUuid): boolean` (카카오 `GET /v1/api/talk/channels` 응답에서 `channels[].channel_public_id`/uuid 매칭 + `relation === 'added'`).

- [ ] **Step 1: 파싱 테스트(실패)** — added/미added/채널없음 3케이스. (카카오 응답 형태는 구현 시 카카오 문서/기존 콜백 참조해 정확히; 테스트는 대표 fixture JSON.)
- [ ] **Step 2: `isChannelFriend` 구현**(순수, 방어적 파싱).
- [ ] **Step 3: coupon-verify route** — `/api/auth/kakao/callback` 의 토큰교환 패턴을 미러링하되 **scope=`plus_friends`**, redirect_uri=`/api/auth/kakao/coupon-verify`. 흐름: env OFF→404 / code→token / `GET /v1/api/talk/channels`(Bearer) → `isChannelFriend(…, kakaoChannelId)` → friend면 발급(Task 6) 후 상태 페이지로 redirect. **메인 로그인 콜백 불변**. 카카오 API 호출은 mockFetch 로 유닛 가능.
- [ ] **Step 4:** typecheck 0, 파싱 테스트 PASS. Commit `feat(coupon): 카카오 plus_friends 채널 친구검증(휴면)`

### Task 6: 발급 엔드포인트(검증→발급, 멱등)

- [ ] coupon-verify 콜백 내부에서 friend 확인 시 `issueKakaoFriendCoupon(userId, kakaoUid)` 호출(멱등). 이미 있으면 그대로. env 게이트. Commit `feat(coupon): 검증 통과 시 쿠폰 발급(멱등·휴면)`

### Task 7: 공용 CTA 컴포넌트

**Files:** Create `src/features/coupons/kakao-friend-coupon-cta.tsx`

- [ ] `GET …/status` 로 상태 fetch → 렌더: `disabled/enabled:false`→**미렌더**(휴면), `issuable`→"카카오 친구추가하고 무료쿠폰 받기"(coupon-verify OAuth 시작), `redeemable`→"무료 쿠폰 적용 · 3,300원 → 0원 · 무료로 받기"(결제창에서만 redeem 호출), `redeemed/expired`→안내 or 미렌더. 기존 CTA/버튼 컴포넌트 스타일 재사용(`kakao-channel-add-button.tsx` 참조). Commit `feat(coupon): 공용 CTA(상태기반·휴면)`

### Task 8: 진입 4곳 배치

- [ ] `KakaoFriendCouponCTA` 를 (a) 오늘자세히 결제창(`today-fortune-detail-client.tsx` 의 PremiumLockCard 인근, redeemable 시 결제 CTA 대체) (b) 메인 배너(`src/app/page.tsx`) (c) 마이/설정(`src/app/my/settings/page.tsx`) (d) 사주 결과 하단. 각 위치 null/휴면 가드. env OFF면 어디에도 안 뜸. typecheck 0. Commit `feat(coupon): CTA 4곳 배치(휴면)`

---

## Self-Review (계획 검수)

- **Spec coverage:** 설계 ①데이터모델→T1, ②발급→T5·T6, ③0원사용→T3, ④CTA→T7·T8, ⑤악용방지(UNIQUE·원자성·만료)→T1·T2·T3, ⑥env게이트→전 태스크, ⑦테스트→각 태스크. ✅
- **돈 안전:** T3 는 `recordTodayFortunePremiumAccess`(amount:0)만 사용 — payment_orders 미생성·전차감 미경유·매출 0. `unlockTodayFortunePremium`(전 차감)·`grantTasteProductEntitlement` 금지 명시. couponAvailability 게이트를 markCouponRedeemed 앞에 강제(만료 차단·중복 차단).
- **휴면:** 모든 표면 env 게이트. 카카오 콘솔 세팅 전 무동작.
- **Ambiguity:** 검증 채널=`kakaoChannelId`(≠_QVQxbX 문의URL) 명시. 만료 사용차단은 API 게이트+status='issued' 이중.
- **미해결(실행 중 확정):** grant 의 exact TasteProductId(today-detail)·scopeKey 빌더는 unlock route grep. 카카오 channels API 응답 스키마는 카카오 문서/실측. `createServiceClient` import 경로는 product-entitlements.ts 따름.

## 남은 리스크 / 확인
- ⚠️ **외부 블로커:** 카카오 콘솔 plus_friends 동의항목·채널 앱연결·스코프 승인 — 안 되면 발급(T5) 실동작 불가(휴면으론 배포 OK).
- ⚠️ migration 072 **수동 적용** 필요(배포 자동 아님).
- ⚠️ grant 0원의 이용권 감사/매출 지표 영향: `recordLegacyTasteProductTransaction`/원장에 0원이 어떻게 잡히는지 확인(매출 왜곡 방지). T3 리뷰에서 점검.
