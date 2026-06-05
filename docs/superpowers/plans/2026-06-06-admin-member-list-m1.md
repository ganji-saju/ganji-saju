# 가입자 리스트(M1) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현행 검색전용 `/admin/users`를, 전체 가입자를 필터·정렬·keyset 페이지네이션·CSV로 탐색하는 리스트 대시보드로 확장한다(설계서 M1).

**Architecture:** 사용자당 N+1을 피하려고 사전계산 요약 테이블 `admin_user_summary`(매시간 배치 갱신)를 신설하고, 목록·정렬·필터·검색을 그 단일 테이블의 keyset 쿼리로 처리한다. 순수 로직(마스킹·파라미터 파싱·커서·CSV·뱃지)은 단위테스트로 고정하고, service_role 데이터 레이어·라우트·페이지는 typecheck + admin 세션 수동 확인으로 검증한다. PII(이메일·생년월일)는 **서버에서** 역할별로 마스킹/제거하고, CSV의 PII 컬럼은 super_admin 한정 + `admin_access_log` 감사.

**Tech Stack:** Next.js 16.2.6(App Router, Route Handler, RSC), React 19, Supabase(`@supabase/supabase-js`, service_role), TypeScript. 테스트: 커스텀 러너 `npm test`(`node:assert/strict` + 전역 `test()`), `npm run typecheck`. 마이그레이션: `supabase` CLI 수동 적용.

**스코프 경계:** 세그먼트 칩은 M1에서 **기본 프리셋(필터 쿼리)**까지. 코호트 잔존율 지표는 M2. 360 상세 재구성은 M3. 운영 쓰기 액션은 M4. 본 계획은 목록·필터·정렬·CSV·요약테이블·감사로그(테이블+insert 헬퍼)까지.

**선행 확인된 코드 사실(근거):**
- `@/lib/supabase/server`: `createClient()`(요청 스코프·auth), `createServiceClient()`(service_role), `hasSupabaseServiceEnv`, `supabaseServiceRoleKey`.
- `@/lib/admin-auth`: `getCurrentAdminRole(client)` → `{ ok, userId, role: 'admin'|'super_admin'|null, reason: 'ok'|'unauthenticated'|'forbidden' }`.
- `@/lib/billing/payment-history`: `buildPaymentHistory({ productEntitlements, creditTransactions })` → `{ totalSpentWon, ... }`(테스트 고정). `isCashCreditTransaction`, `ProductEntitlementHistoryRow`, `CreditTransactionHistoryRow`.
- `@/lib/admin/user-detail`: `determineRefundEligibility`, 그리고 `getAdminUserDetail`가 사용하는 per-user 쿼리 패턴(profiles/readings/product_entitlements/credit_transactions/credit_lots/dialogue_messages/subscriptions).
- `@/lib/admin/credit-refunds`: `determineCreditRefundEligibility(creditTransactions, lots)` → `{ totalRefundableWon, ... }`.
- 라우트 규약: `export const runtime = 'nodejs'`; 크론 인증 = `Authorization: Bearer ${CRON_SECRET}` (기존 `/api/payments/reconcile` `isAuthorized` 패턴).
- 테스트 규약: 파일 `*.test.ts`, 맨 위 `import assert from 'node:assert/strict'` + `declare const test: (name: string, fn: () => void | Promise<void>) => void;`, `npm test`가 `src/` 전체 수집·실행하며 `ok - <name>` / `not ok - <name>` 출력.
- DB 사실(설계서 검증): `profiles(birth_year/month/day/hour, gender, display_name, user_id)`; `subscriptions.status ∈ {active,cancelled,expired}`(행부재=구독없음), `plan`은 DB CHECK 없음; `credit_lots(amount_remaining, amount_initial, expires_at, source)`; `product_entitlements(amount, product_id, payment_key, order_id)`.

---

## File Structure

**신규**
- `supabase/migrations/049_admin_user_summary.sql` — 요약 테이블 + 인덱스 + RLS(deny).
- `supabase/migrations/050_admin_access_log.sql` — 감사 로그 + 인덱스 + RLS.
- `src/lib/admin/masking.ts` (+ `masking.test.ts`) — `maskEmail`, `maskBirthDate`(순수).
- `src/lib/admin/user-list-query.ts` (+ `user-list-query.test.ts`) — 타입·`parseListParams`·`encodeCursor`/`decodeCursor`·`buildListItem`·`buildCsv`(순수).
- `src/lib/admin/access-log.ts` (+ `access-log.test.ts`) — `buildAccessLogInsert`(순수) + `logAdminAccess`(데이터).
- `src/lib/admin/summary-refresh.ts` — `computeUserSummary` + `refreshAdminUserSummary`(데이터, service_role; `buildPaymentHistory` 등 재사용).
- `src/lib/admin/user-list.ts` — `fetchAdminUserList`(요약테이블 keyset 쿼리, service_role).
- `src/app/api/admin/users/list/route.ts` — GET keyset JSON(admin 게이트, 서버 마스킹).
- `src/app/api/admin/users/export/route.ts` — GET CSV(행상한, PII컬럼 super 한정, 감사).
- `src/app/api/admin/users/summary/refresh/route.ts` — POST 크론(`CRON_SECRET`) → `refreshAdminUserSummary`.

**수정**
- `src/app/admin/users/page.tsx` — 빠른검색 유지 + 필터바·세그먼트칩·정렬·목록테이블·keyset 페이지네이션·빈상태.
- `vercel.json` — 요약 갱신 크론(`0 * * * *`) 추가.

**계약 타입(Task 4에서 정의, 이후 전 태스크 공유):**
```ts
// src/lib/admin/user-list-query.ts
export type AdminUserSortKey = 'signup' | 'ltv' | 'last_active' | 'paid_count';
export type MemberStatusFilter = 'all' | 'active' | 'dormant';
export type PaidFilter = 'all' | 'yes' | 'no';
export type SubscriptionFilter = 'all' | 'active' | 'cancelled' | 'expired' | 'none';
export type ProfileFilter = 'all' | 'complete' | 'incomplete';

export interface AdminUserListParams {
  status: MemberStatusFilter;
  signupFrom: string | null;   // 'YYYY-MM-DD'
  signupTo: string | null;     // 'YYYY-MM-DD'
  paid: PaidFilter;
  minLtv: number | null;
  subscription: SubscriptionFilter;
  provider: string[];          // subset of ['email','google','kakao']
  inactiveDays: number | null; // >= N
  profile: ProfileFilter;
  sort: AdminUserSortKey;
  cursor: string | null;       // opaque keyset cursor
  limit: number;               // 1..100, default 50
}

export interface AdminUserSummaryRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  signup_at: string;
  signup_provider: string | null;
  profile_complete: boolean;
  last_active_at: string;      // NOT NULL (>= signup_at)
  ltv_won: number;
  paid_count: number;
  credit_balance: number;
  credit_expiring: number;
  subscription_status: string | null;
  refundable_won: number;
  reading_count: number;
  chat_count: number;
}

export interface AdminUserListItem {
  userId: string;
  email: string | null;        // role=admin이면 마스킹
  displayName: string;
  signupAt: string;
  signupProvider: string | null;
  ltvWon: number;
  paidCount: number;
  subscriptionStatus: string | null;
  creditBalance: number;
  lastActiveAt: string;
  badges: Array<'new' | 'subscribed' | 'refundable' | 'at_risk'>;
}
```

---

## Task 1: 마이그레이션 049 — admin_user_summary 요약 테이블

**Files:**
- Create: `supabase/migrations/049_admin_user_summary.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 2026-06-06 M1 — 가입자 관리 대시보드 목록용 사전계산 요약 테이블.
--   목록/정렬/필터/검색을 단일 테이블 keyset 쿼리로 처리(N+1 회피).
--   매시간 배치(refreshAdminUserSummary, TS)로 갱신. service_role 만 접근.
CREATE TABLE IF NOT EXISTS admin_user_summary (
  user_id             UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email               TEXT,
  display_name        TEXT,
  signup_at           TIMESTAMPTZ NOT NULL,
  signup_provider     TEXT,
  profile_complete    BOOLEAN NOT NULL DEFAULT FALSE,
  last_active_at      TIMESTAMPTZ NOT NULL,
  ltv_won             BIGINT NOT NULL DEFAULT 0,
  paid_count          INT NOT NULL DEFAULT 0,
  credit_balance      INT NOT NULL DEFAULT 0,
  credit_expiring     INT NOT NULL DEFAULT 0,
  subscription_status TEXT,            -- active|cancelled|expired, NULL=구독 없음
  refundable_won      BIGINT NOT NULL DEFAULT 0,
  reading_count       INT NOT NULL DEFAULT 0,
  chat_count          INT NOT NULL DEFAULT 0,
  refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- keyset 정렬 인덱스((정렬키, user_id) 복합, 모두 DESC 스캔).
CREATE INDEX IF NOT EXISTS admin_user_summary_signup_idx      ON admin_user_summary (signup_at DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_ltv_idx         ON admin_user_summary (ltv_won DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_last_active_idx ON admin_user_summary (last_active_at DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_paid_idx        ON admin_user_summary (paid_count DESC, user_id DESC);
CREATE INDEX IF NOT EXISTS admin_user_summary_email_idx       ON admin_user_summary (email text_pattern_ops);

-- RLS: 정책 미생성 = 전면 deny. service_role 은 RLS 우회하므로 admin 데이터레이어만 접근.
ALTER TABLE admin_user_summary ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: 로컬/원격에 적용**

Run: `supabase db push` (또는 운영 절차에 따라 `supabase migration up`)
Expected: `049_admin_user_summary.sql` applied, 에러 없음.

- [ ] **Step 3: 적용 검증**

Run: `supabase db execute "select count(*) from admin_user_summary;"` (또는 Supabase SQL editor)
Expected: `0` (빈 테이블 생성됨).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/049_admin_user_summary.sql
git commit -m "feat(admin): admin_user_summary 요약 테이블(M1 목록용)"
```

---

## Task 2: 마이그레이션 050 — admin_access_log 감사 로그

**Files:**
- Create: `supabase/migrations/050_admin_access_log.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 2026-06-06 M1 — 어드민 민감 열람/운영 액션 감사 로그.
--   M1: export_csv 기록. M3/M4: view_detail, view_pii, 운영 쓰기 액션.
--   보유기간: 기본 12개월 후 purge(별도 배치, C2 정책). 환불 감사는 장기보관 검토.
CREATE TABLE IF NOT EXISTS admin_access_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID NOT NULL REFERENCES auth.users,
  actor_role  TEXT NOT NULL,
  action      TEXT NOT NULL,        -- view_detail|view_pii|export_csv|grant_credit|revoke_credit|suspend_sub|cancel_sub|force_reconsent|refund_request|refund_approve|batch_refund_request|purge_deleted_user
  target_user UUID,
  reason      TEXT,
  meta        JSONB,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_access_log_target_idx ON admin_access_log (target_user, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_access_log_actor_idx  ON admin_access_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_access_log_action_idx ON admin_access_log (action, created_at DESC);

-- RLS: 전면 deny(정책 미생성). service_role write, super_admin read 는 데이터레이어에서 통제.
ALTER TABLE admin_access_log ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: 적용**

Run: `supabase db push`
Expected: applied, 에러 없음.

- [ ] **Step 3: 검증**

Run: `supabase db execute "select count(*) from admin_access_log;"`
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/050_admin_access_log.sql
git commit -m "feat(admin): admin_access_log 감사 테이블"
```

---

## Task 3: masking.ts — 서버측 PII 마스킹(순수, TDD)

**Files:**
- Create: `src/lib/admin/masking.ts`
- Test: `src/lib/admin/masking.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/lib/admin/masking.test.ts
import assert from 'node:assert/strict';
import { maskEmail, maskBirthDate } from './masking';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('maskEmail: admin 은 local/domain 가림', () => {
  assert.equal(maskEmail('hong@example.com', 'admin'), 'h***@e***.com');
  assert.equal(maskEmail('a@b.co', 'admin'), 'a***@b***.co');
});

test('maskEmail: super_admin 은 원본', () => {
  assert.equal(maskEmail('hong@example.com', 'super_admin'), 'hong@example.com');
});

test('maskEmail: null/빈값 안전', () => {
  assert.equal(maskEmail(null, 'admin'), null);
  assert.equal(maskEmail('', 'admin'), null);
});

test('maskEmail: @ 없는 비정상값은 통째 가림', () => {
  assert.equal(maskEmail('weird', 'admin'), '***');
});

test('maskBirthDate: admin 은 연도만', () => {
  assert.equal(maskBirthDate(1999, 4, 1, 'admin'), '1999-**-**');
  assert.equal(maskBirthDate(null, null, null, 'admin'), null);
});

test('maskBirthDate: super_admin 은 전체', () => {
  assert.equal(maskBirthDate(1999, 4, 1, 'super_admin'), '1999-04-01');
  assert.equal(maskBirthDate(1999, null, null, 'super_admin'), '1999-??-??');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "maskEmail|maskBirthDate"`
Expected: `not ok - ...` (모듈 없음/함수 미정의).

- [ ] **Step 3: 최소 구현**

```ts
// src/lib/admin/masking.ts
// 서버측 PII 마스킹. role='admin' 은 가림, 'super_admin' 은 원본.
import type { AdminRole } from '@/lib/admin-auth';

export function maskEmail(email: string | null | undefined, role: AdminRole): string | null {
  if (!email) return null;
  if (role === 'super_admin') return email;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 ? domain.slice(dot) : '';
  return `${local[0]}***@${domain[0] || ''}***${tld}`;
}

export function maskBirthDate(
  year: number | null,
  month: number | null,
  day: number | null,
  role: AdminRole
): string | null {
  if (year == null) return null;
  const yyyy = String(year).padStart(4, '0');
  if (role === 'super_admin') {
    const mm = month == null ? '??' : String(month).padStart(2, '0');
    const dd = day == null ? '??' : String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return `${yyyy}-**-**`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "maskEmail|maskBirthDate"`
Expected: 모든 줄 `ok - ...`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/masking.ts src/lib/admin/masking.test.ts
git commit -m "feat(admin): 서버측 PII 마스킹 유틸(maskEmail/maskBirthDate)"
```

---

## Task 4: user-list-query.ts — 타입·파라미터 파싱·커서(순수, TDD)

**Files:**
- Create: `src/lib/admin/user-list-query.ts`
- Test: `src/lib/admin/user-list-query.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// src/lib/admin/user-list-query.test.ts
import assert from 'node:assert/strict';
import { parseListParams, encodeCursor, decodeCursor } from './user-list-query';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('parseListParams: 기본값', () => {
  const p = parseListParams(new URLSearchParams(''));
  assert.equal(p.status, 'all');
  assert.equal(p.paid, 'all');
  assert.equal(p.subscription, 'all');
  assert.equal(p.profile, 'all');
  assert.equal(p.sort, 'signup');
  assert.equal(p.limit, 50);
  assert.equal(p.minLtv, null);
  assert.equal(p.inactiveDays, null);
  assert.deepEqual(p.provider, []);
  assert.equal(p.cursor, null);
});

test('parseListParams: 값 파싱 + 화이트리스트', () => {
  const sp = new URLSearchParams(
    'status=active&paid=yes&subscription=active&profile=complete&sort=ltv&limit=30&minLtv=10000&inactiveDays=30&provider=email,google&cursor=abc'
  );
  const p = parseListParams(sp);
  assert.equal(p.status, 'active');
  assert.equal(p.paid, 'yes');
  assert.equal(p.subscription, 'active');
  assert.equal(p.profile, 'complete');
  assert.equal(p.sort, 'ltv');
  assert.equal(p.limit, 30);
  assert.equal(p.minLtv, 10000);
  assert.equal(p.inactiveDays, 30);
  assert.deepEqual(p.provider, ['email', 'google']);
  assert.equal(p.cursor, 'abc');
});

test('parseListParams: 잘못된 enum/숫자는 기본값으로 폴백', () => {
  const sp = new URLSearchParams('status=garbage&sort=hacker&limit=9999&minLtv=NaN&provider=email,evil');
  const p = parseListParams(sp);
  assert.equal(p.status, 'all');
  assert.equal(p.sort, 'signup');
  assert.equal(p.limit, 100); // clamp max 100
  assert.equal(p.minLtv, null);
  assert.deepEqual(p.provider, ['email']); // evil 제거
});

test('encode/decodeCursor: 라운드트립', () => {
  const c = encodeCursor({ v: '2026-05-30T00:00:00.000Z', id: 'u-123' });
  const back = decodeCursor(c);
  assert.deepEqual(back, { v: '2026-05-30T00:00:00.000Z', id: 'u-123' });
});

test('decodeCursor: 손상값은 null', () => {
  assert.equal(decodeCursor('!!!notbase64!!!'), null);
  assert.equal(decodeCursor(''), null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "parseListParams|Cursor"`
Expected: `not ok - ...`.

- [ ] **Step 3: 최소 구현(계약 타입 포함)**

```ts
// src/lib/admin/user-list-query.ts
// 가입자 목록 순수 로직: 파라미터 파싱·keyset 커서·목록아이템·CSV.
import type { AdminRole } from '@/lib/admin-auth';
import { maskEmail, maskBirthDate } from './masking';

export type AdminUserSortKey = 'signup' | 'ltv' | 'last_active' | 'paid_count';
export type MemberStatusFilter = 'all' | 'active' | 'dormant';
export type PaidFilter = 'all' | 'yes' | 'no';
export type SubscriptionFilter = 'all' | 'active' | 'cancelled' | 'expired' | 'none';
export type ProfileFilter = 'all' | 'complete' | 'incomplete';

export interface AdminUserListParams {
  status: MemberStatusFilter;
  signupFrom: string | null;
  signupTo: string | null;
  paid: PaidFilter;
  minLtv: number | null;
  subscription: SubscriptionFilter;
  provider: string[];
  inactiveDays: number | null;
  profile: ProfileFilter;
  sort: AdminUserSortKey;
  cursor: string | null;
  limit: number;
}

export interface AdminUserSummaryRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  signup_at: string;
  signup_provider: string | null;
  profile_complete: boolean;
  last_active_at: string;
  ltv_won: number;
  paid_count: number;
  credit_balance: number;
  credit_expiring: number;
  subscription_status: string | null;
  refundable_won: number;
  reading_count: number;
  chat_count: number;
}

export interface AdminUserListItem {
  userId: string;
  email: string | null;
  displayName: string;
  signupAt: string;
  signupProvider: string | null;
  ltvWon: number;
  paidCount: number;
  subscriptionStatus: string | null;
  creditBalance: number;
  lastActiveAt: string;
  badges: Array<'new' | 'subscribed' | 'refundable' | 'at_risk'>;
}

export interface Cursor {
  v: string; // 정렬키 값(ISO 문자열 또는 숫자 문자열)
  id: string;
}

const SORT_KEYS: AdminUserSortKey[] = ['signup', 'ltv', 'last_active', 'paid_count'];
const STATUS: MemberStatusFilter[] = ['all', 'active', 'dormant'];
const PAID: PaidFilter[] = ['all', 'yes', 'no'];
const SUBS: SubscriptionFilter[] = ['all', 'active', 'cancelled', 'expired', 'none'];
const PROFILE: ProfileFilter[] = ['all', 'complete', 'incomplete'];
const PROVIDERS = ['email', 'google', 'kakao'];

function pick<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return value && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function parseIntOrNull(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

export function parseListParams(sp: URLSearchParams): AdminUserListParams {
  const rawLimit = parseIntOrNull(sp.get('limit'));
  const limit = rawLimit == null ? 50 : Math.min(100, Math.max(1, rawLimit));
  const provider = (sp.get('provider') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => PROVIDERS.includes(s));
  return {
    status: pick(sp.get('status'), STATUS, 'all'),
    signupFrom: sp.get('signupFrom') || null,
    signupTo: sp.get('signupTo') || null,
    paid: pick(sp.get('paid'), PAID, 'all'),
    minLtv: parseIntOrNull(sp.get('minLtv')),
    subscription: pick(sp.get('subscription'), SUBS, 'all'),
    provider,
    inactiveDays: parseIntOrNull(sp.get('inactiveDays')),
    profile: pick(sp.get('profile'), PROFILE, 'all'),
    sort: pick(sp.get('sort'), SORT_KEYS, 'signup'),
    cursor: sp.get('cursor') || null,
    limit,
  };
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (obj && typeof obj.v === 'string' && typeof obj.id === 'string') {
      return { v: obj.v, id: obj.id };
    }
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "parseListParams|Cursor"`
Expected: 모든 줄 `ok - ...`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/user-list-query.ts src/lib/admin/user-list-query.test.ts
git commit -m "feat(admin): 가입자 목록 파라미터 파싱·keyset 커서(순수)"
```

---

## Task 5: buildListItem — 표시명·뱃지·마스킹(순수, TDD)

**Files:**
- Modify: `src/lib/admin/user-list-query.ts` (append)
- Modify: `src/lib/admin/user-list-query.test.ts` (append)

- [ ] **Step 1: 실패 테스트 추가**

```ts
// append to src/lib/admin/user-list-query.test.ts
import { buildListItem, cursorForRow } from './user-list-query';
import type { AdminUserSummaryRow } from './user-list-query';

const NOW = '2026-06-06T00:00:00.000Z';

function row(over: Partial<AdminUserSummaryRow> = {}): AdminUserSummaryRow {
  return {
    user_id: 'u-1',
    email: 'hong@example.com',
    display_name: null,
    signup_at: '2026-06-01T00:00:00.000Z',
    signup_provider: 'google',
    profile_complete: true,
    last_active_at: '2026-06-04T00:00:00.000Z',
    ltv_won: 39000,
    paid_count: 3,
    credit_balance: 5,
    credit_expiring: 2,
    subscription_status: null,
    refundable_won: 9000,
    reading_count: 4,
    chat_count: 12,
    ...over,
  };
}

test('buildListItem: admin 은 이메일 마스킹 + 표시명 폴백', () => {
  const item = buildListItem(row(), 'admin', NOW);
  assert.equal(item.email, 'h***@e***.com');
  assert.equal(item.displayName, '회원-u-1'); // display_name 없으면 회원-{id앞8}
});

test('buildListItem: super_admin 은 이메일 원본', () => {
  const item = buildListItem(row(), 'super_admin', NOW);
  assert.equal(item.email, 'hong@example.com');
});

test('buildListItem: display_name 있으면 우선', () => {
  const item = buildListItem(row({ display_name: '홍길동' }), 'admin', NOW);
  assert.equal(item.displayName, '홍길동');
});

test('buildListItem: 뱃지 — 신규(30일내)·환불대상', () => {
  const item = buildListItem(row(), 'admin', NOW);
  assert.ok(item.badges.includes('new'));        // signup 6-01, now 6-06 → 5일
  assert.ok(item.badges.includes('refundable')); // refundable_won>0
  assert.ok(!item.badges.includes('subscribed'));
  assert.ok(!item.badges.includes('at_risk'));
});

test('buildListItem: 뱃지 — 구독중·이탈위험', () => {
  const sub = buildListItem(row({ subscription_status: 'active' }), 'admin', NOW);
  assert.ok(sub.badges.includes('subscribed'));

  const risk = buildListItem(
    row({ last_active_at: '2026-04-01T00:00:00.000Z', ltv_won: 5000, refundable_won: 0, subscription_status: null }),
    'admin',
    NOW
  );
  assert.ok(risk.badges.includes('at_risk')); // 30일+ 비활동 & LTV>0
});

test('cursorForRow: 정렬키별 커서 값', () => {
  const r = row();
  assert.deepEqual(cursorForRow(r, 'signup'), { v: r.signup_at, id: 'u-1' });
  assert.deepEqual(cursorForRow(r, 'ltv'), { v: '39000', id: 'u-1' });
  assert.deepEqual(cursorForRow(r, 'last_active'), { v: r.last_active_at, id: 'u-1' });
  assert.deepEqual(cursorForRow(r, 'paid_count'), { v: '3', id: 'u-1' });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "buildListItem|cursorForRow"`
Expected: `not ok - ...`.

- [ ] **Step 3: 구현 추가**

```ts
// append to src/lib/admin/user-list-query.ts

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, nowIso: string): number {
  return (new Date(nowIso).getTime() - new Date(fromIso).getTime()) / DAY_MS;
}

export function resolveDisplayName(row: AdminUserSummaryRow): string {
  if (row.display_name && row.display_name.trim()) return row.display_name.trim();
  return `회원-${row.user_id.slice(0, 8)}`;
}

export function buildListItem(
  row: AdminUserSummaryRow,
  role: AdminRole,
  nowIso: string
): AdminUserListItem {
  const badges: AdminUserListItem['badges'] = [];
  if (daysBetween(row.signup_at, nowIso) <= 30) badges.push('new');
  if (row.subscription_status === 'active') badges.push('subscribed');
  if (row.refundable_won > 0) badges.push('refundable');
  if (daysBetween(row.last_active_at, nowIso) > 30 && row.ltv_won > 0) badges.push('at_risk');
  return {
    userId: row.user_id,
    email: maskEmail(row.email, role),
    displayName: resolveDisplayName(row),
    signupAt: row.signup_at,
    signupProvider: row.signup_provider,
    ltvWon: row.ltv_won,
    paidCount: row.paid_count,
    subscriptionStatus: row.subscription_status,
    creditBalance: row.credit_balance,
    lastActiveAt: row.last_active_at,
    badges,
  };
}

export function cursorForRow(row: AdminUserSummaryRow, sort: AdminUserSortKey): Cursor {
  const v =
    sort === 'signup'
      ? row.signup_at
      : sort === 'last_active'
        ? row.last_active_at
        : sort === 'ltv'
          ? String(row.ltv_won)
          : String(row.paid_count);
  return { v, id: row.user_id };
}
```

> 주: `maskBirthDate`는 본 태스크에서 직접 쓰지 않지만(생년월일은 M3 상세) Task 3에서 export 유지. 목록은 이메일만 마스킹.

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "buildListItem|cursorForRow"`
Expected: 모든 줄 `ok - ...`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/user-list-query.ts src/lib/admin/user-list-query.test.ts
git commit -m "feat(admin): 목록 아이템 빌더(표시명 폴백·뱃지·이메일 마스킹)"
```

---

## Task 6: buildCsv — CSV 직렬화(순수, TDD)

**Files:**
- Modify: `src/lib/admin/user-list-query.ts` (append)
- Modify: `src/lib/admin/user-list-query.test.ts` (append)

- [ ] **Step 1: 실패 테스트 추가**

```ts
// append to src/lib/admin/user-list-query.test.ts
import { buildCsv } from './user-list-query';

test('buildCsv: admin 은 비식별 컬럼(이메일 제외), 헤더+행', () => {
  const csv = buildCsv([buildListItem(row(), 'admin', NOW)], 'admin');
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'user_id,signup_at,ltv_won,paid_count,subscription_status,last_active_at');
  assert.ok(lines[1].startsWith('u-1,2026-06-01'));
  assert.ok(!csv.includes('hong@example.com'));
  assert.ok(!csv.includes('email'));
});

test('buildCsv: super_admin 은 이메일·표시명 PII 컬럼 포함', () => {
  const csv = buildCsv([buildListItem(row(), 'super_admin', NOW)], 'super_admin');
  const header = csv.trim().split('\n')[0];
  assert.ok(header.includes('email'));
  assert.ok(header.includes('display_name'));
  assert.ok(csv.includes('hong@example.com'));
});

test('buildCsv: 콤마·따옴표 이스케이프', () => {
  const item = buildListItem(row({ display_name: '홍, "길동"' }), 'super_admin', NOW);
  const csv = buildCsv([item], 'super_admin');
  assert.ok(csv.includes('"홍, ""길동"""'));
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "buildCsv"`
Expected: `not ok - ...`.

- [ ] **Step 3: 구현 추가**

```ts
// append to src/lib/admin/user-list-query.ts

function csvCell(value: string | number | null): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** super_admin 만 PII 컬럼(email, display_name) 포함. */
export function buildCsv(items: AdminUserListItem[], role: AdminRole): string {
  const pii = role === 'super_admin';
  const header = pii
    ? ['user_id', 'email', 'display_name', 'signup_at', 'ltv_won', 'paid_count', 'subscription_status', 'last_active_at']
    : ['user_id', 'signup_at', 'ltv_won', 'paid_count', 'subscription_status', 'last_active_at'];
  const rows = items.map((i) => {
    const base = pii
      ? [i.userId, i.email, i.displayName, i.signupAt, i.ltvWon, i.paidCount, i.subscriptionStatus, i.lastActiveAt]
      : [i.userId, i.signupAt, i.ltvWon, i.paidCount, i.subscriptionStatus, i.lastActiveAt];
    return base.map(csvCell).join(',');
  });
  return [header.join(','), ...rows].join('\n') + '\n';
}
```

> 주: super CSV의 `email`은 `buildListItem(..., 'super_admin', ...)`로 만든 아이템이어야 원본이 들어간다(Task 11에서 role 일치 보장).

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "buildCsv"`
Expected: 모든 줄 `ok - ...`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/user-list-query.ts src/lib/admin/user-list-query.test.ts
git commit -m "feat(admin): CSV 직렬화(역할별 PII 컬럼·이스케이프)"
```

---

## Task 7: access-log.ts — 감사 insert(순수 빌더 TDD + 데이터 헬퍼)

**Files:**
- Create: `src/lib/admin/access-log.ts`
- Test: `src/lib/admin/access-log.test.ts`

- [ ] **Step 1: 실패 테스트 작성(순수 빌더)**

```ts
// src/lib/admin/access-log.test.ts
import assert from 'node:assert/strict';
import { buildAccessLogInsert } from './access-log';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('buildAccessLogInsert: 필수 필드 매핑', () => {
  const ins = buildAccessLogInsert({
    actorId: 'a-1',
    actorRole: 'super_admin',
    action: 'export_csv',
    targetUser: null,
    reason: null,
    meta: { rowCount: 120, pii: true },
  });
  assert.equal(ins.actor_id, 'a-1');
  assert.equal(ins.actor_role, 'super_admin');
  assert.equal(ins.action, 'export_csv');
  assert.equal(ins.target_user, null);
  assert.deepEqual(ins.meta, { rowCount: 120, pii: true });
});

test('buildAccessLogInsert: meta 미지정 시 빈 객체', () => {
  const ins = buildAccessLogInsert({ actorId: 'a', actorRole: 'admin', action: 'view_detail', targetUser: 'u' });
  assert.deepEqual(ins.meta, {});
  assert.equal(ins.reason ?? null, null);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test 2>&1 | grep -E "buildAccessLogInsert"`
Expected: `not ok - ...`.

- [ ] **Step 3: 구현(순수 빌더 + 데이터 헬퍼)**

```ts
// src/lib/admin/access-log.ts
// 어드민 감사 로그 기록. 순수 빌더(테스트) + service_role insert 헬퍼.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import type { AdminRole } from '@/lib/admin-auth';

export type AdminAction =
  | 'view_detail' | 'view_pii' | 'export_csv'
  | 'grant_credit' | 'revoke_credit' | 'suspend_sub' | 'cancel_sub'
  | 'force_reconsent' | 'refund_request' | 'refund_approve'
  | 'batch_refund_request' | 'purge_deleted_user';

export interface AccessLogInput {
  actorId: string;
  actorRole: AdminRole;
  action: AdminAction;
  targetUser?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
  ipHash?: string | null;
}

export interface AccessLogInsert {
  actor_id: string;
  actor_role: string;
  action: string;
  target_user: string | null;
  reason: string | null;
  meta: Record<string, unknown>;
  ip_hash: string | null;
}

export function buildAccessLogInsert(input: AccessLogInput): AccessLogInsert {
  return {
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    target_user: input.targetUser ?? null,
    reason: input.reason ?? null,
    meta: input.meta ?? {},
    ip_hash: input.ipHash ?? null,
  };
}

/** 감사 로그 1건 기록. 실패는 삼키되 콘솔 경고(감사 실패가 액션을 막지 않도록). */
export async function logAdminAccess(input: AccessLogInput): Promise<void> {
  if (!hasSupabaseServiceEnv) return;
  try {
    const service = await createServiceClient();
    await service.from('admin_access_log').insert(buildAccessLogInsert(input));
  } catch (err) {
    console.warn('[admin_access_log] insert 실패', err);
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test 2>&1 | grep -E "buildAccessLogInsert"`
Expected: 모든 줄 `ok - ...`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/access-log.ts src/lib/admin/access-log.test.ts
git commit -m "feat(admin): 감사 로그 빌더·insert 헬퍼(admin_access_log)"
```

---

## Task 8: summary-refresh.ts — 요약 테이블 배치 갱신(데이터)

**Files:**
- Create: `src/lib/admin/summary-refresh.ts`

> LTV·환불가능액은 상세와 **동일한 검증된 로직**(`buildPaymentHistory`, `determineRefundEligibility`, `determineCreditRefundEligibility`)을 재사용해 목록↔상세 정의 불일치를 방지한다. 현 규모(수천 명)에서 per-user 집계 배치는 허용 비용. 스케일 시 SQL 집계/증분으로 전환(설계서 §7-2).

- [ ] **Step 1: 구현**

```ts
// src/lib/admin/summary-refresh.ts
// admin_user_summary 매시간 배치 갱신. service_role. 상세와 동일 로직 재사용.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  buildPaymentHistory,
  isCashCreditTransaction,
  type CreditTransactionHistoryRow,
  type ProductEntitlementHistoryRow,
} from '@/lib/billing/payment-history';
import {
  determineCreditRefundEligibility,
  type CreditRefundLotRow,
} from '@/lib/admin/credit-refunds';
import { determineRefundEligibility } from '@/lib/admin/user-detail';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

interface SummaryUpsert {
  user_id: string;
  email: string | null;
  display_name: string | null;
  signup_at: string;
  signup_provider: string | null;
  profile_complete: boolean;
  last_active_at: string;
  ltv_won: number;
  paid_count: number;
  credit_balance: number;
  credit_expiring: number;
  subscription_status: string | null;
  refundable_won: number;
  reading_count: number;
  chat_count: number;
  refreshed_at: string;
}

function maxIso(...values: Array<string | null | undefined>): string | null {
  const ts = values.filter((v): v is string => Boolean(v)).map((v) => new Date(v).getTime());
  if (ts.length === 0) return null;
  return new Date(Math.max(...ts)).toISOString();
}

async function computeUserSummary(
  service: ServiceClient,
  user: { id: string; email: string | null; created_at: string; last_sign_in_at?: string | null; app_metadata?: Record<string, unknown> },
  nowIso: string
): Promise<SummaryUpsert> {
  const userId = user.id;

  const { data: profile } = await service
    .from('profiles')
    .select('display_name, birth_year, gender')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: entRows } = await service
    .from('product_entitlements')
    .select('id, product_id, amount, order_id, payment_key, created_at')
    .eq('user_id', userId);
  const productEntitlements = (entRows ?? []) as unknown as ProductEntitlementHistoryRow[];

  const { data: creditRows } = await service
    .from('credit_transactions')
    .select('id, type, amount, metadata, created_at, feature')
    .eq('user_id', userId);
  const allCredit = (creditRows ?? []) as unknown as Array<
    CreditTransactionHistoryRow & { type: string; feature?: string | null }
  >;
  const cashCredit = allCredit.filter((r) => isCashCreditTransaction(r));
  const payment = buildPaymentHistory({ productEntitlements, creditTransactions: cashCredit });

  const { data: lotRows } = await service
    .from('credit_lots')
    .select('id, user_id, amount_remaining, amount_initial, expires_at, source, metadata, created_at')
    .eq('user_id', userId);
  const lots = (lotRows ?? []) as unknown as Array<{
    amount_remaining: number;
    expires_at: string | null;
    source: string;
  }> & CreditRefundLotRow[];

  const creditBalance = lots.reduce((s, l) => s + (l.amount_remaining ?? 0), 0);
  const expiringCut = new Date(new Date(nowIso).getTime() + 7 * 86400000).toISOString();
  const creditExpiring = lots
    .filter((l) => l.expires_at && l.expires_at <= expiringCut && (l.amount_remaining ?? 0) > 0)
    .reduce((s, l) => s + (l.amount_remaining ?? 0), 0);

  const purchaseLots = (lotRows ?? []).filter((l) => (l as { source: string }).source === 'purchase');
  const creditRefund = determineCreditRefundEligibility(
    allCredit,
    purchaseLots as unknown as CreditRefundLotRow[]
  );
  const refund = determineRefundEligibility(productEntitlements, creditRefund);

  const { data: sub } = await service
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: readingCount } = await service
    .from('readings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const { data: latestReading } = await service
    .from('readings')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: chatCount } = await service
    .from('dialogue_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  const { data: latestChat } = await service
    .from('dialogue_messages')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const provider =
    (user.app_metadata?.provider as string | undefined) ??
    ((user.app_metadata?.providers as string[] | undefined)?.[0]) ??
    'email';

  const lastActive =
    maxIso(
      user.last_sign_in_at ?? null,
      (latestReading?.created_at as string | undefined) ?? null,
      (latestChat?.created_at as string | undefined) ?? null
    ) ?? user.created_at;

  return {
    user_id: userId,
    email: user.email ?? null,
    display_name: (profile?.display_name as string | undefined) ?? null,
    signup_at: user.created_at,
    signup_provider: provider,
    profile_complete: Boolean(profile?.birth_year && profile?.gender),
    last_active_at: lastActive,
    ltv_won: payment.totalSpentWon,
    paid_count: payment.entries?.length ?? productEntitlements.filter((e) => (e.amount ?? 0) > 0).length,
    credit_balance: creditBalance,
    credit_expiring: creditExpiring,
    subscription_status: (sub?.status as string | undefined) ?? null,
    refundable_won: refund.totalRefundableWon,
    reading_count: readingCount ?? 0,
    chat_count: chatCount ?? 0,
    refreshed_at: nowIso,
  };
}

export interface RefreshResult {
  processed: number;
  refreshedAt: string;
}

/** 전체 가입자 요약 재계산 + upsert. auth.users 페이지네이션 순회. */
export async function refreshAdminUserSummary(): Promise<RefreshResult> {
  if (!hasSupabaseServiceEnv) return { processed: 0, refreshedAt: new Date().toISOString() };
  const service = await createServiceClient();
  const nowIso = new Date().toISOString();
  let page = 1;
  let processed = 0;

  for (;;) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error || data.users.length === 0) break;
    const rows: SummaryUpsert[] = [];
    for (const u of data.users) {
      rows.push(
        await computeUserSummary(
          service,
          {
            id: u.id,
            email: u.email ?? null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            app_metadata: u.app_metadata as Record<string, unknown> | undefined,
          },
          nowIso
        )
      );
    }
    if (rows.length > 0) {
      await service.from('admin_user_summary').upsert(rows, { onConflict: 'user_id' });
      processed += rows.length;
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return { processed, refreshedAt: nowIso };
}
```

> **검증필요(구현 시 확인):** `payment.entries` 필드명이 `buildPaymentHistory` 반환에 실제로 존재하는지 `payment-history.ts`에서 확인하고, 없으면 `paid_count`를 `productEntitlements.filter(e => (e.amount ?? 0) > 0).length`로 단일화하라. `determineRefundEligibility`/`determineCreditRefundEligibility` 입력 행 타입도 그대로 맞춘다(상세 레이어 `user-detail.ts`의 사용처가 레퍼런스).

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 신규 파일 관련 에러 0(있으면 위 검증필요 항목대로 필드명 정정).

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/summary-refresh.ts
git commit -m "feat(admin): 요약 테이블 배치 갱신(상세 로직 재사용·LTV 일관)"
```

---

## Task 9: user-list.ts — 요약 테이블 keyset 조회(데이터)

**Files:**
- Create: `src/lib/admin/user-list.ts`

- [ ] **Step 1: 구현**

```ts
// src/lib/admin/user-list.ts
// admin_user_summary 목록 조회. service_role. 필터·정렬·keyset 페이지네이션.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import {
  decodeCursor,
  type AdminUserListParams,
  type AdminUserSummaryRow,
} from './user-list-query';

const SORT_COLUMN: Record<AdminUserListParams['sort'], keyof AdminUserSummaryRow> = {
  signup: 'signup_at',
  ltv: 'ltv_won',
  last_active: 'last_active_at',
  paid_count: 'paid_count',
};

export interface AdminUserListPage {
  rows: AdminUserSummaryRow[]; // limit 개(다음 페이지 존재 시 hasMore=true)
  hasMore: boolean;
  refreshedAt: string | null;
}

export async function fetchAdminUserList(params: AdminUserListParams): Promise<AdminUserListPage> {
  if (!hasSupabaseServiceEnv) return { rows: [], hasMore: false, refreshedAt: null };
  const service = await createServiceClient();
  const col = SORT_COLUMN[params.sort];

  let qb = service.from('admin_user_summary').select('*');

  // ── 필터(전부 AND) ──
  if (params.status === 'active') {
    qb = qb.gte('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  } else if (params.status === 'dormant') {
    qb = qb.lt('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  }
  if (params.signupFrom) qb = qb.gte('signup_at', `${params.signupFrom}T00:00:00.000Z`);
  if (params.signupTo) qb = qb.lte('signup_at', `${params.signupTo}T23:59:59.999Z`);
  if (params.paid === 'yes') qb = qb.gt('paid_count', 0);
  if (params.paid === 'no') qb = qb.eq('paid_count', 0);
  if (params.minLtv != null) qb = qb.gte('ltv_won', params.minLtv);
  if (params.subscription === 'none') qb = qb.is('subscription_status', null);
  else if (params.subscription !== 'all') qb = qb.eq('subscription_status', params.subscription);
  if (params.provider.length > 0) qb = qb.in('signup_provider', params.provider);
  if (params.inactiveDays != null) {
    qb = qb.lt('last_active_at', new Date(Date.now() - params.inactiveDays * 86400000).toISOString());
  }
  if (params.profile === 'complete') qb = qb.eq('profile_complete', true);
  if (params.profile === 'incomplete') qb = qb.eq('profile_complete', false);

  // ── keyset (모든 정렬 DESC, tie-break user_id DESC) ──
  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  if (cursor) {
    // (col < v) OR (col = v AND user_id < id)
    qb = qb.or(`${col}.lt.${cursor.v},and(${col}.eq.${cursor.v},user_id.lt.${cursor.id})`);
  }
  qb = qb
    .order(col as string, { ascending: false })
    .order('user_id', { ascending: false })
    .limit(params.limit + 1);

  const { data, error } = await qb;
  if (error || !data) return { rows: [], hasMore: false, refreshedAt: null };

  const all = data as unknown as Array<AdminUserSummaryRow & { refreshed_at: string }>;
  const hasMore = all.length > params.limit;
  const rows = all.slice(0, params.limit);
  const refreshedAt = rows[0]?.refreshed_at ?? all[0]?.refreshed_at ?? null;
  return { rows, hasMore, refreshedAt };
}
```

> **검증필요:** Supabase `.or()` 안의 값에 콤마/특수문자가 들어가면 파싱이 깨질 수 있다. 커서 값은 ISO 타임스탬프(콤마 없음) 또는 정수 문자열뿐이라 안전. 만약 PostgREST `.or` 동작이 기대와 다르면, RPC(`fetch_admin_user_list`) 또는 `.lt`+`.or` 분기 대신 keyset을 RPC SQL로 옮긴다(설계서 §7-3).

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/user-list.ts
git commit -m "feat(admin): 요약 테이블 필터·정렬·keyset 조회"
```

---

## Task 10: GET /api/admin/users/list — 목록 JSON 라우트

**Files:**
- Create: `src/app/api/admin/users/list/route.ts`

- [ ] **Step 1: 구현**

```ts
// src/app/api/admin/users/list/route.ts
// GET 가입자 목록(JSON, keyset). admin 게이트 + 서버 마스킹.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { fetchAdminUserList } from '@/lib/admin/user-list';
import { parseListParams, buildListItem, cursorForRow, encodeCursor } from '@/lib/admin/user-list-query';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const params = parseListParams(req.nextUrl.searchParams);
  const page = await fetchAdminUserList(params);
  const nowIso = new Date().toISOString();

  const items = page.rows.map((r) => buildListItem(r, check.role!, nowIso));
  const nextCursor =
    page.hasMore && page.rows.length > 0
      ? encodeCursor(cursorForRow(page.rows[page.rows.length - 1], params.sort))
      : null;

  return NextResponse.json({
    ok: true,
    items,
    nextCursor,
    refreshedAt: page.refreshedAt,
  });
}
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0.

- [ ] **Step 3: 수동 확인(admin 세션 필요)**

admin 로그인 후 브라우저/`curl`(쿠키 포함):
Run: `GET /api/admin/users/list?sort=ltv&limit=5`
Expected: `{ ok:true, items:[…], nextCursor, refreshedAt }`. admin 역할이면 `email`이 `a***@e***.com` 형태. 비로그인은 401, 비admin은 403.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/list/route.ts
git commit -m "feat(admin): GET /api/admin/users/list (keyset·서버 마스킹)"
```

---

## Task 11: GET /api/admin/users/export — CSV(행상한·super PII·감사)

**Files:**
- Create: `src/app/api/admin/users/export/route.ts`

- [ ] **Step 1: 구현**

```ts
// src/app/api/admin/users/export/route.ts
// GET CSV 내보내기. 행상한 5,000. PII 컬럼(email/display_name)은 super_admin 한정.
// 모든 export 는 admin_access_log(export_csv) 기록.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { fetchAdminUserList } from '@/lib/admin/user-list';
import { parseListParams, buildListItem, buildCsv } from '@/lib/admin/user-list-query';
import { logAdminAccess } from '@/lib/admin/access-log';

export const runtime = 'nodejs';

const MAX_ROWS = 5000;
const PAGE = 500;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  if (!check.ok || !check.userId || !check.role) {
    return NextResponse.json(
      { ok: false, error: check.reason },
      { status: check.reason === 'unauthenticated' ? 401 : 403 }
    );
  }

  const base = parseListParams(req.nextUrl.searchParams);
  const nowIso = new Date().toISOString();
  const items = [] as ReturnType<typeof buildListItem>[];
  let cursor: string | null = null;

  // 행상한까지 keyset 순회.
  for (let guard = 0; guard < Math.ceil(MAX_ROWS / PAGE) + 1; guard += 1) {
    const page = await fetchAdminUserList({ ...base, cursor, limit: PAGE });
    for (const r of page.rows) items.push(buildListItem(r, check.role, nowIso));
    if (!page.hasMore || items.length >= MAX_ROWS) break;
    const last = page.rows[page.rows.length - 1];
    const { cursorForRow, encodeCursor } = await import('@/lib/admin/user-list-query');
    cursor = encodeCursor(cursorForRow(last, base.sort));
  }
  const limited = items.slice(0, MAX_ROWS);
  const csv = buildCsv(limited, check.role);

  await logAdminAccess({
    actorId: check.userId,
    actorRole: check.role,
    action: 'export_csv',
    meta: { rowCount: limited.length, pii: check.role === 'super_admin', filters: Object.fromEntries(req.nextUrl.searchParams) },
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="members-${nowIso.slice(0, 10)}.csv"`,
    },
  });
}
```

- [ ] **Step 2: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0.

- [ ] **Step 3: 수동 확인**

super_admin 세션: `GET /api/admin/users/export?sort=ltv` → CSV 다운로드, 헤더에 `email,display_name` 포함, 이메일 원본.
admin 세션: 같은 요청 → CSV 에 `email` 컬럼 **없음**(비식별만).
이후 `select action, meta from admin_access_log order by created_at desc limit 1;` → `export_csv` 1건 기록 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/users/export/route.ts
git commit -m "feat(admin): GET /api/admin/users/export (행상한·super PII·감사)"
```

---

## Task 12: POST /api/admin/users/summary/refresh — 크론 갱신 + vercel.json

**Files:**
- Create: `src/app/api/admin/users/summary/refresh/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: 라우트 구현(크론 시크릿 인증 — reconcile 패턴)**

```ts
// src/app/api/admin/users/summary/refresh/route.ts
// POST 요약 테이블 갱신. Vercel Cron(매시간) 또는 super_admin 수동 트리거.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { refreshAdminUserSummary } from '@/lib/admin/summary-refresh';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? null;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  // 크론(시크릿) 또는 super_admin 수동.
  let authorized = isCronAuthorized(req);
  if (!authorized) {
    const supabase = await createClient();
    const check = await getCurrentAdminRole(supabase);
    authorized = check.ok && check.role === 'super_admin';
  }
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const result = await refreshAdminUserSummary();
  return NextResponse.json({ ok: true, ...result });
}
```

- [ ] **Step 2: vercel.json 에 크론 추가**

`vercel.json`의 `crons` 배열에 다음 객체 추가(기존 항목 유지):

```json
    {
      "path": "/api/admin/users/summary/refresh",
      "schedule": "0 * * * *"
    }
```

> Vercel Cron 은 GET 으로 호출하므로, **라우트에 GET 핸들러도 추가하거나** Cron 설정이 POST 를 지원하는지 확인하라(현행 `/api/payments/reconcile`·`/api/notifications/dispatch` 가 어떤 메서드인지 그 파일을 보고 동일 메서드로 맞춘다 — reconcile 은 동일 시크릿 패턴 사용). 메서드 불일치 시 같은 핸들러를 `export async function GET` 로도 노출.

- [ ] **Step 3: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0.

- [ ] **Step 4: 수동 갱신 트리거 + 검증**

super_admin 세션 또는 `curl -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/admin/users/summary/refresh`
Expected: `{ ok:true, processed:<N>, refreshedAt }`. 이후 `select count(*) from admin_user_summary;` 가 가입자 수와 일치.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/users/summary/refresh/route.ts vercel.json
git commit -m "feat(admin): 요약 갱신 크론 라우트(매시간) + vercel.json"
```

---

## Task 13: page.tsx — 목록 UI(필터·정렬·테이블·페이지네이션·빈상태)

**Files:**
- Modify: `src/app/admin/users/page.tsx`

> 기존 빠른검색(이메일/UUID → `searchAdminUsers`)은 상단에 **유지**. 그 아래 SSR 목록 섹션을 추가한다. 목록은 서버에서 `getCurrentAdminRole` → `fetchAdminUserList` → `buildListItem` 으로 렌더(클라이언트로 원천 미전송). 필터·정렬·커서는 쿼리스트링. 기존 레이아웃 컴포넌트(`AppShell`,`AppPage`,`GangiPageHeader`) 재사용.

- [ ] **Step 1: page.tsx 확장**

```tsx
// src/app/admin/users/page.tsx — 목록 섹션 추가(기존 검색 폼 위/아래 유지).
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { searchAdminUsers } from '@/lib/admin/user-detail';
import { fetchAdminUserList } from '@/lib/admin/user-list';
import {
  parseListParams,
  buildListItem,
  cursorForRow,
  encodeCursor,
} from '@/lib/admin/user-list-query';

export const metadata: Metadata = {
  title: '가입자 관리 (admin)',
  description: '전체 가입자 목록·필터·정렬·검색',
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function fmtDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}
function fmtWon(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`;
}
function toSP(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') out.set(k, v);
    else if (Array.isArray(v) && v[0]) out.set(k, v[0]);
  }
  return out;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const raw = await searchParams;
  const usp = toSP(raw);
  const query = (usp.get('q') ?? '').trim();

  const supabase = await createClient();
  const check = await getCurrentAdminRole(supabase);
  const role = check.role ?? 'admin';

  const searchResults = query ? await searchAdminUsers(query) : [];

  const params = parseListParams(usp);
  const page = await fetchAdminUserList(params);
  const nowIso = new Date().toISOString();
  const items = page.rows.map((r) => buildListItem(r, role, nowIso));
  const nextCursor =
    page.hasMore && page.rows.length > 0
      ? encodeCursor(cursorForRow(page.rows[page.rows.length - 1], params.sort))
      : null;

  // 세그먼트 프리셋 링크(쿼리스트링).
  const seg = (label: string, qs: string) => (
    <Link
      key={label}
      href={`/admin/users?${qs}`}
      className="rounded-full border border-[var(--app-line)] px-3 py-1 text-[12px] text-[var(--app-ink)] hover:bg-[var(--app-pink-soft)]"
    >
      {label}
    </Link>
  );

  // 정렬/필터 보존하며 cursor 만 교체한 다음 페이지 URL.
  const nextHref = (() => {
    if (!nextCursor) return null;
    const n = new URLSearchParams(usp);
    n.set('cursor', nextCursor);
    return `/admin/users?${n.toString()}`;
  })();

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="가입자 관리 (admin)" backHref="/admin/operations" />

        {/* 빠른검색(기존 유지) */}
        <form method="get" className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <label htmlFor="q" className="text-[13px] font-extrabold text-[var(--app-ink)]">
            이메일 또는 UUID 빠른검색
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="kym@example.com 또는 UUID"
              className="flex-1 rounded-[10px] border border-[var(--app-line)] px-3 py-2 text-[13px]"
            />
            <button type="submit" className="rounded-[10px] bg-[var(--app-pink-strong)] px-4 py-2 text-[13px] font-extrabold text-white">
              검색
            </button>
          </div>
          {query && (
            <ul className="mt-3 space-y-2">
              {searchResults.length === 0 && (
                <li className="text-[12px] text-[var(--app-copy-soft)]">일치하는 사용자가 없습니다.</li>
              )}
              {searchResults.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="block rounded-[12px] border border-[var(--app-line)] p-3 hover:bg-[var(--app-pink-soft)]">
                    <span className="text-[13px] font-bold">{u.email ?? u.id}</span>
                    <span className="ml-2 text-[11px] text-[var(--app-copy-soft)]">{fmtDate(u.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </form>

        {/* 세그먼트 프리셋 */}
        <div className="flex flex-wrap gap-2">
          {seg('신규30일', 'sort=signup')}
          {seg('고지출', 'sort=ltv&paid=yes')}
          {seg('환불대상', 'sort=ltv&paid=yes')}
          {seg('구독중', 'subscription=active')}
          {seg('이탈위험', 'status=dormant&paid=yes&sort=last_active')}
          {seg('첫결제 미완', 'paid=no&status=active')}
        </div>

        {/* 필터바(GET form) */}
        <form method="get" className="rounded-[14px] border border-[var(--app-line)] bg-white p-4 grid grid-cols-2 gap-3 md:grid-cols-4 text-[12px]">
          <label className="flex flex-col gap-1">회원상태
            <select name="status" defaultValue={params.status} className="rounded border px-2 py-1">
              <option value="all">전체</option><option value="active">활성</option><option value="dormant">휴면</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">결제
            <select name="paid" defaultValue={params.paid} className="rounded border px-2 py-1">
              <option value="all">전체</option><option value="yes">있음</option><option value="no">없음</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">구독
            <select name="subscription" defaultValue={params.subscription} className="rounded border px-2 py-1">
              <option value="all">전체</option><option value="active">active</option><option value="cancelled">cancelled</option><option value="expired">expired</option><option value="none">없음</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">정렬
            <select name="sort" defaultValue={params.sort} className="rounded border px-2 py-1">
              <option value="signup">가입일↓</option><option value="ltv">결제액↓</option><option value="last_active">최근활동↓</option><option value="paid_count">결제건수↓</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">최소 결제액(₩)
            <input name="minLtv" type="number" defaultValue={params.minLtv ?? ''} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">비활동 ≥(일)
            <input name="inactiveDays" type="number" defaultValue={params.inactiveDays ?? ''} className="rounded border px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">가입경로
            <input name="provider" defaultValue={params.provider.join(',')} placeholder="email,google" className="rounded border px-2 py-1" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-[10px] bg-[var(--app-pink-strong)] px-4 py-2 font-extrabold text-white">적용</button>
            <Link href="/admin/users" className="rounded-[10px] border px-3 py-2">초기화</Link>
          </div>
        </form>

        {/* 목록 */}
        <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-extrabold">가입자 {items.length}{page.hasMore ? '+' : ''}명</h2>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[var(--app-copy-soft)]">기준 {page.refreshedAt ? fmtDate(page.refreshedAt) : '—'}</span>
              <a href={`/api/admin/users/export?${usp.toString()}`} className="rounded-[10px] border px-3 py-1 text-[12px]">CSV 내보내기</a>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="mt-4 rounded-[12px] border border-dashed border-[var(--app-line)] p-6 text-center">
              <p className="text-[13px] font-bold">조건에 맞는 가입자가 없어요</p>
              <p className="mt-1 text-[12px] text-[var(--app-copy-soft)]">필터를 바꾸거나 세그먼트를 눌러보세요.</p>
              <Link href="/admin/users" className="mt-3 inline-block rounded-[10px] border px-3 py-1 text-[12px]">필터 초기화</Link>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[var(--app-copy-soft)]">
                    <th className="py-1">표시명/이메일</th><th>가입일</th><th>LTV</th><th>결제</th><th>구독</th><th>최근활동</th><th>뱃지</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.userId} className="border-t border-[var(--app-line)]">
                      <td className="py-2">
                        <Link href={`/admin/users/${it.userId}`} className="font-bold hover:underline">{it.displayName}</Link>
                        <div className="text-[11px] text-[var(--app-copy-soft)]">{it.email ?? '—'}</div>
                      </td>
                      <td>{fmtDate(it.signupAt)}</td>
                      <td>{fmtWon(it.ltvWon)}</td>
                      <td>{it.paidCount}</td>
                      <td>{it.subscriptionStatus ?? '—'}</td>
                      <td>{fmtDate(it.lastActiveAt)}</td>
                      <td className="space-x-1">
                        {it.badges.map((b) => (
                          <span key={b} className="rounded bg-[var(--app-pink-soft)] px-1.5 py-0.5 text-[10px]">{b}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {nextHref && (
            <div className="mt-4 text-center">
              <Link href={nextHref} className="rounded-[10px] border px-4 py-2 text-[12px]">다음 페이지 ›</Link>
            </div>
          )}
        </section>
      </AppPage>
    </AppShell>
  );
}
```

> **검증필요(구현 시):** 위 import·컴포넌트 경로는 현행 `page.tsx`와 동일. Next 16 RSC·`searchParams`(Promise) 규약을 `node_modules/next/dist/docs/`로 확인(AGENTS.md). `--app-*` CSS 토큰·`GangiPageHeader` props 는 기존 파일 기준이므로 그대로 동작해야 한다.

- [ ] **Step 2: 타입 검사 + 빌드**

Run: `npm run typecheck`
Expected: 에러 0.

- [ ] **Step 3: 수동 확인(admin 세션)**

`/admin/users` 진입 → 빠른검색 + 세그먼트칩 + 필터바 + 목록테이블 + 다음페이지 + CSV 버튼 노출. 필터 변경 시 URL 쿼리스트링 반영·목록 갱신. 0건이면 빈상태 카드. admin 역할은 이메일 마스킹.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "feat(admin): 가입자 목록 UI(필터·정렬·세그먼트·페이지네이션·빈상태·CSV)"
```

---

## Task 14: 통합 검증 + 정리

**Files:** (없음 — 검증·확인)

- [ ] **Step 1: 전체 단위 테스트**

Run: `npm test`
Expected: 신규 테스트 포함 전부 `ok - …`, 마지막 `N tests passed`.

- [ ] **Step 2: 전체 타입 검사**

Run: `npm run typecheck`
Expected: 에러 0.

- [ ] **Step 3: 마이그레이션 적용 확인**

`049`·`050` 이 원격에 반영됐는지 `supabase migration list`(또는 대시보드)로 확인. 미반영이면 `supabase db push`.

- [ ] **Step 4: 요약 갱신 1회 실행**

super_admin 세션 또는 크론 시크릿으로 `POST /api/admin/users/summary/refresh` 1회 → `processed` 가 가입자 수와 일치.

- [ ] **Step 5: LTV 일관성 스폿체크(정의 불일치 방지)**

목록에서 임의 1명의 LTV 와, 그 사용자 `/admin/users/[id]` 상세의 결제 합계(`payment.totalSpentWon`)가 **동일**한지 비교. 다르면 Task 8 `computeUserSummary`의 `buildPaymentHistory` 입력(특히 `paid_count`·cash 필터)을 상세 레이어와 일치시킨다.

- [ ] **Step 6: 권한 음성 테스트**

비admin 계정으로 `/api/admin/users/list`·`/export` 호출 → 403. 비로그인 → 401. admin(비super) 으로 `/export` → CSV 에 `email` 컬럼 없음.

- [ ] **Step 7: 최종 정리 Commit(필요 시)**

```bash
git add -A
git commit -m "chore(admin): M1 가입자 리스트 통합 검증 마무리"
```

---

## Self-Review 결과(작성자 확인)

- **스펙 커버리지(설계서 M1 AC):** 전체목록·keyset(Task 9·13) ✓ / 정렬(Task 4·9) ✓ / 8필터 AND(Task 9·13) ✓ / N+1 회피=요약테이블(Task 1·8·9) ✓ / CSV·행상한·타임아웃(Task 11) ✓ / refreshed_at 표기(Task 13) ✓ / 빈상태(Task 13) ✓ / 역할게이트(Task 10·11) ✓ / 서버 마스킹(Task 3·5·10) ✓ / export PII super 한정 + 감사(Task 6·11·2) ✓.
- **플레이스홀더:** 코드 단계는 전부 실제 코드. 3곳 `검증필요`는 "구현 시 기존 파일로 시그니처 확정"이라는 **실행 지시**(추정 금지 항목)이며 빈칸이 아님.
- **타입 일관성:** `AdminUserListParams`/`AdminUserSummaryRow`/`AdminUserListItem`/`Cursor`/`AdminRole`/`AdminAction` 명칭과 `SORT_COLUMN` 키가 전 태스크에서 일치. `buildListItem(row, role, nowIso)`·`cursorForRow(row, sort)`·`encodeCursor`/`decodeCursor`·`buildCsv(items, role)` 시그니처 일관.
- **비목표 확인:** 코호트 잔존율·360 상세 재구성·운영 쓰기 액션·감사 뷰 페이지는 본 계획 제외(M2~M4).
