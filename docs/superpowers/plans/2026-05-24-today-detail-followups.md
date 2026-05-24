# today-detail 결제 정합성 — 후속 작업 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** today-detail 중복 과금 환불 대상을 read-only로 산출하고, score-factor(사주풀이 550원) 결제 정합성이 today-detail과 같은 휘발성-키 버그를 갖는지 검증(필요 시 동일 패턴으로 수정)한다.

**Architecture:** Part A는 운영용 read-only SQL 감사(코드 변경 없음, Supabase SQL Editor 실행). Part B는 score-factor 읽기/쓰기 스코프 정합성을 코드로 검증한 뒤, 불일치가 있을 때만 #356과 동일하게 읽기 경로를 안정 readingKey 스코프로 통일.

**Tech Stack:** Supabase Postgres(SQL Editor), Next.js App Router API routes, TypeScript, 프로젝트 단위 테스트 러너(`npm test`, `node:assert`).

**선행 메모:** 본 계획 실행은 `superpowers:using-git-worktrees`로 **현재 main(#356 머지 포함, `ded6560` 이상) 기반** worktree에서 진행할 것. (이 계획 문서 worktree는 #356 직전 base일 수 있으니 실행 worktree는 새로 최신 main에서 만든다.)

---

## Part A — today-detail 중복 과금 감사 (환불 대상 산출, 운영)

### Task A1: 중복 결제 사용자 read-only 감사 SQL 작성·보관

**Files:**
- Create: `docs/ops/today-detail-duplicate-charge-audit.sql`

- [ ] **Step 1: 감사 SQL 파일 작성**

```sql
-- today-detail(오늘 자세히 보기) 중복 결제 사용자 + 환불 후보 금액 (read-only)
-- 실행: Supabase 대시보드 → SQL Editor
with dup as (
  select
    user_id,
    count(*)                       as paid_count,
    min(created_at)                as first_paid_at,
    max(created_at)                as last_paid_at,
    sum(coalesce(amount, 0))       as total_paid_krw
  from product_entitlements
  where product_id = 'today-detail'
  group by user_id
  having count(*) >= 2
)
select
  d.user_id,
  (select email from auth.users where id = d.user_id) as email,
  d.paid_count,
  d.paid_count - 1                       as duplicate_count,
  (d.paid_count - 1) * 550               as refund_candidate_krw,
  d.total_paid_krw,
  d.first_paid_at,
  d.last_paid_at
from dup d
order by d.paid_count desc, d.total_paid_krw desc;
```

- [ ] **Step 2: SQL Editor 실행(운영) → 결과 검토**

Expected: 중복 결제 사용자 목록. 본 세션 사용자(email `qwe@qwe.com`, user_id `ae93a898…`)가 paid_count 6 / duplicate_count 5 / refund_candidate_krw 2750 로 나와야 한다(정상이면 fix 후 신규 중복은 안 늘어남).

- [ ] **Step 3: 환불 실행 메모(코드 아님)**

`product_entitlements`/`credit_transactions` 행은 환불해도 자동 삭제되지 않는다(이용권 기록). 실제 환불은 **Toss 결제 대행**에서 각 결제의 `paymentKey`(credit_transactions metadata.paymentKey, 또는 product_entitlements.payment_key)로 **중복분만 부분환불**. 1건은 정상 이용분이므로 환불 제외.

- [ ] **Step 4: 커밋**

```bash
git add docs/ops/today-detail-duplicate-charge-audit.sql
git commit -m "docs(ops): today-detail 중복 결제 감사 SQL(환불 대상 산출)"
```

---

## Part B — score-factor(사주풀이 550원) 정합성 검증 + 조건부 수정

배경: 550원 saju 상품은 `today-detail`(이미 #356로 수정, /saju 경로도 같은 unlock 라우트 공유)과 `score-factor`(점수 per-factor 풀이) 두 가지. score-factor의 **쓰기**는 이미 안정 키 `score:${readingKey}:${factorId}`(`buildScoreFactorScopeKey`). 관건은 **읽기/게이트**가 같은 안정 키를 쓰는지(= today-detail unlock 라우트가 갈라졌던 것과 같은 불일치가 없는지)다.

### Task B1: score-factor 읽기/쓰기 스코프 정합성 조사

**Files (read-only):**
- `src/lib/payments/product-scope.ts` (쓰기 scope: `buildScoreFactorScopeKey`)
- `src/lib/saju/score-factor-access.ts` (읽기: `getSajuScoreFactorEntitlements`)
- `src/app/saju/[slug]/page.tsx` (게이트 사용처)
- `src/components/saju-score/lock-gate.tsx` (결제 진입)
- `src/app/api/**` (별도 score-factor unlock 라우트 존재 여부)

- [ ] **Step 1: 쓰기·읽기가 모두 readingKey 스코프인지 확인**

Run: `git grep -n "buildScoreFactorScopeKey\|getSajuScoreFactorEntitlements\|score:" -- 'src/**/*.ts' 'src/**/*.tsx'`
Expected: 쓰기(product-scope `resolvePaymentProductScope`)와 읽기(score-factor-access)가 **둘 다 `buildScoreFactorScopeKey(readingKey, factorId)`**. today-detail처럼 휘발성 `sourceSessionId`로 읽는 별도 경로가 **없어야** 정상.

- [ ] **Step 2: score-factor 전용 unlock/open API가 다른 키로 읽는지 확인**

Run: `git grep -n "score-factor\|score:" -- 'src/app/api/**/*.ts'`
Expected: score-factor 콘텐츠 해제가 saju 페이지의 `getSajuScoreFactorEntitlements`(readingKey) 게이트로만 처리되고, today-fortune unlock 라우트 같은 "다른 키로 읽는 별도 deduct/open 라우트"가 없음. 있으면 그 라우트의 스코프가 readingKey인지 확인.

- [ ] **Step 3: 판정 기록**

- 읽기 == 쓰기(둘 다 readingKey) → **정합성 OK, 코드 수정 불필요.** Task B2 skip. (`docs/superpowers/plans/`에 "score-factor 검증 완료: 읽기·쓰기 모두 readingKey, 불일치 없음" 한 줄 기록 후 종료.)
- 불일치(읽기가 휘발성 키/다른 스코프) 발견 → Task B2 진행.

### Task B2 (조건부 — B1에서 불일치 발견 시에만): score-factor 읽기 경로 통일

today-detail #356과 동일 패턴 적용:

**Files:**
- Modify: 불일치가 발견된 읽기 경로(예: 별도 unlock 라우트) — 해당 파일의 entitlement 조회를 `buildScoreFactorScopeKey(readingKey, factorId)` 기반(또는 `getSajuScoreFactorEntitlements`)으로 통일.
- Test: `src/lib/saju/score-factor-access.test.ts` (없으면 생성)

- [ ] **Step 1: 실패 테스트 작성** — readingKey 기반 scope로 결제분을 인식하는지(휘발성 식별자로 묻지 않는지) 단언. (`today-detail-access.test.ts`의 `todayDetailEntitlementScopeKeys` 테스트를 본떠 score-factor scope 우선순위/안정성 검증.)
- [ ] **Step 2: 테스트 실패 확인** — Run: `npm test 2>&1 | grep score-factor`
- [ ] **Step 3: 읽기 경로를 안정 readingKey 스코프로 통일** (today-detail unlock 통일과 동형).
- [ ] **Step 4: 테스트·타입체크 통과 확인** — Run: `npm test` / `npm run typecheck` (exit 0, fail 0).
- [ ] **Step 5: 커밋** — `git commit -m "fix(payment): score-factor 읽기 경로를 readingKey 스코프로 통일"`

### Task B3: 광범위 readingKey 드리프트 리스크 백로그 기록

`readingKey = toSlug(input)`는 이름 해시(`buildBirthSlugHashPayload`에 name 포함)를 가져, 이름 상태가 다른 reading 간 키가 달라질 수 있다(today-detail은 "같은날 fallback"으로 흡수하지만 score-factor 등 비-일자 상품은 fallback이 없다).

- [ ] **Step 1:** 별도 백로그/이슈로 기록 — "readingKey를 이름 비의존(생년월일·성별·시·위치만) 식별자로 안정화" 과제. 본 계획 범위 밖(전 상품 영향 → 별도 설계 필요).

---

## 자체 검토 체크

- **스펙 커버리지:** 설계 스펙 §9(환불 감사) → Part A. §10 비고(saju-detail 동일 패턴) → Part B. ✅
- **placeholder:** Part B2는 B1 조사 결과에 따른 조건부(투기적 placeholder 아님 — 게이트가 명확). SQL은 완성형. ✅
- **타입/이름 일관성:** `buildScoreFactorScopeKey`, `getSajuScoreFactorEntitlements`, `product_entitlements.product_id='today-detail'`, `amount/created_at/payment_key` 컬럼 — 모두 현재 main 코드/스키마와 일치. ✅

---

## 실행 결과 (2026-05-24, Inline)

- **Part A:** 감사 SQL 확정. 코드 변경 없음 — 운영에서 SQL Editor 실행 + Toss `paymentKey` 기준 중복분 부분환불(사용자 전달 완료).
- **Part B (검증 완료, 수정 불필요):**
  - 쓰기: `resolvePaymentProductScope` → `score:${readingKey}:${factorId}` (readingKey 안정).
  - 읽기: `getSajuScoreFactorEntitlements`(`src/lib/saju/score-factor-access.ts`) → `toSlug(reading.input)` = readingKey → `buildScoreFactorScopeKey(readingKey, f)`. **쓰기와 동일 스코프.**
  - 읽기 경로 단일: `src/app/saju/[slug]/page.tsx`만 사용. `src/app/api/**`에 별도 score-factor unlock/deduct 라우트 **없음** → today-detail unlock 라우트가 갈라졌던 것과 같은 휘발성-키 불일치 **없음**.
  - **결론: score-factor 정합성 OK. Task B2 skip.** (saju 경로는 slug 고정이라 today-fortune 같은 reading 재생성 이슈도 적음.)
- **Part B3(백로그):** `readingKey=toSlug(input)`의 이름-해시 의존은 전 readingKey-스코프 상품 공통 잠재 리스크 → 이름 비의존 식별자 안정화는 별도 설계 과제로 보류.
