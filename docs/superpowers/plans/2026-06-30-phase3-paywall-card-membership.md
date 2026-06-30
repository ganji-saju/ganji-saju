# Phase 3 — 비회원 페이월 카드/멤버십 전환 + 코인 카피 정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 코인 은퇴 후 남은 페이월을 "멤버십 우선 + 카드 단건 1차 + 코인은 잔액 보유자에게만"으로 재배치하고, 사이트 전역의 stale 코인충전 카피·오링크를 정리한다.

**Architecture:** 신규 결제상품은 만들지 않는다(상세풀이=`taste_today_detail`, 달력=`monthly-calendar` 카드 단건이 이미 존재·배선됨). 새 서버 헬퍼 `userHasLegacyCoins(balance>0)`로 코인 옵션 노출을 잔액 보유자에 한정한다. 멤버 자동 무료는 서버 게이트(이미 구현: detail=unlockTodayFortunePremium, calendar=calendar-access, compat=tryConsumeMemberCompatAccess, dialogue=member daily)에 이미 있으므로 **UI에 멤버십 CTA/안내만 추가**한다.

**Tech Stack:** Next.js 16 · TypeScript · Supabase · Vitest(`npm run test:spec`) + node test(`npm test`) + Playwright(`npm run e2e`).

## Global Constraints

- **신규 결제상품·DB 마이그레이션 0** (today-detail/monthly-calendar 재사용; product_entitlements 그대로). 진짜 새 productId 금지.
- **결제 가능 경로 공백 금지**: 각 페이월은 멤버십 CTA 추가·카드 1차 승격을 **먼저** 반영한 뒤 코인 옵션을 잔액게이트로 감춘다(역순 금지 — 잔액 0 사용자 dead-end).
- **코인 차감 경로(레거시)는 잔액 보유자 소진용으로 유지**(제거 아님). 코인 옵션은 `userHasLegacyCoins`(balance>0, subscription_balance 제외)일 때만 노출.
- **금지문구 가드 준수**: 교체 카피는 확정문구('멤버십 보기'·'9,900원으로 열기'·'멤버십으로 계속')만. `준비 중`·`Coming soon`·`로딩중`·영문 `mock/dummy/placeholder/TODO/FIXME` 금지. `출시 예정`은 허용. `credits/page.tsx`의 `// audit-mockup: intentional` 마커 유지. 가드: `e2e/incomplete-ui.spec.ts`(렌더, 스코프에 /pricing·/credits 포함) + `src/lib/public-commercialization-copy.test.ts`(소스, credits·appointment·membership·moonlight·bundled-policies 포함).
- 테스트는 `src/**/*.spec.ts` co-located. 커밋 Korean + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. PR은 `ganji-saju` 계정.

## 확정 가정 (사용자 검토 시 override 가능)

1. **상세풀이 9,900원 = per-day**(현행 유지). 그날(KST)만 열람. per-reading 영구 변경은 access 로직 교체라 범위 밖.
2. **'비회원' = 로그인된 비구독자.** 카드 경로로 즉시 충족(추가 작업 0). 게스트(미로그인) 결제는 범위 밖(401·userId 바인딩 구조).
3. **today-detail/calendar/compat/dialogue는 멤버 자동무료**(서버 게이트 기구현). **score-total·lifetime은 멤버십 혜택 아님** → 카드 단건 유지(멤버십 CTA는 "구독으로 다른 혜택" 안내 수준, 자동언락 추가 안 함).
4. **코인 잔액게이트 기준 = `balance > 0`**(순수 결제코인; subscription_balance 제외해 멤버에게 코인옵션 미노출).
5. 코인 차감 fallback 유지(잔액 소진까지), 잔액게이트로만 숨김.

---

## File Structure

**신규**
- `src/lib/credits/legacy-coins.ts` — `userHasLegacyCoins(userId): Promise<boolean>` (`getCredits().balance > 0`). + spec.
- (선택) `src/app/api/credits/balance/route.ts` 또는 entitlement 응답 확장 — 순수 client 페이월에 잔액 전달.

**수정(웨이브별 ↓)**

---

# Wave 0 — 잔액 게이트 인프라

### Task 1: `userHasLegacyCoins` 서버 헬퍼
**Files:** Create `src/lib/credits/legacy-coins.ts` + `src/lib/credits/legacy-coins.spec.ts`. Consumes `getCredits` (`src/lib/credits/deduct.ts:73`).

**Interfaces:** Produces `userHasLegacyCoins(userId: string): Promise<boolean>` — true iff `(getCredits(userId))?.balance ?? 0) > 0`. (balance = 비만료 결제코인 lot 합; subscription_balance 제외.)

- [ ] **Step 1: 실패 테스트** — mock `getCredits`: balance>0 → true; balance 0 → false; null → false; balance 0 but subscription_balance>0 → **false**(멤버 제외 검증).
- [ ] **Step 2:** `npm run test:spec -- legacy-coins` → FAIL.
- [ ] **Step 3: 구현**
```typescript
// 2026-06-30 — 코인 sunset 후: 레거시 결제코인 잔액 보유자에게만 코인옵션을 노출하기 위한 판정.
//   balance(비만료 결제 lot 합)만 본다 — subscription_balance(멤버 적립)는 제외(멤버에게 코인옵션 미노출).
import { getCredits } from '@/lib/credits/deduct';
export async function userHasLegacyCoins(userId: string): Promise<boolean> {
  if (!userId) return false;
  const c = await getCredits(userId);
  return (c?.balance ?? 0) > 0;
}
```
- [ ] **Step 4:** test PASS · `npm run typecheck` 0 errors.
- [ ] **Step 5:** commit `feat(credits): userHasLegacyCoins 잔액 게이트 헬퍼`.

### Task 2: 클라 페이월에 코인 잔액 전달
**Files:** Modify `src/app/api/payments/entitlement/route.ts` (응답에 `coinBalance: number` 추가), `src/lib/payments/use-product-entitlement.ts` (hook이 coinBalance 노출). SSR 페이월(saju/[slug], today-fortune, premium 페이지)은 서버에서 `userHasLegacyCoins` 계산해 prop 주입.

**Interfaces:** Consumes T1. Produces: client 페이월이 `hasLegacyCoins`(또는 coinBalance>0)를 알 수 있음.

- [ ] **Step 1:** entitlement route 응답에 `coinBalance`(또는 `hasLegacyCoins`) 필드 추가(서버에서 `userHasLegacyCoins`/`getCredits`로 계산). 로그인 안 됐으면 false/0.
- [ ] **Step 2:** `use-product-entitlement.ts` 반환 타입에 해당 필드 추가.
- [ ] **Step 3:** typecheck/build green. (단위테스트는 라우트 응답형 변경 — 기존 테스트 있으면 갱신.)
- [ ] **Step 4:** commit `feat(payments): entitlement 응답에 코인 잔액 노출(페이월 게이트용)`.

> Wave 0 게이트: T1 헬퍼 + T2 전달 인프라 준비. 이후 T3~T7이 이를 소비.

---

# Wave 1 — 코인 포함 페이월 멤버십 우선화 (직렬, 매출 동선)

> 각 태스크: ①멤버십 CTA/안내 추가 ②카드 단건 1차 승격 ③코인 옵션·충전링크를 `hasLegacyCoins`로 잔액자 한정. 멤버 무료는 서버에 이미 있으니 UI만.

### Task 3: 오늘 자세히보기 PremiumLockCard
**Files:** `src/components/today-fortune/premium-lock-card.tsx` (호출 today-fortune-result-client.tsx:253, today-fortune-experience.tsx:329). Consumes T2(`hasLegacyCoins` prop).
- [ ] 멤버십 CTA(최상단, →`/membership`) 신설(현재 0개). 멤버는 자동 무료(unlockTodayFortunePremium 게이트 기구현)이므로 멤버에겐 "멤버십에 포함" 안내.
- [ ] 9,900원 카드 단품(→`/membership/checkout?product=today-detail&slug=...`)을 1차 CTA로. 19,800 묶음 유지.
- [ ] 코인 메인버튼(`{coinCost}코인 열기`, line ~120)·옵션설명 '10코인' 항목(line 173)·`코인 충전 보기`(line 159-167/199-207, →/credits)를 `hasLegacyCoins`일 때만 렌더. 비잔액자엔 코인 흔적 제거.
- [ ] 렌더 검증(Playwright): 비회원·잔액0 = 멤버십+카드만; 잔액>0 = 코인옵션 추가. typecheck/build green. commit.

### Task 4: 운세 달력 FortuneCalendarPanel
**Files:** `src/components/ai/fortune-calendar-panel.tsx` (embed saju/[slug]/premium/page.tsx). Consumes T2.
- [ ] 멤버십 안내/CTA 추가(서버 calendar-access 멤버무료 기구현). 9,900원 카드(→checkout monthly-calendar) 1차.
- [ ] `2코인으로 열기`(line ~995)·hero `월 단위 2코인` 배지(line 647)·`코인팩 보기`(line 1005-1010)를 `hasLegacyCoins` 한정.
- [ ] 402 insufficient 시 `window.location→/credits`(line 583)를 `/membership/checkout?product=monthly-calendar&slug=...`(또는 인라인 멤버십 안내)로 교체.
- [ ] 렌더 검증·typecheck·build. commit.

### Task 5: 대화상담 DialogueChatPanel + /api/ai
**Files:** `src/components/dialogue/dialogue-chat-panel.tsx`, `src/app/api/ai/route.ts`(402: 807-816, 938-944).
- [ ] route.ts: insufficient_credits 응답에 `needsMembership` 플래그 추가(잔액 0 && 비멤버 시 true). billing.remaining로 잔액 판단.
- [ ] 패널: 가격문구 '처음 3회 무료 · 이후 3회 3코인' → '멤버십 매일 무료 · 비회원 3회 무료 후 멤버십'. insufficient 분기에서 `needsMembership`(또는 remaining 0)이면 `코인 충전 바로가기`(/credits, line 725-730) 대신 멤버십 CTA(→/membership). 잔액>0일 때만 코인 안내.
- [ ] 검증·typecheck·build. commit.

> Wave 1 게이트: 코인 포함 3개 페이월이 멤버십·카드 1차 + 코인 잔액자 한정. 비회원 결제 동선 무공백.

---

# Wave 2 — 멤버십 CTA 추가(코인 없는 페이월) + 코인 fallback 정책

### Task 6: 궁합 CompatibilityResultView 멤버십 CTA
**Files:** `src/features/compatibility/compatibility-result-view.tsx`. 코인옵션 없음 → 게이트 불필요.
- [ ] 카드 결제(9,900) 위에 멤버십 CTA/안내 추가(멤버 월무료 tryConsumeMemberCompatAccess 기구현). commit.

### Task 7: 사주 점수 ScoreLockGate (저우선·선택)
**Files:** `src/components/saju-score/score-lock-gate.tsx`, `src/app/saju/[slug]/page.tsx:572`.
- [ ] price prop 정합성 정정(코드 9,900 기준). 멤버십 CTA는 "구독 혜택 보기" 수준만(가정 3: 점수는 멤버 자동언락 아님 — 자동언락/코인옵션 추가는 별도 결정 전까지 안 함).
- [ ] commit. (정책 미확정이면 skip 가능.)

### Task 8: saju premium / LifetimeDeepCta 멤버십 CTA 일관화 (저우선)
**Files:** `src/components/saju/lifetime-deep-cta.tsx`, `today-detail-result-cta.tsx`, `src/app/saju/[slug]/premium/page.tsx`.
- [ ] 멤버십 CTA를 전 분기 일관 노출(현재 일부만). 카드 단건(lifetime 49,000/year-core 9,900) 유지. commit.

### Task 9: today-detail 코인 fallback 정책 반영
**Files:** `src/lib/credits/detail-report-access.ts:351-391`, `src/app/api/today-fortune/unlock/route.ts:255-257`. Depends T3.
- [ ] 가정 5대로: 멤버십 게이트 유지 + 코인 차감 fallback **유지**(잔액자 소진). 추가 코드 없이 현행 유지가 맞으면 "검토 완료, 변경 없음"으로 문서화. (즉시 제거 결정 시에만 코드 변경.)

---

# Wave 3 — Stale 카피/오링크 정리 (저위험, Day1 병렬 가능)

### Task 10: 충전 dead-end CTA → 멤버십/카드 (+ 오링크 버그 수정)
**Files:** site-header.tsx:360-364(코인충전→코인잔액 라벨/유지 or 멤버십), today-fortune-detail-client.tsx:291-294, premium-lock-card.tsx:159-167/199-207(T3와 중복 시 통합), dialogue-chat-panel.tsx:725-730(T5와 통합), fortune-calendar-panel.tsx:1005-1010/583(T4와 통합), membership-section.tsx:41-47, my/billing/page.tsx:380-389(라벨 '코인 잔액'), **subscription-manager.tsx:47-51/80-84(멤버십 버튼이 /credits로 가는 오링크 → /membership 버그수정)**, home/content.ts:159(dock '코인'→'멤버십'), credits/success/page.tsx:107-111.
- [ ] 각 충전 의도 링크를 멤버십/카드로. /credits 잔액조회 링크는 라벨만 '코인 잔액'으로 격하 유지 가능. subscription-manager 오링크는 명백한 버그 수정. 금지문구 가드 준수. commit.

### Task 11: 상담예약 가공 코인경제 제거
**Files:** `src/app/dialogue/appointment/page.tsx`(35-42,70-77,147,186-192,350-409,629), `bundled-policies.ts:187` 정합.
- [ ] `/api/appointments`는 실제 무차감 → 100코인·단가환산·보유/부족/추천충전팩·환불 코인복구 표시 제거, '상담 요청은 무료 접수 · 일정 확정 후 안내'로. dead code(상수·user_credits fetch) 제거. 정책문서 정합. commit.

### Task 12: /pricing 코인팩 섹션 제거
**Files:** `src/app/pricing/page.tsx`(168-188 GangiSection, 38 CREDIT_PACKAGES, 17-20 import, 32 meta).
- [ ] 코인팩 섹션 통째 삭제 + 미사용 import/메타 '코인팩' 정리. placeholder/'준비 중' 삽입 금지(/pricing은 e2e 가드 스코프). commit.

### Task 13: stale 주석/토스트/업셀 카피 정정
**Files:** `today-fortune/unlock/route-helpers.ts:51`('550원'·'1코인'), `today-fortune-detail-client.tsx:54`('10코인 열었습니다'→일반화), `src/lib/today-fortune/concerns.ts:82`('1코인으로 열기'→'9,900원으로 열기' 또는 멤버십).
- [ ] 실제 가격(9,900/10코인)과 불일치분 정정. commit.

### Task 14: 금지문구 가드 검증
- [ ] `npm run test -- public-commercialization-copy`(또는 해당), `npm run e2e -- incomplete-ui` 통과 확인. 교체 카피가 확정문구인지, credits audit-mockup 마커 유지 확인.

### Task 15: 문서화
**Files:** `docs/claude-specs/` 또는 PROGRESS.md.
- [ ] taste_today_detail('today-detail' 카드) ↔ today_fortune_premium(코인/멤버십 credit_transactions kind)이 동일 콘텐츠 두 결제경로, 수렴=resolveTodayFortuneUnlockAccess 명문화. monthly-calendar 동일 패턴. commit.

---

## Sequencing
- **Wave 0(T1→T2)** 먼저(무위험 인프라, Wave 1 선행).
- **Wave 1(T3→T4→T5 직렬)** — 매출 동선, 각 surface 멤버십·카드 먼저→코인 잔액게이트. **역순 금지.**
- **Wave 2(T6/T8 병렬 저위험; T7 정책 후; T9 T3 이후)**.
- **Wave 3(T10~T15)** Day1부터 완전 병렬, 단 T14를 카피 PR 머지 게이트로. T13은 의존성 0.

## Open Decisions (검토 시 확정 — 기본값은 위 "확정 가정")
1. 상세풀이 9,900 권리단위 per-day(기본) vs per-reading 영구.
2. '비회원' = 비구독 로그인(기본) vs 게스트 결제 지원(신규 설계).
3. score-total/today-detail 멤버 자동언락 포함 여부(기본: today-detail 포함=기구현, score-total 미포함).
4. 코인 fallback 즉시 제거 vs 잔액 소진까지 유지(기본: 유지).

## Migrations
**없음.** today-detail/monthly-calendar 재사용, product_entitlements 그대로. (신규 productId 신설 시에만 product_entitlements_product_id_check 확장 마이그레이션 1건 필요 — 본 계획은 재사용이라 불필요.)

## Self-Review
- Spec coverage: 페이월 6면(상세/달력/대화/궁합/점수/saju premium) + 잔액게이트 + 카피정리 + 가드 + 문서 — 워크플로 매핑 전 항목 매핑.
- Placeholder: 각 태스크 file:line + 변경내용 구체. 코드 헬퍼(T1)는 실제 코드.
- Type consistency: `userHasLegacyCoins`(T1)→T2 전달→T3/T4 prop 소비. `needsMembership`(T5).
- 가정 명시 + open decisions로 추측 최소화.
