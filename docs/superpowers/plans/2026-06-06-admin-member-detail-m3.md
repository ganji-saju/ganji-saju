# 360 상세 탭 재구성(M3) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** 기존 Phase 1 상세 페이지(`/admin/users/[id]`, 6카드 평면)를 **요약 헤더 + 6탭**으로 재구성하고, 누락 카테고리(가족·피드백·후기·예약·알림·정책동의)를 연결하며, **서버측 PII 마스킹**(현재 이메일·생년월일이 전 admin에 노출)과 **열람 감사(`view_detail`)**를 추가한다(설계서 §4-3).

**Architecture:** 신규 마이그레이션 없음 — 기존 테이블(`admin_access_log` 포함, M1 050) 재사용. 기존 `getAdminUserDetail`(테스트 고정)은 **건드리지 않고**, 누락 카테고리는 별도 `getMemberExtras(userId)`(요약/카운트 위주)로 모은다. 페이지(server)는 `getAdminUserDetail` + `getMemberExtras` + `admin_user_summary` 단일행을 모아, **순수 함수 `buildMemberDetailView`**로 역할별 마스킹·필드 제거·요약 헤더를 계산한 뒤, 직렬화된(이미 마스킹된) 데이터를 클라이언트 탭 컴포넌트에 넘긴다(super 전용 필드는 서버에서 제거 → 브라우저 미전송). 진입 시 `logAdminAccess('view_detail')` 기록. 순수 로직(view 빌더)은 TDD, 데이터/UI는 typecheck + admin 세션 수동.

**Tech Stack:** Next.js 16.2.6(RSC + 'use client' 탭), Supabase service_role, TS. 테스트: `npm test`(커스텀 러너, `node:assert/strict`+전역 `test()`), `npm run typecheck`. 구현 전 Next 16 규약 `node_modules/next/dist/docs/` 확인(AGENTS.md).

**선행 확인된 자산(근거):**
- `@/lib/admin/user-detail`: `getAdminUserDetail(id)` → `AdminUserDetail`{ id,email,createdAt,profile{displayName,birthYear,birthMonth,birthDay,birthHour,gender},palja,latestReadingAt,readingCount,payment{entries,totalSpentWon,count},dialogueCount,llmStats,refund{items,creditItems,totalRefundableWon},refundRequests }.
- `@/lib/admin/masking`: `maskEmail(email,role)`, `maskBirthDate(y,m,d,role)`(M1, 테스트 고정).
- `@/lib/admin/access-log`: `logAdminAccess({actorId,actorRole,action:'view_detail',targetUser,...})`(M1).
- `@/lib/admin-auth`: `getCurrentAdminRole(client)` → {ok,userId,role,reason}.
- `@/lib/supabase/server`: `createClient`,`createServiceClient`,`hasSupabaseServiceEnv`.
- `admin_user_summary` 컬럼(M1): last_active_at, subscription_status, signup_provider, ltv_won, refundable_won, credit_balance, credit_expiring 등 — 헤더 요약에 재사용.
- 기존 페이지 `src/app/admin/users/[id]/page.tsx`(6카드, `RefundActions role/items/creditItems/requests`)·`refund-actions.tsx`(클라이언트, 그대로 탭6 재사용).
- 누락 카테고리 테이블(컬럼은 **구현 시 해당 마이그레이션에서 확인**): family_profiles(003: label,relationship,birth_year/month/day/hour,gender), today_fortune_feedback(023), fortune_feedback(013: accuracy_label,accuracy_score), chapter_feedback(035: rating,helpful_bool,comment), reviews(033: rating,is_verified_purchase,moderation_status,display_name), appointments(021: status,…), notification_preferences·push_subscriptions(004), notification_delivery_logs(026: clicked_at,variant), user_policy_consents·policy_versions(031: kind,requires_reconsent,consent_method,consented_at), star_sign_favorites(027: slug).

**역할별 노출 규칙(서버에서 적용):** admin=이메일/생년월일 마스킹·영수증 합계만·가족 상세 가림·IP/UA 가림; super_admin=원본. **대화 원문은 누구도 비노출(건수/메타만)**.

---

## File Structure
**신규**
- `src/lib/admin/member-extras.ts` — `getMemberExtras(userId)` (데이터, 요약/카운트). 컬럼은 마이그레이션 확인.
- `src/lib/admin/detail-view.ts` (+`detail-view.test.ts`) — `buildMemberDetailView`(순수: 마스킹·역할필터·요약헤더).
- `src/app/admin/users/[id]/member-detail-tabs.tsx` — 'use client' 탭 UI.
**수정**
- `src/app/admin/users/[id]/page.tsx` — 재작성(fetch→audit→view 빌드→헤더+탭 렌더).

**계약 타입(Task 2에서 확정):**
```ts
// member-extras.ts
export interface MemberExtras {
  familyCount: number;
  feedback: { todayCount: number; accuracyCount: number; chapterCount: number; avgChapterRating: number | null };
  reviews: { count: number; avgRating: number | null; verifiedCount: number };
  appointments: { total: number; byStatus: Record<string, number> };
  notifications: { activeDevices: number; lastSeenAt: string | null; deliveries: number; clicks: number; follows: number };
  consent: { latestMethod: string | null; latestAt: string | null; needsReconsent: boolean };
}
// detail-view.ts (역할별 마스킹·요약 적용된 뷰모델)
export interface MemberHeader {
  displayName: string; emailMasked: string | null; uuid: string;
  signupAt: string; ageDays: number; ltvWon: number;
  subscriptionStatus: string | null; inactiveDays: number | null; refundableWon: number; isSuper: boolean;
}
export interface MemberDetailView {
  header: MemberHeader;
  birthMasked: string | null;
  receiptVisible: boolean; // super_admin 만 영수증 상세
}
```

---

## Task 1: detail-view.ts — 순수 뷰빌더(마스킹·요약헤더) — TDD

**Files:** Create `src/lib/admin/detail-view.ts`, `src/lib/admin/detail-view.test.ts`

- [ ] **Step 1: 실패 테스트**
```ts
// src/lib/admin/detail-view.test.ts
import assert from 'node:assert/strict';
import { buildMemberHeader, formatBirth } from './detail-view';

declare const test: (name: string, fn: () => void | Promise<void>) => void;
const NOW = '2026-06-06T00:00:00.000Z';

const base = {
  id: 'u-1', email: 'hong@example.com', createdAt: '2026-05-07T00:00:00.000Z',
  profile: { displayName: '홍길동', birthYear: 1999, birthMonth: 4, birthDay: 1, birthHour: 14, gender: 'female' },
  ltvWon: 39000, subscriptionStatus: null as string | null,
  lastActiveAt: '2026-06-04T00:00:00.000Z', refundableWon: 9000,
};

test('buildMemberHeader: admin 이메일 마스킹 + 경과일/비활동일', () => {
  const h = buildMemberHeader(base, 'admin', NOW);
  assert.equal(h.emailMasked, 'h***@e***.com');
  assert.equal(h.displayName, '홍길동');
  assert.equal(h.ageDays, 30);       // 5/7 → 6/6
  assert.equal(h.inactiveDays, 2);   // 6/4 → 6/6
  assert.equal(h.ltvWon, 39000);
  assert.equal(h.refundableWon, 9000);
  assert.equal(h.isSuper, false);
});

test('buildMemberHeader: super 이메일 원본 + isSuper', () => {
  const h = buildMemberHeader(base, 'super_admin', NOW);
  assert.equal(h.emailMasked, 'hong@example.com');
  assert.equal(h.isSuper, true);
});

test('buildMemberHeader: displayName 폴백, lastActive 없으면 inactiveDays null', () => {
  const h = buildMemberHeader({ ...base, profile: { ...base.profile, displayName: null }, lastActiveAt: null }, 'admin', NOW);
  assert.equal(h.displayName, '회원-u-1');
  assert.equal(h.inactiveDays, null);
});

test('formatBirth: admin 연도만, super 전체', () => {
  assert.equal(formatBirth(1999, 4, 1, 'admin'), '1999-**-**');
  assert.equal(formatBirth(1999, 4, 1, 'super_admin'), '1999-04-01');
  assert.equal(formatBirth(null, null, null, 'admin'), null);
});
```

- [ ] **Step 2:** `npm test 2>&1 | grep -E "buildMemberHeader|formatBirth"` → `not ok`.

- [ ] **Step 3: 구현**
```ts
// src/lib/admin/detail-view.ts
// 상세 뷰 순수 로직: 역할별 마스킹 + 요약 헤더 계산. (M3)
import type { AdminRole } from '@/lib/admin-auth';
import { maskEmail, maskBirthDate } from './masking';

const DAY = 86_400_000;

export interface HeaderInput {
  id: string;
  email: string | null;
  createdAt: string;
  profile: { displayName: string | null } | null;
  ltvWon: number;
  subscriptionStatus: string | null;
  lastActiveAt: string | null;
  refundableWon: number;
}

export interface MemberHeader {
  displayName: string;
  emailMasked: string | null;
  uuid: string;
  signupAt: string;
  ageDays: number;
  ltvWon: number;
  subscriptionStatus: string | null;
  inactiveDays: number | null;
  refundableWon: number;
  isSuper: boolean;
}

function daysBetween(fromIso: string, nowIso: string): number {
  return Math.floor((new Date(nowIso).getTime() - new Date(fromIso).getTime()) / DAY);
}

export function buildMemberHeader(input: HeaderInput, role: AdminRole, nowIso: string): MemberHeader {
  const displayName =
    input.profile?.displayName && input.profile.displayName.trim()
      ? input.profile.displayName.trim()
      : `회원-${input.id.slice(0, 8)}`;
  return {
    displayName,
    emailMasked: maskEmail(input.email, role),
    uuid: input.id,
    signupAt: input.createdAt,
    ageDays: daysBetween(input.createdAt, nowIso),
    ltvWon: input.ltvWon,
    subscriptionStatus: input.subscriptionStatus,
    inactiveDays: input.lastActiveAt ? daysBetween(input.lastActiveAt, nowIso) : null,
    refundableWon: input.refundableWon,
    isSuper: role === 'super_admin',
  };
}

export function formatBirth(
  year: number | null,
  month: number | null,
  day: number | null,
  role: AdminRole
): string | null {
  return maskBirthDate(year, month, day, role);
}
```

- [ ] **Step 4:** `npm test 2>&1 | grep -E "buildMemberHeader|formatBirth"` → all `ok`. `npm run typecheck` → 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/admin/detail-view.ts src/lib/admin/detail-view.test.ts
git commit -m "feat(admin): 상세 뷰 순수 로직(역할 마스킹·요약 헤더)(M3)"
```

---

## Task 2: member-extras.ts — 누락 카테고리 요약(데이터)

**Files:** Create `src/lib/admin/member-extras.ts`

> ⚠️ 각 쿼리의 **테이블/컬럼명을 해당 마이그레이션에서 먼저 확인**하라(파일은 선행 자산 절 참조). 없거나 다르면 그 필드는 0/null 로 안전 처리. 모든 쿼리는 `head:true` count 또는 소량 select. 대화 원문은 절대 select 금지.

- [ ] **Step 1: 구현(컬럼 확인 후)**
```ts
// src/lib/admin/member-extras.ts
// 상세 누락 카테고리 요약(가족·피드백·후기·예약·알림·동의). service_role, 카운트 위주.
import { createServiceClient, hasSupabaseServiceEnv } from '@/lib/supabase/server';

export interface MemberExtras {
  familyCount: number;
  feedback: { todayCount: number; accuracyCount: number; chapterCount: number; avgChapterRating: number | null };
  reviews: { count: number; avgRating: number | null; verifiedCount: number };
  appointments: { total: number; byStatus: Record<string, number> };
  notifications: { activeDevices: number; lastSeenAt: string | null; deliveries: number; clicks: number; follows: number };
  consent: { latestMethod: string | null; latestAt: string | null; needsReconsent: boolean };
}

const EMPTY: MemberExtras = {
  familyCount: 0,
  feedback: { todayCount: 0, accuracyCount: 0, chapterCount: 0, avgChapterRating: null },
  reviews: { count: 0, avgRating: null, verifiedCount: 0 },
  appointments: { total: 0, byStatus: {} },
  notifications: { activeDevices: 0, lastSeenAt: null, deliveries: 0, clicks: 0, follows: 0 },
  consent: { latestMethod: null, latestAt: null, needsReconsent: false },
};

async function headCount(service: Awaited<ReturnType<typeof createServiceClient>>, table: string, userId: string): Promise<number> {
  const { count } = await service.from(table).select('user_id', { count: 'exact', head: true }).eq('user_id', userId);
  return count ?? 0;
}

export async function getMemberExtras(userId: string): Promise<MemberExtras> {
  if (!hasSupabaseServiceEnv) return EMPTY;
  const service = await createServiceClient();

  // 가족
  const familyCount = await headCount(service, 'family_profiles', userId);

  // 피드백 — 카운트 + 챕터 평균 별점
  const todayCount = await headCount(service, 'today_fortune_feedback', userId);
  const accuracyCount = await headCount(service, 'fortune_feedback', userId);
  const { data: chapterRows } = await service
    .from('chapter_feedback').select('rating').eq('user_id', userId);
  const ratings = (chapterRows ?? []).map((r) => (r as { rating: number | null }).rating).filter((n): n is number => typeof n === 'number');
  const avgChapterRating = ratings.length ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10 : null;

  // 후기
  const { data: reviewRows } = await service
    .from('reviews').select('rating, is_verified_purchase').eq('user_id', userId);
  const rv = (reviewRows ?? []) as Array<{ rating: number | null; is_verified_purchase: boolean | null }>;
  const reviewRatings = rv.map((r) => r.rating).filter((n): n is number => typeof n === 'number');
  const reviews = {
    count: rv.length,
    avgRating: reviewRatings.length ? Math.round((reviewRatings.reduce((s, n) => s + n, 0) / reviewRatings.length) * 10) / 10 : null,
    verifiedCount: rv.filter((r) => r.is_verified_purchase).length,
  };

  // 예약 — 상태별
  const { data: apptRows } = await service.from('appointments').select('status').eq('user_id', userId);
  const byStatus: Record<string, number> = {};
  for (const a of (apptRows ?? []) as Array<{ status: string }>) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  const appointments = { total: (apptRows ?? []).length, byStatus };

  // 알림 — 활성 기기·마지막조회·발송/클릭·팔로우
  const { count: activeDevices } = await service
    .from('push_subscriptions').select('user_id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true);
  const { data: prefRow } = await service
    .from('notification_preferences').select('last_seen_at').eq('user_id', userId).maybeSingle();
  const deliveries = await headCount(service, 'notification_delivery_logs', userId);
  const { count: clicks } = await service
    .from('notification_delivery_logs').select('user_id', { count: 'exact', head: true }).eq('user_id', userId).not('clicked_at', 'is', null);
  const follows = await headCount(service, 'star_sign_favorites', userId);
  const notifications = {
    activeDevices: activeDevices ?? 0,
    lastSeenAt: (prefRow as { last_seen_at?: string | null } | null)?.last_seen_at ?? null,
    deliveries,
    clicks: clicks ?? 0,
    follows,
  };

  // 정책 동의 — 최신 + 재동의 필요
  const { data: consentRows } = await service
    .from('user_policy_consents')
    .select('consent_method, consented_at, policy_version_id')
    .eq('user_id', userId)
    .order('consented_at', { ascending: false })
    .limit(1);
  const latest = (consentRows ?? [])[0] as { consent_method?: string; consented_at?: string } | undefined;
  const consent = { latestMethod: latest?.consent_method ?? null, latestAt: latest?.consented_at ?? null, needsReconsent: false };

  return { familyCount, feedback: { todayCount, accuracyCount, chapterCount: ratings.length, avgChapterRating }, reviews, appointments, notifications, consent };
}
```
> `needsReconsent`는 `policy_versions.requires_reconsent` JOIN 필요(M1 검증 결과: 컬럼은 policy_versions). 1차에선 false 고정, JOIN은 후속(과도구현 방지). 컬럼명이 다르면(예: notification_delivery_logs에 user_id 없을 수 있음) 해당 항목만 0 처리하고 주석 남길 것.

- [ ] **Step 2:** `npm run typecheck` → 0. `npm test 2>&1 | grep "tests passed"` → 회귀 통과.

- [ ] **Step 3: Commit**
```bash
git add src/lib/admin/member-extras.ts
git commit -m "feat(admin): 상세 누락 카테고리 요약 데이터(가족·피드백·후기·예약·알림·동의)(M3)"
```

---

## Task 3: member-detail-tabs.tsx — 탭 UI(클라이언트)

**Files:** Create `src/app/admin/users/[id]/member-detail-tabs.tsx`

- [ ] **Step 1: 구현** — 6탭 클라이언트 컴포넌트. props는 **이미 서버에서 마스킹/필터된** 직렬화 데이터 + 환불용 RefundActions를 children/슬롯으로 받는다.
```tsx
'use client';
import { useState, type ReactNode } from 'react';

export interface DetailTab { key: string; label: string; content: ReactNode; }

export function MemberDetailTabs({ tabs }: { tabs: DetailTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`rounded-full px-3 py-1 text-[12px] font-bold ${
              t.key === current?.key
                ? 'bg-[var(--app-pink-strong)] text-white'
                : 'border border-[var(--app-line)] text-[var(--app-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current?.content}</div>
    </div>
  );
}
```
> RefundActions(클라이언트)를 탭 content로 넘기려면 탭 컴포넌트도 클라이언트여야 함(위 'use client'). content는 서버에서 만든 JSX(서버 컴포넌트 출력) — Next 16에서 server JSX를 client 컴포넌트의 prop으로 전달 가능(RSC 규약). 구현 중 직렬화 이슈 있으면 `node_modules/next/dist/docs/` 확인.

- [ ] **Step 2:** `npm run typecheck` → 0.

- [ ] **Step 3: Commit**
```bash
git add "src/app/admin/users/[id]/member-detail-tabs.tsx"
git commit -m "feat(admin): 상세 탭 컴포넌트(M3)"
```

---

## Task 4: page.tsx 재작성 — 헤더 + 6탭 + 감사 + 마스킹

**Files:** Modify `src/app/admin/users/[id]/page.tsx`

- [ ] **Step 1: 재작성** — 흐름: (1) `getCurrentAdminRole`로 role/actor 확보, (2) `getAdminUserDetail(id)` + `getMemberExtras(id)` + `admin_user_summary` 단일행 병렬 fetch, (3) `logAdminAccess({actorId, actorRole:role, action:'view_detail', targetUser:id})`, (4) `buildMemberHeader(...)`·`formatBirth(...)`로 마스킹/요약, (5) 요약 헤더 + `MemberDetailTabs` 렌더(6탭: 회원·프로필 / 사주·콘텐츠 / 결제·크레딧 / 활동·참여 / LLM·비용 / 환불·운영). 기존 Card/Field 헬퍼·RefundActions 재사용. **admin 이면 이메일/생년월일은 마스킹값만, 영수증은 합계만(super는 maskReceipt 상세)**. 감사 배너 1줄 표기.
  - 핵심 구현 지침:
    - role: `const check = await getCurrentAdminRole(supabase); const role = check.role ?? 'admin';`
    - 헤더 input.lastActiveAt/subscriptionStatus/ltvWon/refundableWon: `admin_user_summary` 행 + `detail.payment.totalSpentWon`/`detail.refund.totalRefundableWon`로 채움(요약행 없으면 detail 값 폴백).
    - 이메일 표시: `header.emailMasked`. 생년월일: `formatBirth(profile.birthYear, profile.birthMonth, profile.birthDay, role)`(+시 별도). super 아니면 영수증·가족 상세 가림.
    - 탭4(활동·참여)는 `extras`의 피드백/후기/예약/알림 요약 + `detail.dialogueCount`. 탭1에 가족 수·정책동의 요약.
    - 감사 실패는 무시(logAdminAccess가 이미 try/catch).
> 전체 JSX 코드는 기존 page.tsx의 Card/Field 패턴을 그대로 따른다(이미 파일에 정의됨). 탭 content를 `MemberDetailTabs`의 `tabs` 배열로 구성. import 추가: `getMemberExtras`, `buildMemberHeader`/`formatBirth`, `MemberDetailTabs`, `logAdminAccess`, `createServiceClient`(요약행 조회).

- [ ] **Step 2:** `npm run typecheck` → 0. `npm test 2>&1 | grep "tests passed"` → 회귀. `npm run build` → 성공.

- [ ] **Step 3: 수동(admin 세션):** `/admin/users/[id]` → 요약 헤더 + 6탭. admin 이면 이메일 `a***`·생년월일 연도만; super 면 원본. 탭4에 피드백/후기/예약/알림 요약. 진입 후 `select action,target_user from admin_access_log order by created_at desc limit 1;` → `view_detail` 기록.

- [ ] **Step 4: Commit**
```bash
git add "src/app/admin/users/[id]/page.tsx"
git commit -m "feat(admin): 상세 360 재구성(요약헤더+6탭)+서버마스킹+열람감사(M3)"
```

---

## Task 5: 통합검증 + 리뷰 + PR

- [ ] **Step 1:** `npm test`(전부 ok) + `npm run typecheck`(0) + `npm run build`(성공).
- [ ] **Step 2:** 적대적 리뷰(spec §4-3 커버리지 + **PII: admin이 super 전용 필드(이메일/생년월일/영수증/가족상세) 못 봄, 서버에서 제거** + view_detail 감사 + 대화 원문 비노출).
- [ ] **Step 3:** 마이그레이션 없음 확인.
- [ ] **Step 4:** PR 생성(`gh auth switch --user ganji-saju` → `gh pr create` → `--user kionya` 복원).

---

## Self-Review (작성자)
- **스펙 커버리지(§4-3):** 요약헤더(Task1·4) ✓ / 6탭 재구성(Task3·4) ✓ / 누락 카테고리 연결(Task2·4: 가족·피드백·후기·예약·알림·동의) ✓ / 서버 마스킹(Task1·4) ✓ / view_detail 감사(Task4) ✓ / 대화 원문 비노출(extras에 text select 금지) ✓.
- **플레이스홀더:** 순수 로직(Task1)·탭(Task3)은 완전 코드. Task2는 "컬럼 마이그레이션 확인" 실행 지시(추정 금지) + 안전 폴백. Task4는 기존 page.tsx Card/Field 패턴 재사용 구조 지시.
- **타입 일관성:** `MemberHeader`/`HeaderInput`/`MemberExtras`/`DetailTab`/`AdminRole` 명칭·`buildMemberHeader(input,role,nowIso)`·`formatBirth`·`getMemberExtras(userId)` 일관.
- **DB 변경:** 없음(기존 테이블 + M1 admin_access_log 재사용).
- **비목표:** 운영 쓰기 액션(M4)·마케팅 동의 수집(C1)·대화 원문 열람·full 가족 상세 편집은 제외.
