# Sitewide Regression Recovery Audit

작성일: 2026-05-12  
브랜치: `release/sitewide-redesign`  
목적: 디자인 리팩터 이후 발생한 기능 회귀, 반응형 붕괴, 미적용 페이지를 수정 전에 전수조사하고 복구 우선순위를 정리한다.

## 1. Executive Summary

현재 상태는 배포 전 복구가 필요한 `No-Go`다. 가장 큰 원인은 새 디자인 시스템을 입히는 과정에서 전역 subpage 폭 제한이 모든 `.gangi-subpage`에 강하게 적용되었고, 일부 핵심 페이지는 새 `AppShell` 안에 기존 `Gangi*`/`SectionSurface`/`FeatureCard` 구조가 섞인 채 남아 있어 화면 일관성이 깨진 것이다.

확인된 P0는 두 가지다. 첫째, `/saju/personality/result` 결제 연동은 `scopeKey`와 저장 리포트 존재 여부에 강하게 의존한다. 세션 payload가 없거나 무료 결과 저장이 실패한 상태에서 결제 성공 후 `scope`만 가지고 돌아오면 저장 리포트 조회가 404가 될 수 있다. 둘째, `/today-fortune?concern=general` 입력 화면은 제출 전 필수 birth 입력 검증이 약하고, API 400을 범용 오류 문구로 보여줄 수 있다.

P1은 PC에서도 `/saju/personality`가 모바일 폭으로 보이는 반응형 회귀다. `src/app/styles/flow-polish.css`와 `src/app/styles/subpages.css`의 `30rem !important` 제한이 `MoonlightAppPage size="md"`보다 우선한다.

P2는 디자인 미적용/혼합이다. `/today-fortune` 계열과 `/compatibility` 허브는 새 `AppShell`에 들어왔지만 내부는 기존 `GangiPageHeader`, `PageHero`, `SectionSurface`, `ProductGrid`, `FeatureCard` 중심으로 남아 있다.

## 2. Broken Routes

| Route | 증상 | 심각도 | 근거 파일 |
|---|---|---:|---|
| `/saju/personality` | PC에서도 모바일 폭으로 고정 | P1 | `src/features/saju-personality/saju-personality-input-client.tsx`, `src/app/styles/flow-polish.css`, `src/app/styles/subpages.css` |
| `/saju/personality/result` | 990원 깊이보기 결제/재진입이 `scopeKey`, 저장 리포트 상태에 의존 | P0 | `src/features/saju-personality/saju-personality-result-handoff-client.tsx`, `src/app/api/saju/personality/reports/route.ts`, `src/app/membership/checkout/page.tsx` |
| `/today-fortune?concern=general` | 무료 결과 생성 오류 문구 노출 가능 | P0 | `src/features/today-fortune/today-fortune-experience.tsx`, `src/app/api/today-fortune/route.ts` |
| `/today-fortune` 계열 | 새/기존 디자인 혼합 | P2 | `src/features/today-fortune/*` |
| `/compatibility` | 기존 카드형 허브 구조가 남아 새 디자인과 불일치 | P2 | `src/app/compatibility/page.tsx` |

## 3. Functional Regression Findings

### `/today-fortune` 무료 결과 생성

- `src/features/today-fortune/today-fortune-experience.tsx`는 `handleSubmit`에서 바로 `/api/today-fortune`에 POST한다.
- 같은 파일은 `!response.ok || !data?.ok || !data.result`이면 `data?.error ?? '무료 결과를 만드는 중 오류가 있었습니다.'`를 표시한다.
- `src/app/api/today-fortune/route.ts`는 `resolveUnifiedBirthInput(payload, { requireGender: false })` 검증이 실패하면 400과 `parsed.error`를 반환한다.
- 즉, birth 필수값 누락, 자동 프로필 로드 실패, payload shape 불일치가 모두 화면에서는 오류로 보일 수 있다.
- 복구 방향은 API 로직 변경이 아니라 클라이언트 제출 전 필수값 검증과 오류 문구 분기 정리다.

### `/saju/personality/result` 재진입

- result 화면은 `sessionStorage`의 `moonlight:saju-personality-input:v1` payload 또는 query의 `reportId`/`scope`를 사용한다.
- 입력 직후에는 payload로 즉시 결과를 빌드하고, 로그인 사용자는 `/api/saju/personality/reports`에 저장을 시도한다.
- 결제 성공 후에는 `/saju/personality/result?paid=saju_personality_mini&scope=...`로 돌아온다.
- 이때 세션 payload가 없고 `scope`만 있으면 `/api/saju/personality/reports?scope=...`로 저장 리포트를 조회한다.
- 저장 리포트가 없거나 비로그인 상태라면 API가 401/404를 반환하고 결과/유료 해제가 이어지지 않을 수 있다.

## 4. Payment / Entitlement Findings

| 항목 | 현재 구조 | 리스크 |
|---|---|---|
| Product code | `saju_personality_mini` | checkout URL에는 product로 전달됨 |
| Package id | `taste_saju_personality_mini` | prepare API에는 packageId로 전달됨 |
| Scope | `saju-personality:{hash}` | 없으면 checkout에서 “먼저 성향사주 결과가 필요합니다” 상태 |
| Checkout 진입 | `/membership/checkout?product=saju_personality_mini&scope=...&from=saju-personality-result` | result의 `scopeKey`가 없으면 `/saju/personality`로 대체됨 |
| Success redirect | `/saju/personality/result?paid=saju_personality_mini&scope=...` | scope만으로 저장 리포트 조회가 필요 |
| Entitlement check | `/api/saju/personality/entitlement?scope=...` | 로그인/권한/저장 상태에 따라 locked/error |
| Report storage | `saju_personality_reports`, `onConflict: user_id,scope_key` | 무료 저장 실패 후 결제 성공 시 재조회 실패 가능 |

의심 파일:

- `src/features/saju-personality/saju-personality-result-handoff-client.tsx`
- `src/app/api/saju/personality/reports/route.ts`
- `src/app/api/saju/personality/entitlement/route.ts`
- `src/app/membership/checkout/page.tsx`
- `src/components/membership/toss-membership-checkout.tsx`
- `src/app/membership/success/page.tsx`
- `src/lib/payments/saju-personality.ts`
- `src/lib/payments/product-scope.ts`
- `src/lib/payments/catalog.ts`

## 5. Responsive Layout Findings

PC 폭 고정의 직접 원인 후보는 전역 CSS다.

- `src/app/styles/flow-polish.css`
  - `.gangi-subpage-shell .app-page.gangi-subpage { width: min(calc(100vw - 1.25rem), 30rem) !important; }`
  - `@media (min-width: 768px)`에서도 `30rem !important` 유지
- `src/app/styles/subpages.css`
  - `.app-page.gangi-subpage`가 `30rem !important`
  - `.app-page.gangi-subpage.saju-result-page`가 `28.5rem !important`
  - `.gangi-subpage-shell { --gangi-subpage-max: 30rem; }`
  - `@media (min-width: 768px)`에서도 `var(--gangi-subpage-max)`가 30rem
- `src/features/saju-personality/saju-personality-input-client.tsx`
  - `MoonlightAppPage className="gangi-subpage space-y-5" size="md"`를 사용하지만 전역 `!important`에 눌린다.

결론: `/saju/personality` 개별 컴포넌트가 아니라 `.gangi-subpage-shell`/`.gangi-subpage`의 전역 폭 정책을 route/page type별로 분리해야 한다.

## 6. Design Migration Coverage

| 영역 | 상태 | 메모 |
|---|---|---|
| Home | 적용됨 | `src/features/home/gangi-home-client.tsx` 중심 |
| 기본 사주 입력 | 적용됨/폭 제한 영향 가능 | `src/features/saju-intake/saju-intake-page.tsx` |
| 성향사주 입력/결과 | 적용됨/폭 제한 및 결제 재진입 리스크 | `src/features/saju-personality/*` |
| 기본 궁합 입력 | 일부 적용 | `src/features/compatibility/compatibility-input-client.tsx` |
| 기본 궁합 허브 `/compatibility` | 미흡 | 기존 `SectionSurface`, `ProductGrid`, `FeatureCard` 중심 |
| 성향궁합 입력/결과 | 적용됨/폭 제한 영향 가능 | `src/features/compatibility/personality-*` |
| 오늘운세 입력/결과/상세 | 혼합 | `GangiPageHeader` + `PageIntro` + 기존 today components |
| 대화방 | 적용됨 | 12간지 구조 유지, 4명 선생님 표현 검색 결과 없음 |
| 보관함/가격 | 적용됨 | `ReportList`, pricing row 계열 |

## 7. Suspected Root Causes

1. `flow-polish.css`가 “conversion/result subpages”용이라고 되어 있지만 모든 `.gangi-subpage-shell .app-page.gangi-subpage`에 30rem 폭을 강제한다.
2. `subpages.css`에도 같은 30rem 제한이 중복되어 있어 컴포넌트의 `max-w-5xl`/`max-w-6xl` 설정이 무력화된다.
3. `/today-fortune`은 새 `AppShell`에 감싸졌지만 내부 입력/결과 구조는 기존 컴포넌트가 많이 남아 디자인 혼합이 발생한다.
4. `/compatibility` 허브는 리팩터 적용 범위에서 빠져 카드형 기존 IA가 그대로 남아 있다.
5. 성향사주 결제 플로우는 `scope` 기반 권한과 `report` 저장이 모두 성공해야 매끄럽게 이어지는데, 실패 시 복구 경로가 약하다.
6. today-fortune 입력은 API 에러를 그대로 사용자 오류로 보여주며, 제출 전 필수값 검증 UX가 부족하다.

## 8. P0 Fix List

1. `/saju/personality/result` 결제 재진입 복구
   - `scope`만 있는 결제 성공 return에서도 저장 리포트가 없을 때 세션 payload 또는 안전한 복구 CTA를 제공한다.
   - 무료 결과 저장 실패 상태에서 결제 CTA를 누를 때 사용자에게 저장/로그인 필요 상태를 명확히 표시한다.
   - `prepare` 성공 후 checkout 진입, success redirect, entitlement 확인, paid report 저장까지 한 번의 smoke path로 검증한다.

2. `/today-fortune?concern=general` 무료 결과 생성 오류 복구
   - 제출 전에 생년월일 필수값을 검증한다.
   - API 400의 `parsed.error`를 입력 필드 근처에 보여주고, 범용 오류 문구는 네트워크/서버 실패에만 사용한다.
   - 자동 프로필 로드 실패와 빈 입력을 구분한다.

## 9. P1 Fix List

1. PC 폭 고정 복구
   - `flow-polish.css`의 30rem 전역 제한을 제거하거나 `.is-mobile-flow` 같은 명시적 class로 좁힌다.
   - `subpages.css`의 `.app-page.gangi-subpage` 전역 `!important` 폭 제한을 페이지군별 token으로 분리한다.
   - `/saju/personality`, `/compatibility/personality`, `/saju/new`, `/compatibility/input`의 desktop width를 46rem~64rem 범위로 회복한다.

2. Sticky CTA와 mobile dock 간 간격 재검수
   - `pb-24`, `pb-28`, `app-mobile-dock-clearance`, `env(safe-area-inset-bottom)` 중복 여부를 확인한다.

## 10. P2 Fix List

1. `/compatibility` 허브를 달빛 결 구조로 맞춘다.
   - 기존 `PageHero`, `SectionSurface`, `ProductGrid`, `FeatureCard`를 `PageIntro`, `FlowEntryList`, `ChoiceRow` 중심으로 줄인다.

2. `/today-fortune` 계열을 단계적으로 정리한다.
   - `GangiPageHeader`와 새 `PageIntro` 혼합을 줄인다.
   - 입력/결과/상세 화면에 공통 `AppPage` 또는 명시적 page width policy를 적용한다.

3. 이전 style debt map 기준으로 임의 radius/shadow class를 줄인다.

## 11. Files To Modify

복구 작업에서 수정 가능성이 높은 파일:

- `src/app/styles/flow-polish.css`
- `src/app/styles/subpages.css`
- `src/features/saju-personality/saju-personality-input-client.tsx`
- `src/features/saju-personality/saju-personality-result-handoff-client.tsx`
- `src/app/api/saju/personality/reports/route.ts`
- `src/features/today-fortune/today-fortune-experience.tsx`
- `src/components/today-fortune/birth-info-stepper.tsx`
- `src/app/compatibility/page.tsx`
- `src/features/today-fortune/today-fortune-result-client.tsx`
- `src/features/today-fortune/today-fortune-detail-client.tsx`

## 12. Files Not To Modify

이번 recovery에서 직접 수정하면 안 되는 영역:

- `supabase/migrations/**`
- `src/domain/saju/engine/**`
- `src/domain/personality/**`
- `src/domain/saju-personality/**`
- `src/domain/compatibility-personality/**`
- `src/app/api/payments/confirm/route.ts`
- `src/lib/payments/catalog.ts`
- `src/lib/payments/product-scope.ts`
- `src/lib/payments/saju-personality.ts`
- `src/lib/product-entitlements.ts`
- `src/lib/credits/**`
- 12간지 persona를 4명 선생님 구조로 되돌리는 모든 변경

단, 결제 연결 복구가 필요할 경우에도 payment core를 바꾸기보다 result/checkout handoff와 오류 복구 UX를 먼저 수정한다.

## 13. Go / No-Go Status

현재는 `No-Go`.

Go 전환 조건:

- `/saju/personality` desktop 폭이 모바일 고정에서 벗어난다.
- `/saju/personality/result`에서 990원 CTA → checkout → success → paid result 재진입 경로가 확인된다.
- `/today-fortune?concern=general` 빈 입력/불완전 입력에서 범용 오류 대신 명확한 입력 안내가 표시된다.
- `/compatibility`와 `/today-fortune` 계열의 디자인 혼합이 최소화된다.
- 12간지 대화방 구조가 유지된다.
- lint/typecheck/build가 통과한다.
