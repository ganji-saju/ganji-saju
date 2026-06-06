# 세그먼트·코호트(M2) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use `- [ ]` checkboxes.

**Goal:** M1 가입자 리스트 위에 (1) 정식 세그먼트 7종(실 필터 의미 + 라이브 인원수 + 리스트 프리셋 링크)과 (2) 가입 코호트별 D7/D30 잔존율 개요를 얹는다(설계서 M2, §4-4).

**Architecture:** 전부 기존 `admin_user_summary` 테이블에서 읽는다 — **신규 마이그레이션 없음**. 세그먼트는 하드코딩된 칩을 단일 정의 모듈(`segments.ts`)로 승격하고 각 세그먼트를 쿼리스트링으로 표현해 M1의 `parseListParams`로 재해석(SSOT). 코호트 잔존율은 `admin_user_summary`의 `signup_at`·`last_active_at`·`ltv_won`만으로 순수 계산(`cohort.ts`). 필터 적용 로직은 `user-list.ts`에서 `applyListFilters`로 추출해 목록·카운트가 공유. 순수 로직(파라미터 확장·세그먼트·코호트)은 TDD, 데이터/페이지는 typecheck + admin 세션 수동.

**Tech Stack:** Next.js 16.2.6 App Router(RSC), Supabase service_role, TS. 테스트: `npm test`(커스텀 러너, `node:assert/strict` + 전역 `test()`), `npm run typecheck`.

**잔존율 정의(확정·UI 표기):** 코호트 C(가입 월 M의 유저들). **DN 잔존율 = C 중 `last_active_at − signup_at ≥ N일`인 유저 비율.** 즉 "가입 후 최소 N일 이상 활동을 유지" 프록시(고전적 "정확히 N일째 복귀"가 아님 — 데이터 한계 정직 표기). 코호트가 충분히 성숙해야 측정: `now ≥ (코호트 월의 끝) + N일` 일 때만 값, 아니면 `—`(집계중). 소급 결손(ai_llm_runs 등)은 last_active가 로그인/리딩/대화/피드백 max라 영향 적음.

**선행 확인된 M1 심볼(근거):**
- `admin_user_summary` 컬럼: `user_id,email,display_name,signup_at,signup_provider,profile_complete,last_active_at,ltv_won,paid_count,credit_balance,credit_expiring,subscription_status,refundable_won,reading_count,chat_count,refreshed_at`.
- `@/lib/admin/user-list-query`: `AdminUserListParams`(status/signupFrom/signupTo/paid/minLtv/subscription/provider/inactiveDays/profile/sort/cursor/limit), `parseListParams`, `AdminUserSummaryRow`.
- `@/lib/admin/user-list`: `fetchAdminUserList(params)`(필터+keyset). 필터 블록을 추출 대상.
- `@/lib/admin-auth`: `getCurrentAdminRole`. `@/lib/supabase/server`: `createServiceClient`,`hasSupabaseServiceEnv`,`createClient`.
- `src/app/admin/users/page.tsx`: 하드코딩 세그먼트 칩 `seg('신규30일','sort=signup')` 등(라인 120-125) — SEGMENTS 기반으로 교체.
- 레이아웃: `GangiPageHeader`,`AppShell`,`AppPage`,`--app-*` 토큰.
- 구현 전 Next 16 규약은 `node_modules/next/dist/docs/` 확인(AGENTS.md).

---

## File Structure
**신규**
- `src/lib/admin/segments.ts` (+`segments.test.ts`) — `SEGMENTS` 정의 + 각 query가 parseListParams로 해석되는지 검증.
- `src/lib/admin/cohort.ts` (+`cohort.test.ts`) — `buildCohortRetention`(순수).
- `src/lib/admin/segments-data.ts` — `fetchSegmentCounts`, `fetchCohortRetention`(데이터, service_role).
- `src/app/admin/users/segments/page.tsx` — 세그먼트·코호트 개요 페이지.

**수정**
- `src/lib/admin/user-list-query.ts` — `AdminUserListParams`에 `signupWithinDays:number|null`, `refundable:'all'|'yes'`, `firstReading:'all'|'none'` 추가 + `parseListParams` 확장(+테스트).
- `src/lib/admin/user-list.ts` — 필터 블록을 `applyListFilters(qb, params)`로 추출, 신규 필터 3종 추가, `countAdminUsers(params)` 신설, `fetchAdminUserList`는 그대로 재사용.
- `src/app/admin/users/page.tsx` — 칩을 `SEGMENTS`로 구동 + `/admin/users/segments` 링크 추가.

**계약 타입(Task 1·3에서 확정):**
```ts
// segments.ts
export interface SegmentDef { key: string; label: string; description: string; query: string; }
// cohort.ts
export interface CohortRow { signup_at: string; last_active_at: string; ltv_won: number; }
export interface CohortMetric {
  cohort: string; size: number; avgLtvWon: number;
  d7: number | null; d30: number | null; d7Measurable: boolean; d30Measurable: boolean;
}
```

---

## Task 1: AdminUserListParams 확장 (signupWithinDays·refundable·firstReading) — TDD

**Files:** Modify `src/lib/admin/user-list-query.ts`; Modify `src/lib/admin/user-list-query.test.ts`

- [ ] **Step 1: 실패 테스트 추가** (append to `user-list-query.test.ts`)
```ts
test('parseListParams: M2 신규 필터 파싱', () => {
  const sp = new URLSearchParams('signupWithinDays=7&refundable=yes&firstReading=none');
  const p = parseListParams(sp);
  assert.equal(p.signupWithinDays, 7);
  assert.equal(p.refundable, 'yes');
  assert.equal(p.firstReading, 'none');
});

test('parseListParams: M2 신규 필터 기본값/폴백', () => {
  const p = parseListParams(new URLSearchParams(''));
  assert.equal(p.signupWithinDays, null);
  assert.equal(p.refundable, 'all');
  assert.equal(p.firstReading, 'all');
  const bad = parseListParams(new URLSearchParams('signupWithinDays=NaN&refundable=hack&firstReading=hack'));
  assert.equal(bad.signupWithinDays, null);
  assert.equal(bad.refundable, 'all');
  assert.equal(bad.firstReading, 'all');
});
```

- [ ] **Step 2:** `npm test 2>&1 | grep "M2 신규 필터"` → `not ok`.

- [ ] **Step 3: 구현** — `user-list-query.ts` 수정:
  1) 타입 추가 (기존 타입 근처):
```ts
export type RefundableFilter = 'all' | 'yes';
export type FirstReadingFilter = 'all' | 'none';
```
  2) `AdminUserListParams` 인터페이스에 3필드 추가:
```ts
  signupWithinDays: number | null;
  refundable: RefundableFilter;
  firstReading: FirstReadingFilter;
```
  3) 상수 추가 (다른 화이트리스트 배열 근처):
```ts
const REFUNDABLE: RefundableFilter[] = ['all', 'yes'];
const FIRST_READING: FirstReadingFilter[] = ['all', 'none'];
```
  4) `parseListParams` return 객체에 3필드 추가:
```ts
    signupWithinDays: parseIntOrNull(sp.get('signupWithinDays')),
    refundable: pick(sp.get('refundable'), REFUNDABLE, 'all'),
    firstReading: pick(sp.get('firstReading'), FIRST_READING, 'all'),
```

- [ ] **Step 4:** `npm test 2>&1 | grep -E "M2 신규 필터|parseListParams"` → 전부 `ok`. `npm run typecheck` → 0 (주의: `AdminUserListParams`를 만드는 다른 곳이 있으면 컴파일 에러 — 본 인터페이스는 `parseListParams`만 생성하므로 영향 없음. export route가 `{...base, cursor, limit}` 스프레드라 OK).

- [ ] **Step 5: Commit**
```bash
git add src/lib/admin/user-list-query.ts src/lib/admin/user-list-query.test.ts
git commit -m "feat(admin): 목록 파라미터에 신규/환불대상/첫사주 필터 추가(M2)"
```

---

## Task 2: segments.ts — 세그먼트 정의(SSOT) — TDD

**Files:** Create `src/lib/admin/segments.ts`, `src/lib/admin/segments.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
// src/lib/admin/segments.test.ts
import assert from 'node:assert/strict';
import { SEGMENTS } from './segments';
import { parseListParams } from './user-list-query';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

test('SEGMENTS: 7+종, key 고유', () => {
  assert.ok(SEGMENTS.length >= 7);
  const keys = SEGMENTS.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('SEGMENTS: 각 query가 parseListParams로 해석되고 의미 필터를 가짐', () => {
  for (const s of SEGMENTS) {
    const p = parseListParams(new URLSearchParams(s.query));
    // 최소 한 개의 비기본 필터를 가져야 한다(빈 세그먼트 금지)
    const meaningful =
      p.status !== 'all' || p.paid !== 'all' || p.subscription !== 'all' ||
      p.minLtv != null || p.signupWithinDays != null || p.refundable !== 'all' ||
      p.firstReading !== 'all' || p.inactiveDays != null;
    assert.ok(meaningful, `세그먼트 ${s.key} 가 의미있는 필터 없음`);
    assert.ok(s.label && s.description);
  }
});
```

- [ ] **Step 2:** `npm test 2>&1 | grep SEGMENTS` → `not ok`.

- [ ] **Step 3: 구현**
```ts
// src/lib/admin/segments.ts
// 가입자 세그먼트 단일 정의(SSOT). query 는 /admin/users?<query> 프리셋이자
// parseListParams 로 카운트 필터를 만드는 소스. (M2)
export interface SegmentDef {
  key: string;
  label: string;
  description: string;
  query: string;
}

export const SEGMENTS: SegmentDef[] = [
  { key: 'new7',        label: '신규 7일',     description: '최근 7일 내 가입',           query: 'signupWithinDays=7&sort=signup' },
  { key: 'new30',       label: '신규 30일',    description: '최근 30일 내 가입',          query: 'signupWithinDays=30&sort=signup' },
  { key: 'high_value',  label: '고지출',       description: '누적 결제 5만원 이상',       query: 'minLtv=50000&sort=ltv' },
  { key: 'refundable',  label: '환불대상',     description: '환불 가능액 보유',           query: 'refundable=yes&sort=ltv' },
  { key: 'subscribed',  label: '구독중',       description: '구독 활성',                  query: 'subscription=active&sort=last_active' },
  { key: 'at_risk',     label: '이탈위험',     description: '30일+ 비활동 & 결제 이력',   query: 'status=dormant&paid=yes&sort=last_active' },
  { key: 'no_purchase', label: '첫결제 미완',  description: '활성인데 결제 0건',          query: 'status=active&paid=no&sort=signup' },
  { key: 'no_reading',  label: '첫사주 미완',  description: '활성인데 사주 조회 0',       query: 'status=active&firstReading=none&sort=signup' },
];
```

- [ ] **Step 4:** `npm test 2>&1 | grep SEGMENTS` → 전부 `ok`. `npm run typecheck` → 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/admin/segments.ts src/lib/admin/segments.test.ts
git commit -m "feat(admin): 세그먼트 단일 정의 SEGMENTS(M2)"
```

---

## Task 3: cohort.ts — D7/D30 코호트 잔존율(순수) — TDD

**Files:** Create `src/lib/admin/cohort.ts`, `src/lib/admin/cohort.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
// src/lib/admin/cohort.test.ts
import assert from 'node:assert/strict';
import { buildCohortRetention, type CohortRow } from './cohort';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const NOW = '2026-06-06T00:00:00.000Z';
function r(signup: string, last: string, ltv = 0): CohortRow {
  return { signup_at: signup, last_active_at: last, ltv_won: ltv };
}

test('buildCohortRetention: 월별 그룹·평균LTV·최신순', () => {
  const rows = [
    r('2026-04-02T00:00:00Z', '2026-04-20T00:00:00Z', 10000),
    r('2026-04-10T00:00:00Z', '2026-04-12T00:00:00Z', 20000),
    r('2026-05-01T00:00:00Z', '2026-05-02T00:00:00Z', 0),
  ];
  const cs = buildCohortRetention(rows, NOW);
  assert.equal(cs[0].cohort, '2026-05'); // 최신 먼저
  assert.equal(cs[1].cohort, '2026-04');
  assert.equal(cs[1].size, 2);
  assert.equal(cs[1].avgLtvWon, 15000);
});

test('buildCohortRetention: 성숙 코호트 D7/D30 계산', () => {
  // 2026-04 코호트: now(6/6) ≥ (4월 끝=5/1)+30일=5/31 → D7·D30 측정 가능
  const rows = [
    r('2026-04-01T00:00:00Z', '2026-04-09T00:00:00Z', 0), // 8일 유지 → D7 yes, D30 no
    r('2026-04-01T00:00:00Z', '2026-05-15T00:00:00Z', 0), // 44일 유지 → D7 yes, D30 yes
  ];
  const c = buildCohortRetention(rows, NOW)[0];
  assert.equal(c.d7Measurable, true);
  assert.equal(c.d30Measurable, true);
  assert.equal(c.d7, 1);    // 둘 다 ≥7일
  assert.equal(c.d30, 0.5); // 한 명만 ≥30일
});

test('buildCohortRetention: 미성숙 코호트는 null', () => {
  // 2026-06 코호트: now=6/6, 6월 끝=7/1 → +7일=7/8 > now → 미측정
  const c = buildCohortRetention([r('2026-06-02T00:00:00Z', '2026-06-05T00:00:00Z', 0)], NOW)[0];
  assert.equal(c.d7Measurable, false);
  assert.equal(c.d7, null);
  assert.equal(c.d30, null);
});
```

- [ ] **Step 2:** `npm test 2>&1 | grep buildCohortRetention` → `not ok`.

- [ ] **Step 3: 구현**
```ts
// src/lib/admin/cohort.ts
// 가입 코호트별 D7/D30 잔존율(순수). admin_user_summary 만으로 계산.
// DN 잔존율 = (last_active_at − signup_at ≥ N일) 비율. 성숙 코호트만 측정.
export interface CohortRow {
  signup_at: string;
  last_active_at: string;
  ltv_won: number;
}
export interface CohortMetric {
  cohort: string;        // 'YYYY-MM'
  size: number;
  avgLtvWon: number;
  d7: number | null;     // 0..1
  d30: number | null;
  d7Measurable: boolean;
  d30Measurable: boolean;
}

const DAY = 86_400_000;

function monthKey(iso: string): string {
  return iso.slice(0, 7); // 'YYYY-MM' (UTC 기준)
}

/** 코호트 월의 '끝'(다음 달 1일 0시 UTC, exclusive) ms. */
function monthEndMs(key: string): number {
  const [y, m] = key.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return Date.UTC(ny, nm - 1, 1);
}

export function buildCohortRetention(rows: CohortRow[], nowIso: string): CohortMetric[] {
  const now = new Date(nowIso).getTime();
  const groups = new Map<string, CohortRow[]>();
  for (const row of rows) {
    const k = monthKey(row.signup_at);
    const arr = groups.get(k);
    if (arr) arr.push(row);
    else groups.set(k, [row]);
  }
  const out: CohortMetric[] = [];
  for (const [cohort, list] of groups) {
    const size = list.length;
    const avgLtvWon = Math.round(list.reduce((s, r) => s + r.ltv_won, 0) / size);
    const end = monthEndMs(cohort);
    const d7Measurable = now >= end + 7 * DAY;
    const d30Measurable = now >= end + 30 * DAY;
    const lasted = (r: CohortRow, n: number) =>
      new Date(r.last_active_at).getTime() - new Date(r.signup_at).getTime() >= n * DAY;
    const d7 = d7Measurable ? list.filter((r) => lasted(r, 7)).length / size : null;
    const d30 = d30Measurable ? list.filter((r) => lasted(r, 30)).length / size : null;
    out.push({ cohort, size, avgLtvWon, d7, d30, d7Measurable, d30Measurable });
  }
  return out.sort((a, b) => b.cohort.localeCompare(a.cohort));
}
```

- [ ] **Step 4:** `npm test 2>&1 | grep buildCohortRetention` → 전부 `ok`. `npm run typecheck` → 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/admin/cohort.ts src/lib/admin/cohort.test.ts
git commit -m "feat(admin): 코호트 D7/D30 잔존율 순수 로직(M2)"
```

---

## Task 4: user-list.ts — applyListFilters 추출 + 신규 필터 + countAdminUsers

**Files:** Modify `src/lib/admin/user-list.ts`

- [ ] **Step 1: 리팩터 + 추가** — 현재 `fetchAdminUserList` 내부의 필터 적용 블록(`// ── 필터(전부 AND) ──` ~ keyset 직전)을 별도 함수로 추출하고 신규 필터 3종을 더한 뒤, `fetchAdminUserList`와 신규 `countAdminUsers`가 공유한다. 파일을 다음으로 정리:
```ts
// (상단 import 동일 + AdminUserListParams 타입은 이미 import)
type SummaryQuery = ReturnType<Awaited<ReturnType<typeof createServiceClient>>['from']>;

/** 모든 필터를 AND로 적용(목록·카운트 공유). */
function applyListFilters(qb: SummaryQuery, params: AdminUserListParams): SummaryQuery {
  let q = qb;
  if (params.status === 'active') {
    q = q.gte('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  } else if (params.status === 'dormant') {
    q = q.lt('last_active_at', new Date(Date.now() - 30 * 86400000).toISOString());
  }
  if (params.signupFrom) q = q.gte('signup_at', `${params.signupFrom}T00:00:00.000Z`);
  if (params.signupTo) q = q.lte('signup_at', `${params.signupTo}T23:59:59.999Z`);
  if (params.signupWithinDays != null) {
    q = q.gte('signup_at', new Date(Date.now() - params.signupWithinDays * 86400000).toISOString());
  }
  if (params.paid === 'yes') q = q.gt('paid_count', 0);
  if (params.paid === 'no') q = q.eq('paid_count', 0);
  if (params.minLtv != null) q = q.gte('ltv_won', params.minLtv);
  if (params.refundable === 'yes') q = q.gt('refundable_won', 0);
  if (params.firstReading === 'none') q = q.eq('reading_count', 0);
  if (params.subscription === 'none') q = q.is('subscription_status', null);
  else if (params.subscription !== 'all') q = q.eq('subscription_status', params.subscription);
  if (params.provider.length > 0) q = q.in('signup_provider', params.provider);
  if (params.inactiveDays != null) {
    q = q.lt('last_active_at', new Date(Date.now() - params.inactiveDays * 86400000).toISOString());
  }
  if (params.profile === 'complete') q = q.eq('profile_complete', true);
  if (params.profile === 'incomplete') q = q.eq('profile_complete', false);
  return q;
}
```
  그리고 `fetchAdminUserList` 안의 기존 필터 블록을 `qb = applyListFilters(qb, params);` 한 줄로 교체(keyset/sort/limit 부분은 그대로 유지). 추가로 카운트 함수:
```ts
/** 세그먼트 인원수 등 — 필터 적용 후 정확 카운트(행 미전송). */
export async function countAdminUsers(params: AdminUserListParams): Promise<number> {
  if (!hasSupabaseServiceEnv) return 0;
  const service = await createServiceClient();
  let qb = service.from('admin_user_summary').select('user_id', { count: 'exact', head: true });
  qb = applyListFilters(qb, params);
  const { count, error } = await qb;
  return error ? 0 : (count ?? 0);
}
```
> **검증필요:** `SummaryQuery` 타입 별칭이 supabase 빌더 체인 타입과 안 맞으면, `applyListFilters`의 `qb` 파라미터·반환을 `any`(또는 `let q: typeof qb`) 로 두고 동작 우선. 핵심은 동일 필터를 목록·카운트가 공유하는 것.

- [ ] **Step 2:** `npm run typecheck` → 0. `npm test` → 기존 172+신규 전부 통과(이 파일은 단위테스트 없음, 회귀만 확인).

- [ ] **Step 3: Commit**
```bash
git add src/lib/admin/user-list.ts
git commit -m "feat(admin): applyListFilters 추출 + 신규필터 + countAdminUsers(M2)"
```

---

## Task 5: segments-data.ts — 세그먼트 카운트 + 코호트 fetch(데이터)

**Files:** Create `src/lib/admin/segments-data.ts`

- [ ] **Step 1: 구현**
```ts
// src/lib/admin/segments-data.ts
// 세그먼트 인원수 + 코호트 잔존율 데이터. service_role.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';
import { parseListParams } from './user-list-query';
import { countAdminUsers } from './user-list';
import { SEGMENTS, type SegmentDef } from './segments';
import { buildCohortRetention, type CohortRow, type CohortMetric } from './cohort';

export interface SegmentCount {
  segment: SegmentDef;
  count: number;
}

export async function fetchSegmentCounts(): Promise<SegmentCount[]> {
  const out: SegmentCount[] = [];
  for (const segment of SEGMENTS) {
    const params = parseListParams(new URLSearchParams(segment.query));
    out.push({ segment, count: await countAdminUsers(params) });
  }
  return out;
}

export async function fetchCohortRetention(nowIso: string): Promise<CohortMetric[]> {
  if (!hasSupabaseServiceEnv) return [];
  const service = await createServiceClient();
  const { data, error } = await service
    .from('admin_user_summary')
    .select('signup_at, last_active_at, ltv_won');
  if (error || !data) return [];
  return buildCohortRetention(data as unknown as CohortRow[], nowIso);
}
```
> 카운트는 세그먼트 수(8) 만큼 순차 head 쿼리 — 가볍다. 대규모 시 단일 집계 쿼리로 최적화 가능(후속).

- [ ] **Step 2:** `npm run typecheck` → 0. `npm test` → 회귀 통과.

- [ ] **Step 3: Commit**
```bash
git add src/lib/admin/segments-data.ts
git commit -m "feat(admin): 세그먼트 카운트·코호트 잔존율 데이터 레이어(M2)"
```

---

## Task 6: /admin/users/segments 개요 페이지

**Files:** Create `src/app/admin/users/segments/page.tsx`

- [ ] **Step 1: 구현**
```tsx
// src/app/admin/users/segments/page.tsx
// 세그먼트 카드(인원수 → 리스트 프리셋) + 코호트 D7/D30 잔존율 개요. admin 게이트.
import type { Metadata } from 'next';
import Link from 'next/link';
import { GangiPageHeader } from '@/components/gangi/gangi-ui';
import SiteHeader from '@/features/shared-navigation/site-header';
import { AppPage, AppShell } from '@/shared/layout/app-shell';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminRole } from '@/lib/admin-auth';
import { fetchSegmentCounts, fetchCohortRetention } from '@/lib/admin/segments-data';

export const metadata: Metadata = {
  title: '세그먼트·코호트 (admin)',
  description: '가입자 세그먼트 인원과 코호트 잔존율',
  robots: { index: false, follow: false },
};

function pct(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}
function fmtWon(won: number): string {
  return `₩${won.toLocaleString('ko-KR')}`;
}

export default async function AdminSegmentsPage() {
  const supabase = await createClient();
  await getCurrentAdminRole(supabase); // /admin 레이아웃이 1차 가드, 여기선 컨텍스트만

  const nowIso = new Date().toISOString();
  const [counts, cohorts] = await Promise.all([fetchSegmentCounts(), fetchCohortRetention(nowIso)]);

  return (
    <AppShell header={<SiteHeader />} className="gangi-subpage-shell pb-24 md:pb-12">
      <AppPage className="gangi-subpage saju-result-page space-y-5">
        <GangiPageHeader title="세그먼트·코호트 (admin)" backHref="/admin/users" />

        {/* 세그먼트 카드 */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {counts.map(({ segment, count }) => (
            <Link
              key={segment.key}
              href={`/admin/users?${segment.query}`}
              className="rounded-[14px] border border-[var(--app-line)] bg-white p-4 hover:bg-[var(--app-pink-soft)]"
            >
              <div className="text-[12px] text-[var(--app-copy-soft)]">{segment.label}</div>
              <div className="text-[22px] font-extrabold text-[var(--app-ink)]">{count.toLocaleString('ko-KR')}</div>
              <div className="mt-1 text-[11px] text-[var(--app-copy-soft)]">{segment.description}</div>
            </Link>
          ))}
        </section>

        {/* 코호트 잔존율 */}
        <section className="rounded-[14px] border border-[var(--app-line)] bg-white p-4">
          <h2 className="text-[13px] font-extrabold text-[var(--app-ink)]">가입 코호트 잔존율</h2>
          <p className="mt-1 text-[11px] text-[var(--app-copy-soft)]">
            DN = 가입 후 N일 이상 활동 유지 비율(프록시). 성숙 코호트만 표시, 그 외 —. 표본 적을 땐 참고치.
          </p>
          {cohorts.length === 0 ? (
            <p className="mt-3 text-[12px] text-[var(--app-copy-soft)]">데이터가 없습니다.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[var(--app-copy-soft)]">
                    <th className="py-1">가입월</th><th>인원</th><th>평균 LTV</th><th>D7</th><th>D30</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.cohort} className="border-t border-[var(--app-line)]">
                      <td className="py-2 font-bold">{c.cohort}</td>
                      <td>{c.size}</td>
                      <td>{fmtWon(c.avgLtvWon)}</td>
                      <td>{pct(c.d7)}</td>
                      <td>{pct(c.d30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AppPage>
    </AppShell>
  );
}
```
> **검증필요:** import 경로·레이아웃 컴포넌트는 `/admin/users/page.tsx`와 동일. Next 16 RSC 규약은 `node_modules/next/dist/docs/` 확인(AGENTS.md).

- [ ] **Step 2:** `npm run typecheck` → 0. `npm test` → 회귀 통과.

- [ ] **Step 3: 수동 확인(admin 세션):** `/admin/users/segments` 진입 → 세그먼트 카드(인원수) + 코호트 표 노출. 카드 클릭 시 해당 프리셋으로 `/admin/users` 이동.

- [ ] **Step 4: Commit**
```bash
git add src/app/admin/users/segments/page.tsx
git commit -m "feat(admin): 세그먼트·코호트 개요 페이지(M2)"
```

---

## Task 7: /admin/users 칩을 SEGMENTS로 구동 + /segments 링크

**Files:** Modify `src/app/admin/users/page.tsx`

- [ ] **Step 1:** import 추가 (다른 `@/lib/admin/*` import 근처):
```ts
import { SEGMENTS } from '@/lib/admin/segments';
```

- [ ] **Step 2:** 기존 하드코딩 칩 블록(라인 ~120-125, `<div className="flex flex-wrap gap-2">` 내부의 `{seg('신규30일','sort=signup')}` … 6줄)을 SEGMENTS 구동 + 개요 링크로 교체:
```tsx
        <div className="flex flex-wrap items-center gap-2">
          {SEGMENTS.map((s) => (
            <Link
              key={s.key}
              href={`/admin/users?${s.query}`}
              title={s.description}
              className="rounded-full border border-[var(--app-line)] px-3 py-1 text-[12px] text-[var(--app-ink)] hover:bg-[var(--app-pink-soft)]"
            >
              {s.label}
            </Link>
          ))}
          <Link
            href="/admin/users/segments"
            className="rounded-full border border-[var(--app-pink-strong)] px-3 py-1 text-[12px] font-extrabold text-[var(--app-pink-strong)]"
          >
            세그먼트·코호트 개요 →
          </Link>
        </div>
```
> 기존 로컬 `seg` 헬퍼가 더 이상 안 쓰이면 제거(미사용 경고 방지). `Link`는 이미 import됨.

- [ ] **Step 3:** `npm run typecheck` → 0 (미사용 `seg` 제거 확인). `npm test` → 회귀 통과.

- [ ] **Step 4: 수동 확인:** `/admin/users` 칩이 8종(신규7/30·고지출·환불대상·구독중·이탈위험·첫결제미완·첫사주미완) + "개요 →" 링크로 뜨고, 각 칩이 올바른 필터로 목록을 거른다(예: 환불대상 → refundable_won>0 만).

- [ ] **Step 5: Commit**
```bash
git add src/app/admin/users/page.tsx
git commit -m "feat(admin): 목록 세그먼트 칩 SEGMENTS 구동 + 개요 링크(M2)"
```

---

## Task 8: 통합 검증

**Files:** (없음)

- [ ] **Step 1:** `npm test` → 전부 `ok`, 마지막 `N tests passed`(M1 172 + M2 신규).
- [ ] **Step 2:** `npm run typecheck` → 0 errors.
- [ ] **Step 3: 마이그레이션 없음 확인** — M2는 `admin_user_summary`만 읽음. **신규 SQL/수동 적용 불필요**(배포만으로 동작).
- [ ] **Step 4: 수동(admin 세션):** `/admin/users/segments` 카드 인원수가 목록 프리셋 결과 수와 일치, 코호트 표가 가입월별로 나오고 미성숙 코호트는 `—`.
- [ ] **Step 5: (선택) Commit**
```bash
git add -A && git commit -m "chore(admin): M2 세그먼트·코호트 통합 검증" || true
```

---

## Self-Review (작성자)
- **스펙 커버리지(§4-4):** 세그먼트 7+종 정의·인원수·프리셋 링크(Task 2·5·6·7) ✓ / D7·D30 코호트 잔존율(Task 3·5·6) ✓ / 0명 세그먼트 카드 자연 표시(count 0) ✓ / 마케팅 발송은 C1 전제라 본 범위 제외(비목표) ✓.
- **플레이스홀더:** 코드 단계 전부 실제 코드. 2곳 `검증필요`는 "구현 시 supabase 빌더 타입/Next 규약 확정" 실행 지시.
- **타입 일관성:** `SegmentDef`/`CohortRow`/`CohortMetric`/`AdminUserListParams`(확장 3필드)·`applyListFilters`·`countAdminUsers`·`fetchSegmentCounts`·`fetchCohortRetention` 명칭 전 태스크 일치. `parseListParams`가 신규 필드를 채우므로 segments query→count 경로 정합.
- **DB 변경:** 없음(M1 `admin_user_summary` 재사용). 성능: 세그먼트 8 head-count + 코호트 1 select — 경량.
- **비목표:** 마케팅 발송 트리거(C1), 360 상세(M3), 운영 쓰기(M4)는 제외.
