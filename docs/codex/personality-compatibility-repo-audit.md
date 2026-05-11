# 달빛 성향궁합 리포지토리 조사

- 작업 번호: 작업 0
- 작성일: 2026-05-11
- 대상 브랜치: `feature/personality-compatibility`
- 조사 목적: 궁합 메뉴에 “달빛 성향궁합” MVP를 순차 구현하기 전, 라우팅/사주/궁합/결제/프로필 구조와 새 기능 부착 위치를 파악한다.
- 작업 범위: 코드 구현 없음. 조사 문서만 작성한다.
- 참고: 현재 브랜치에는 `src/app/compatibility/personality`, `src/domain/compatibility-personality`, `src/domain/personality` 등 성향궁합 관련 파일이 이미 존재한다. 이후 작업은 이 파일들을 새로 만들지, 재사용할지 먼저 결정해야 한다.

## 1. package.json 기준 기술 스택과 명령

### 기술 스택

- 런타임: Node.js `20.x`
- 프레임워크: Next.js `16.2.3`, App Router
- UI: React `19.2.4`, React DOM `19.2.4`, Tailwind CSS 4, shadcn, lucide-react
- DB/Auth: Supabase SSR, Supabase JS
- 결제: Toss Payments SDK, Toss payment-widget SDK
- AI: OpenAI SDK
- 사주/달력: `lunar-typescript`
- 관측: Vercel Analytics, Vercel Speed Insights
- 알림: `web-push`
- 언어/타입: TypeScript 5

### 주요 명령

| 명령 | 역할 |
| --- | --- |
| `npm run dev` | Next 개발 서버 실행 |
| `npm run build` | Next production build |
| `npm run lint` | `npm run verify:imports` 실행 |
| `npm run typecheck` | `tsc --noEmit --pretty false --incremental false -p tsconfig.json` |
| `npm test` | `node scripts/run-unit-tests.mjs` 실행 |
| `npm run start` | Next production server 실행 |
| `npm run preflight` | 배포 전 환경/설정 점검 |
| `npm run smoke` | smoke test |
| `npm run verify:imports` | import 경로 검증 |
| `npm run validate:kasi` | KASI 달력 검증 |
| `npm run validate:classics` | 고전 코퍼스 검증 |

## 2. 현재 라우팅 구조

라우팅은 `src/app` 아래의 App Router로 구성되어 있다. `src/pages` 폴더는 없다.

### 주요 화면 라우트

| 라우트 | 파일 | 역할 |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | 홈 |
| `/saju` | `src/app/saju/page.tsx` | 사주 진입 |
| `/saju/new` | `src/app/saju/new/page.tsx` | 사주 입력 |
| `/saju/[slug]` | `src/app/saju/[slug]/page.tsx` | 사주 결과 |
| `/saju/[slug]/premium` | `src/app/saju/[slug]/premium/page.tsx` | 프리미엄 사주 결과 |
| `/saju/[slug]/today-detail` | `src/app/saju/[slug]/today-detail/page.tsx` | 오늘운 상세 |
| `/compatibility` | `src/app/compatibility/page.tsx` | 궁합 메뉴 |
| `/compatibility/input` | `src/app/compatibility/input/page.tsx` | 기존 궁합 입력 |
| `/compatibility/result` | `src/app/compatibility/result/page.tsx` | 기존 궁합 결과 |
| `/compatibility/personality` | `src/app/compatibility/personality/page.tsx` | 성향궁합 입력 후보/현재 구현 |
| `/compatibility/personality/result` | `src/app/compatibility/personality/result/page.tsx` | 성향궁합 결과 후보/현재 구현 |
| `/membership` | `src/app/membership/page.tsx` | 멤버십/상품 |
| `/membership/checkout` | `src/app/membership/checkout/page.tsx` | 결제 진입 |
| `/membership/success` | `src/app/membership/success/page.tsx` | 결제 승인 후 처리 |
| `/my` | `src/app/my/page.tsx` | MY/보관함 진입 |
| `/my/profile` | `src/app/my/profile/page.tsx` | 사용자/가족 프로필 |
| `/my/billing` | `src/app/my/billing/page.tsx` | 결제 상태 |
| `/today-fortune` | `src/app/today-fortune/page.tsx` | 오늘운 |
| `/tarot` | `src/app/tarot/page.tsx` | 타로 |
| `/dialogue` | `src/app/dialogue/page.tsx` | AI 상담 |

### 주요 API 라우트

| 라우트 | 파일 | 역할 |
| --- | --- | --- |
| `/api/profile` | `src/app/api/profile/route.ts` | 내 프로필 조회/저장 |
| `/api/family-profiles` | `src/app/api/family-profiles/route.ts` | 가족/상대 프로필 CRUD |
| `/api/readings` | `src/app/api/readings/route.ts` | 사주 결과 생성/저장 |
| `/api/payments/prepare` | `src/app/api/payments/prepare/route.ts` | 결제 전 로그인/중복 구매/권한 확인 |
| `/api/payments/confirm` | `src/app/api/payments/confirm/route.ts` | Toss 승인 후 코인/권한/스냅샷 반영 |
| `/api/credits/use` | `src/app/api/credits/use/route.ts` | 코인 사용 |
| `/api/interpret` | `src/app/api/interpret/route.ts` | 사주 AI 해석 |
| `/api/interpret/yearly` | `src/app/api/interpret/yearly/route.ts` | 연간 해석 |
| `/api/interpret/lifetime` | `src/app/api/interpret/lifetime/route.ts` | 보관형/평생 해석 |
| `/api/compatibility/personality/entitlement` | `src/app/api/compatibility/personality/entitlement/route.ts` | 성향궁합 유료 권한 확인 후보/현재 구현 |
| `/api/compatibility/personality/reports` | `src/app/api/compatibility/personality/reports/route.ts` | 성향궁합 결과 저장/재조회 후보/현재 구현 |

## 3. 기존 사주/궁합 관련 코드

### 사주 입력과 계산

- 공통 생년월일시 입력 컴포넌트: `src/components/saju/shared/unified-birth-info-fields.tsx`
- 입력 정규화: `src/lib/saju/unified-birth-entry.ts`
- 입력 검증: `src/domain/saju/validators/birth-input.ts`
- 사주 타입: `src/lib/saju/types.ts`
- 사주 엔진: `src/domain/saju/engine/saju-data-v1.ts`
- 사주 저장/조회: `src/lib/saju/readings.ts`, `src/app/api/readings/route.ts`
- 사주 리포트 빌더: `src/domain/saju/report/*`
- KASI 검증: `src/domain/saju/validation/kasi-calendar.ts`

주의할 점:

- 새 성향궁합에서 사주 계산 자체를 새로 만들 필요는 없다.
- `BirthInput` 또는 기존 사주 계산 결과에서 필요한 facts만 뽑아 scoring/report에 넘기는 구조가 안전하다.
- 양력/음력, 태어난 시간 모름, 분, 출생지, 진태양시/야자시/조자시 처리는 `UnifiedBirthInfoFields`와 `resolveUnifiedBirthInput` 흐름을 재사용해야 한다.

### 기존 궁합 흐름

- 궁합 메뉴: `src/app/compatibility/page.tsx`
- 기존 궁합 입력: `src/app/compatibility/input/page.tsx`
- 기존 궁합 결과: `src/app/compatibility/result/page.tsx`
- 입력 클라이언트: `src/features/compatibility/compatibility-input-client.tsx`
- 수동 입력 저장: `src/features/compatibility/manual-compatibility-storage.ts`
- 수동 결과 클라이언트: `src/features/compatibility/manual-compatibility-result-client.tsx`
- 결과 뷰: `src/features/compatibility/compatibility-result-view.tsx`
- 궁합 계산/해석: `src/lib/compatibility.ts`, `src/lib/compatibility.test.ts`
- 관계 콘텐츠: `src/content/moonlight.ts`

현재 기존 궁합은 다음 방식으로 동작한다.

- `/compatibility/input?relationship=...`에서 관계 유형을 받는다.
- 로그인 사용자는 `/api/profile`에서 내 프로필과 가족 프로필을 불러와 빠른 채우기를 제공한다.
- 비로그인/수동 입력은 `UnifiedBirthInfoFields`를 이용해 두 사람 정보를 입력한다.
- 입력값은 `resolveUnifiedBirthInput`으로 `BirthInput`이 된다.
- 수동 입력은 `sessionStorage`의 `moonlight:compatibility-manual-v1`에 저장된다.
- 결과에서는 `buildCompatibilityInterpretation`이 기존 사주 엔진 결과를 바탕으로 관계 요약을 만든다.

### 성향궁합 관련 현재 파일

현재 브랜치 기준 이미 존재하는 성향궁합 관련 파일은 다음과 같다.

- 라우트: `src/app/compatibility/personality/page.tsx`
- 결과 라우트: `src/app/compatibility/personality/result/page.tsx`
- 입력 클라이언트: `src/features/compatibility/personality-compatibility-input-client.tsx`
- 입력 저장 타입: `src/features/compatibility/personality-compatibility-input-storage.ts`
- 결과 빌더: `src/features/compatibility/personality-compatibility-result-builder.ts`
- 결과 클라이언트: `src/features/compatibility/personality-compatibility-result-client.tsx`
- 점수/리포트 도메인: `src/domain/compatibility-personality/*`
- 성향 도메인: `src/domain/personality/*`
- 결제 config: `src/lib/payments/personality-compatibility.ts`
- 성향궁합 저장 API: `src/app/api/compatibility/personality/reports/route.ts`
- 성향궁합 권한 API: `src/app/api/compatibility/personality/entitlement/route.ts`
- DB migration: `supabase/migrations/021_personality_compatibility.sql`, `022_personality_compatibility_mini_entitlement.sql`, `023_personality_compatibility_report_scope.sql`

다음 작업에서 이 파일들이 의도된 이전 작업 산출물인지, 아니면 clean-start 기준으로 다시 정리해야 하는지 먼저 확인하는 편이 좋다.

## 4. 기존 결제/코인/멤버십 관련 코드

### 상품 카탈로그와 결제

- 상품 카탈로그: `src/lib/payments/catalog.ts`
- 상품 scope: `src/lib/payments/product-scope.ts`
- 결제 payload 검증: `src/lib/payments/confirmation.ts`
- Toss 승인: `src/lib/payments/toss.ts`
- 결제 진입 UI: `src/components/membership/toss-membership-checkout.tsx`
- 결제 페이지: `src/app/membership/checkout/page.tsx`
- 결제 성공 페이지: `src/app/membership/success/page.tsx`
- 결제 전 API: `src/app/api/payments/prepare/route.ts`
- 결제 승인 API: `src/app/api/payments/confirm/route.ts`

현재 상품 유형은 `credits`, `subscription`, `lifetime_report`, `taste_product`로 나뉜다. 소액 풀이 상품은 `TasteProductId`로 관리된다.

현재 브랜치 기준 `personality_compatibility_mini` 상품도 `taste_product`로 등록되어 있으며 `requiresScope: true`이다. clean-start 기준으로 추가한다면 이 패턴을 그대로 따르는 것이 맞다.

### 권한/entitlement

- 공통 상품 권한: `src/lib/product-entitlements.ts`
- 보관형 리포트 권한: `src/lib/report-entitlements.ts`
- 유료 결과 스냅샷: `src/lib/payments/paid-reading-snapshots.ts`
- scope key 정규화: `src/lib/payments/product-scope.ts`
- product entitlement DB: `supabase/migrations/016_product_entitlements.sql`, `018_product_entitlements_taste_product_check.sql`, `020_product_entitlements_paid_snapshots.sql`

성향궁합은 두 사람 입력 조합별로 재구매를 막아야 하므로 전역 상품보다 scope 기반 권한이 안전하다. 현재 브랜치의 성향궁합 상품도 `personality-compatibility` scope kind와 `scope` query를 사용한다.

### 코인/멤버십

- 코인 차감: `src/lib/credits/deduct.ts`
- 오늘운 상세 코인 접근: `src/lib/credits/detail-report-access.ts`
- 월간 달력 코인 접근: `src/lib/credits/calendar-access.ts`
- 코인 사용 API: `src/app/api/credits/use/route.ts`
- 구독 상태: `src/lib/subscription.ts`
- 구독 관리 API: `src/app/api/subscription/manage/route.ts`
- MY 결제 상태: `src/app/my/billing/page.tsx`

성향궁합 990원 결제는 기존 코인 차감 로직을 새로 만들기보다 `taste_product` 결제와 `product_entitlements` 권한 기준을 재사용하는 것이 가장 안전하다.

## 5. 사용자 프로필/생년월일/태어난 시간 저장 구조

### DB 구조

- 기본 사용자 크레딧/구독/사주 기록: `supabase/migrations/001_initial.sql`
- 사용자 프로필/가족 프로필: `supabase/migrations/003_profiles.sql`
- 출생 분 컬럼: `supabase/migrations/005_profile_birth_minutes.sql`
- 출생지/경도 보정 컬럼: `supabase/migrations/009_profile_birth_locations.sql`
- 선호 상담사 컬럼: `supabase/migrations/010_profile_preferred_counselor.sql`
- 양력/음력, 시간 규칙 컬럼: `supabase/migrations/014_profile_birth_calendar_fields.sql`

`profiles`와 `family_profiles`는 다음 계열 필드를 가진다.

- `display_name` 또는 `label`
- `relationship`
- `birth_year`, `birth_month`, `birth_day`
- `birth_hour`, `birth_minute`
- `birth_calendar_type`
- `birth_time_rule`
- `birth_location_code`, `birth_location_label`
- `birth_latitude`, `birth_longitude`
- `solar_time_mode`
- `gender`
- `note`

### 서버/라이브러리 구조

- 프로필 타입과 저장: `src/lib/profile.ts`
- 프로필 API helper: `src/app/api/profile/route-helpers.ts`
- 프로필 API: `src/app/api/profile/route.ts`
- 가족 프로필 API: `src/app/api/family-profiles/route.ts`
- MY 프로필 화면: `src/app/my/profile/page.tsx`
- 프로필 관리 UI: `src/components/my/profile-manager.tsx`

중요 재사용 함수:

- `hasCoreBirthProfile`
- `toBirthInputFromProfile`
- `getProfileSettingsData`
- `getOptionalSignedInProfile`
- `resolveUnifiedBirthInput`

성향궁합에서 저장 프로필을 활용하려면 기존 궁합 입력의 빠른 채우기 구조를 재사용하는 것이 좋다. 비로그인/수동 입력은 기존처럼 sessionStorage 기반으로 시작할 수 있다.

## 6. 새 기능 부착 위치 제안

### 메뉴/라우트

- 궁합 메뉴 진입점: `src/app/compatibility/page.tsx`
- 권장 입력 라우트: `/compatibility/personality`
- 권장 결과 라우트: `/compatibility/personality/result`

현재 브랜치 기준 해당 라우트가 이미 존재하므로, 다음 작업에서는 “새로 생성”보다 “현재 구현이 요구사항과 맞는지 확인 후 보완”이 안전하다.

### 입력 UI

- 권장 위치: `src/features/compatibility/personality-compatibility-input-client.tsx`
- 재사용 대상:
  - `UnifiedBirthInfoFields`
  - `resolveUnifiedBirthInput`
  - 기존 `compatibility-input-client.tsx`의 저장 프로필 빠른 채우기 패턴
  - `src/domain/personality/selfCheck.ts`의 8문항 성향 체크 후보

### 점수/도메인 로직

- 권장 위치: `src/domain/compatibility-personality`
- 이유:
  - 기존 사주 엔진과 분리된 순수 로직으로 유지 가능
  - UI/결제/저장과 분리 가능
  - `compatibilityScore.test.ts`처럼 독립 테스트를 붙이기 좋음

주의:

- 사주 계산은 `src/domain/saju/engine`을 새로 만들거나 수정하지 않는다.
- `BirthInput` 또는 기존 계산 결과에서 사주 facts를 받아 성향 facts와 결합한다.
- MBTI와 오행을 1:1로 매핑하지 않는다.

### 결과/리포트 UI

- 권장 위치:
  - `src/features/compatibility/personality-compatibility-result-builder.ts`
  - `src/features/compatibility/personality-compatibility-result-client.tsx`
- 무료 결과는 5축 점수와 짧은 해석 중심으로 제한한다.
- 유료 결과는 entitlement 확인 뒤에만 잠금 영역을 해제한다.

### 결제/권한

- 권장 product code: `personality_compatibility_mini`
- 권장 package id: `taste_personality_compatibility_mini`
- 권장 가격: 990원
- 권장 config 위치:
  - `src/lib/payments/personality-compatibility.ts`
  - `src/lib/payments/catalog.ts`
  - `src/lib/payments/product-scope.ts`
- 권장 권한 기준:
  - `product_entitlements.user_id`
  - `product_entitlements.product_id`
  - `product_entitlements.scope_key`

### 저장/공유

- 권장 저장 API: `src/app/api/compatibility/personality/reports/route.ts`
- 권장 테이블: `compatibility_personality_reports`
- 공유 카드에는 생년월일시, 성별, 이름, 상대 세부 정보가 노출되지 않아야 한다.
- 다시 보기 링크는 `reportId` 또는 비식별 `scope_key` 기반으로 처리한다.

### 이벤트

- 권장 이벤트 정의: `src/lib/analytics-events.ts`
- payload에는 `relationshipType`, `productCode`, `amount`, `source` 정도만 포함한다.
- 이름, 생년월일, 태어난 시간, 성별, 상대 정보, 성향 코드, birth summary는 analytics payload에 넣지 않는다.

## 7. 다음 단계 제안

1. 현재 브랜치에 이미 있는 성향궁합 파일들이 이전 작업 산출물인지 확인한다.
2. clean-start가 필요하면 현재 성향궁합 파일을 기준으로 삼지 말고, 작업 단위별로 새로 적용할 파일 목록을 확정한다.
3. 다음 작업은 구현보다 먼저 “성향궁합 MVP 데이터 계약”을 확정하는 것이 좋다.
4. 데이터 계약에는 관계 유형, 두 사람 birth input, 성향 입력 방식, 현재 질문, 사주 facts, 성향 facts, 5축 score shape, 무료/유료 report shape가 포함되어야 한다.
5. 그 다음에 순수 scoring engine을 먼저 구현하고, UI/결제/저장은 후속 단계로 분리한다.

## 8. 조사 중 확인한 주의사항

- 현재 `npm run lint`는 일반 ESLint가 아니라 import 검증이다.
- 기존 사주 계산 엔진은 이미 넓게 사용되므로 직접 수정하면 회귀 위험이 크다.
- 기존 결제는 Toss 승인, prepare/confirm, entitlement, paid snapshot 흐름으로 이어진다.
- 성향궁합 유료 해금은 전역 구매가 아니라 결과 scope별 구매로 설계하는 편이 적합하다.
- 프로필/가족 프로필에는 개인정보에 가까운 출생정보가 저장되므로 analytics, 공유 카드, 로그에 원본값을 넣지 않아야 한다.
- 공식 검사/진단처럼 보이는 표현은 피하고 “16유형 성향”, “성향 체크”, “참고용 자기이해 콘텐츠” 흐름으로 유지해야 한다.
